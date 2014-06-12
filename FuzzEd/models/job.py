import uuid
import json
import xmlrpclib
import math
import logging

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import mail_managers
from django.http import HttpResponse
from south.modelsinspector import add_introspection_rules

from graph import Graph
from node import Node
from configuration import Configuration
from node_configuration import NodeConfiguration
from result import Result
from FuzzEd.models import xml_backend
from FuzzEd import settings
from FuzzEd.middleware import HttpResponseServerErrorAnswer
from xml_configurations import FeatureChoice, InclusionChoice, RedundancyChoice
from xml_backend import AnalysisResult, MincutResult


logger = logging.getLogger('FuzzEd')


class NativeXmlField(models.Field):
    def db_type(self, connection):
        return 'xml'


add_introspection_rules([], ['^FuzzEd\.models\.job\.NativeXmlField'])


def gen_uuid():
    return str(uuid.uuid4())


class Job(models.Model):
    class Meta:
        app_label = 'FuzzEd'

    MINCUT_JOB = 'mincut'
    TOP_EVENT_JOB = 'topevent'
    SIMULATION_JOB = 'simulation'
    EPS_RENDERING_JOB = 'eps'
    PDF_RENDERING_JOB = 'pdf'

    JOB_TYPES = (
        (MINCUT_JOB, 'Cutset computation'),
        (TOP_EVENT_JOB, 'Top event calculation (analytical)'),
        (SIMULATION_JOB, 'Top event calculation (simulation)'),
        (EPS_RENDERING_JOB, 'EPS rendering job'),
        (PDF_RENDERING_JOB, 'PDF rendering job')
    )

    graph = models.ForeignKey(Graph, null=True, related_name='jobs')
    graph_modified = models.DateTimeField()  # Detect graph changes during job execution
    secret = models.CharField(max_length=64, default=gen_uuid)  # Unique secret for this job
    kind = models.CharField(max_length=127, choices=JOB_TYPES)
    created = models.DateTimeField(auto_now_add=True, editable=False)
    exit_code = models.IntegerField(null=True)  # Exit code for this job, NULL if pending

    def input_data(self):
        ''' Used by the API to get the input data needed for the particular job type.'''
        if self.kind in (Job.MINCUT_JOB, Job.TOP_EVENT_JOB, Job.SIMULATION_JOB):
            return self.graph.to_xml(), 'application/xml'
        elif self.kind in (Job.EPS_RENDERING_JOB, Job.PDF_RENDERING_JOB):
            return self.graph.to_tikz(), 'application/text'
        assert (False)

    def done(self):
        return self.exit_code is not None

    @property
    def requires_download(self):
        """
            Indicates if the result should be delivered directly to the frontend
            as file, or if it must be preprocessed with self.result_rendering().
        """
        return self.kind in [Job.EPS_RENDERING_JOB, Job.PDF_RENDERING_JOB]

    def result_titles(self):
        ''' If the result is not binary, than it is JSON. This function returns
            the human-readable sorted names of the result keys, so that the frontend
            makes no decision about what to show and how.
        '''
        assert(not self.requires_download)
        if self.kind == self.TOP_EVENT_JOB:
            return  (('id','Config'),('min','Min'),    ('peak','Peak'),
                     ('max','Max'),  ('costs','Costs'),('ratio','Risk'))            
        elif self.kind == self.SIMULATION_JOB:
            return  (('id','Config'),)      
        elif self.kind == self.MINCUT_JOB:
            return  (('id','Config'),)      

    def result_titles_field(self, index):
        ''' The client expresses a wish to order result data by communicating a column ID. 

        '''
        assert(not self.requires_download)
        if self.kind == self.TOP_EVENT_JOB:
            return  (('id','Config'),('min','Min'),    ('peak','Peak'),
                     ('max','Max'),  ('costs','Costs'),('ratio','Risk'))            
        elif self.kind == self.SIMULATION_JOB:
            return  (('id','Config'),)      
        elif self.kind == self.MINCUT_JOB:
            return  (('id','Config'),)      


    def result_download(self):
        """
            Returns an HttpResponse as direct file download of the result data.
        """
        response = HttpResponse()
        response['Content-Disposition'] = 'attachment; filename=graph%u.%s' % (self.graph.pk, self.kind)
        response.content = Result.objects.exclude(kind=Result.GRAPH_ISSUES).get(job=self).binary_value
        response['Content-Type'] = 'application/pdf' if self.kind == 'pdf' else 'application/postscript'
        return response

    def interpret_issues(self, xml_issues):
        """
            Interpret the incoming list of issues and convert to feasible JSON for storage.
        """
        errors = []
        warnings = []
        for issue in xml_issues:
            json_issue={'message':issue.message, 
                        'issueId':issue.issueId, 
                        'elementId': issue.elementId}
            if issue.isFatal:
                errors.append(json_issue)
            else:
                warnings.append(json_issue)
        return {'errors': errors, 'warnings': warnings}

    def interpret_value(self, xml_result_value, db_result):
        """
            Interpret the incoming result value and convert it to feasible JSON for storage.
            Secondly, the function return a plain integer representing the result
            for sorting purposes. 

            Fuzzy probability values as result are given for each alpha cut. Putting
            all the different values together forms a triangular membership function.
            Crisp probabilities are just a special case of this, were the membership
            function collapses to a straight vertical line.

            The method determines both a list of drawable diagram coordinates, 
            and the result values to be shown directly to the user.

            Diagram point determination:

            The X axis represents the unreliability value (== probability of failure), 
            the Y axis the membership function probability value for the given unreliability value.
            For each alpha cut, the backend returns us the points were the upper border of the 
            alphacut stripe is crossing the membership triangle.
            The lowest alphacut (0) has its upper border directly on the X axis.
            The highest alphacut has its upper border crossing the tip of the membership function. 
                
            The two points were the alphacut border touches the membership function are called 
            "[lower, upper]", the number of the alphacut is the "key".
            For this reason, "lower" and "upper" are used as X coordinates, 
            while the key is used as "Y" coordinate.

        """
        if hasattr(xml_result_value, 'probability') and xml_result_value.probability is not None:
            points = []
            logging.debug("Probability: " + str(xml_result_value.probability))
            alphacut_count = len(xml_result_value.probability.alphaCuts)  # we don't believe the delivered decomp_number
            for alpha_cut in xml_result_value.probability.alphaCuts:
                y_val = alpha_cut.key + 1 / alphacut_count  # Alphacut indexes start at zero
                assert (0 <= y_val <= 1)
                points.append([alpha_cut.value_.lowerBound, y_val])
                if alpha_cut.value_.upperBound != alpha_cut.value_.lowerBound:
                    points.append([alpha_cut.value_.upperBound, y_val])
                else:
                    # This is the tip of the triangle.
                    # If this is a crisp probability, then there is only the point above added.
                    # In this case, add another fake point to draw a strisaght line.
                    # points.append([alpha_cut.value_.lowerBound, 0])
                    pass
            # Points is now a wild collection of coordinates, were double values for the same X 
            # coordinate may occur. We sort it (since the JS code likes that) and leave only the 
            # largest Y values per X value.
            db_result.points = json.dumps(sorted(points))

            # Compute some additional statistics for the front-end, based on the gathered probabilities
            if len(points) > 0:
                db_result.minimum = min(points, key=lambda point: point[0])[0]  # left triangle border position
                db_result.maximum = max(points, key=lambda point: point[0])[0]  # right triangle border position
                db_result.peak = max(points, key=lambda point: point[1])[0]  # triangle tip position
                #result['ratio'] = float(current_config['peak'] * current_config['costs']) if current_config['costs'] else None

        if hasattr(xml_result_value, 'reliability') and xml_result_value.reliability is not None:
            reliability = float(xml_result_value.reliability)
            sort_value = round(reliability)            
            db_result.reliability = None if math.isnan(reliability) else reliability

        if hasattr(xml_result_value, 'mttf') and xml_result_value.mttf is not None:
            mttf = float(xml_result_value.mttf)
            db_result.mttf = None if math.isnan(mttf) else mttf

        if hasattr(xml_result_value, 'rounds') and xml_result_value.nSimulatedRounds is not None:
            rounds = int(result.nSimulatedRounds)
            db_result.rounds = None if math.isnan(rounds) else rounds

        if hasattr(xml_result_value, 'nFailures') and xml_result_value.nFailures is not None:
            failures = int(result.nFailures)
            db_result.failures = None if math.isnan(failures) else failures
            #result['ratio'] = float(1 - reliability * current_config['costs']) if current_config['costs'] else None

    def parse_result(self, data):
        """
            Parses the result data and saves the content to the database, 
            in relation to this job.
        """
        if self.requires_download:
            if self.kind == self.PDF_RENDERING_JOB:
                db_result = Result(graph=self.graph, job=self, kind=Result.PDF_RESULT)
            elif self.kind == self.EPS_RENDERING_JOB:
                db_result = Result(graph=self.graph, job=self, kind=Result.EPS_RESULT)
            db_result.binary_value = data
            db_result.save()
            return
        logger.debug("Parsing backend result XML into database")
        doc = xml_backend.CreateFromDocument(str(data))

        if hasattr(doc, 'issue'):
            # Result-independent issues (for the whole graph, and not per configuration),
            # are saved as special kind of result
            db_result = Result(graph=self.graph , job=self, kind=Result.GRAPH_ISSUES)
            db_result.issues = json.dumps(self.interpret_issues(doc.issue))
            db_result.save()

        conf_id_mappings = {}         # XML conf ID's to DB conf ID's

        if hasattr(doc, 'configuration'):
            # Throw away existing configurations information
            self.graph.delete_configurations()
            # walk through all the configurations determined by the backend, as shown in the XML
            for configuration in doc.configuration:
                db_conf = Configuration(graph=self.graph, costs=configuration.costs if hasattr(configuration, 'costs') else None)
                db_conf.save()
                conf_id_mappings[configuration.id] = db_conf
                logger.debug("Storing configuration %u for graph %u"%(db_conf.pk, self.graph.pk))
                # Analyze node configuration choices in this configuration
                assert(hasattr(configuration, 'choice'))    # according to XSD, this must be given
                for choice in configuration.choice:
                    element = choice.value_
                    json_choice = {}
                    if isinstance(element, FeatureChoice):
                        json_choice['type'] = 'FeatureChoice'
                        json_choice['featureId'] = element.featureId
                    elif isinstance(element, InclusionChoice):
                        json_choice['type'] = 'InclusionChoice'
                        json_choice['included'] = element.included
                    elif isinstance(element, RedundancyChoice):
                        json_choice['type'] = 'RedundancyChoice'
                        json_choice['n'] = int(element.n)
                    else:
                        raise ValueError('Unknown choice %s' % element)
                    db_node = Node.objects.get(client_id=choice.key, graph=self.graph)
                    db_nodeconf = NodeConfiguration(node=db_node, configuration = db_conf, setting=json_choice)
                    db_nodeconf.save()
                    logger.debug("Storing node configuration %u for node %u"%(db_nodeconf.pk, db_node.pk))

        if hasattr(doc, 'result'):
            for result in doc.result:
                assert(int(result.modelId) == self.graph.pk)
                db_result = Result(graph=self.graph , job=self)
                if result.configId in conf_id_mappings:
                    db_result.configuration=conf_id_mappings[result.configId]
                if type(result) is AnalysisResult:
                    db_result.kind = Result.ANALYSIS_RESULT
                elif type(result) is MincutResult:
                    db_result.kind = Result.MINCUT_RESULT
                elif type(result) is SimulationResult:
                    db_result.kind = Result.SIMULATION_RESULT
                self.interpret_value(result, db_result)
                if result.issue:
                    db_result.issues = json.dumps(self.interpret_issues(result.issue))
                db_result.save()
                #logger.debug(db_result)

@receiver(post_save, sender=Job)
def job_post_save(sender, instance, created, **kwargs):
    ''' Informs notification listeners.
        The payload contains the job URL prefix with a secret, 
        which allows the listener to perform according actions.
    '''
    if created:
        # The only way to determine our own hostname + port number at runtime in Django
        # is from an HttpRequest object, which we do not have here. 
        # Option 1 is to fetch this information from the HttpRequest and somehow move it here.
        # This works nice as long as LiveServerTestCase is not used, since the Django Test
        # Client still accesses the http://testserver URL and not the live server URL.
        # We therefore take the static approach with a setting here, which is overriden
        # by the test suite run accordingly

        # TODO: Use reverse() for this
        job_url = settings.SERVER + '/api/back/jobs/' + instance.secret

        try:
            # The proxy is instantiated here, since the connection should go away when finished
            s = xmlrpclib.ServerProxy(settings.BACKEND_DAEMON)
            logger.debug("Triggering %s job on url %s" % (instance.kind, job_url))
            s.start_job(instance.kind, job_url)
        except Exception as e:
            mail_managers("Exception on backend call - " + settings.BACKEND_DAEMON, str(e))
            raise HttpResponseServerErrorAnswer(
                "Sorry, we seem to have a problem with our FuzzEd backend. The admins are informed, thanks for the patience.")

