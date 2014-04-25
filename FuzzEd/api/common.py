from django.shortcuts import get_object_or_404
from django.core.mail import mail_managers
from FuzzEd.models import Graph, Job
from django.contrib.auth.models import User
from FuzzEd.middleware import HttpResponseServerErrorAnswer
from tastypie.resources import ModelResource
from tastypie.authentication import ApiKeyAuthentication   
from tastypie.authorization import Authorization
from tastypie.exceptions import UnsupportedFormat, BadRequest, ImmediateHttpResponse
from django.core.exceptions import ValidationError
from tastypie.serializers import Serializer
from tastypie.models import ApiKey
from tastypie import fields
from tastypie.http import HttpForbidden
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils.cache import patch_cache_control, patch_vary_headers

from FuzzEd.models import Project, Graph

import time


import logging
logger = logging.getLogger('FuzzEd')

class OurApiKeyAuthentication(ApiKeyAuthentication):
    ''' Our own version does not demand the user name to be part of the auth header. '''
    def extract_credentials(self, request):
        if request.META.get('HTTP_AUTHORIZATION') and request.META['HTTP_AUTHORIZATION'].lower().startswith('apikey '):
            (auth_type, api_key) = request.META['HTTP_AUTHORIZATION'].split(' ')

            if auth_type.lower() != 'apikey':
                logger.debug("Incorrect authorization header: "+str(request.META['HTTP_AUTHORIZATION']))
                raise ValueError("Incorrect authorization header.")
            try:
                key = ApiKey.objects.get(key=api_key.strip())
            except:
                logger.debug("Incorrect API key in header: "+str(request.META['HTTP_AUTHORIZATION']))
                raise ValueError("Incorrect API key.")
            return key.user.username, api_key    
        else:
            logger.debug("Missing authorization header: "+str(request.META))
            raise ValueError("Missing authorization header.")

class ProjectResource(ModelResource):
    '''
        An API resource for projects.
    '''
    graphs = fields.ToManyField('FuzzEd.api.external.GraphResource', 'graphs')

    class Meta:
        queryset = Project.objects.filter(deleted=False)
        authentication = OurApiKeyAuthentication()
        list_allowed_methods = ['get']
        detail_allowed_methods = ['get']
        excludes = ['deleted', 'owner']
        nested = 'graph'

    def get_object_list(self, request):
        return super(ProjectResource, self).get_object_list(request).filter(owner=request.user)


class GraphResource(ModelResource):
    '''
        An abstract base class for graph API resources.
    '''
    project = fields.ToOneField(ProjectResource, 'project')

    def hydrate(self, bundle):
        # Make sure that owners are assigned correctly
        bundle.obj.owner=bundle.request.user
        # Get the user-specified project, and make sure that it is his.
        # This is not an authorization problem for the (graph) resource itself, 
        # so it must be handled here and not in the auth class.
        try:
            project = Project.objects.get(pk=bundle.request.GET['project'], owner=bundle.request.user)
            bundle.obj.project=project
        except:
            raise ImmediateHttpResponse(response=HttpForbidden("You can't use this project for your new graph."))            
        # Fill the graph with the GraphML data
        bundle.obj.from_graphml(bundle.request.body)     
        return bundle  

    def wrap_view(self, view):
        """
        Wraps views to return custom error codes instead of generic 500's
        """
        @csrf_exempt
        def wrapper(request, *args, **kwargs):
            ''' This is a straight copy from the Tastypie sources,
                extended with the 415 generation code. 
            '''
            try:
                callback = getattr(self, view)
                response = callback(request, *args, **kwargs)

                # Our response can vary based on a number of factors, use
                # the cache class to determine what we should ``Vary`` on so
                # caches won't return the wrong (cached) version.
                varies = getattr(self._meta.cache, "varies", [])

                if varies:
                    patch_vary_headers(response, varies)

                if self._meta.cache.cacheable(request, response):
                    if self._meta.cache.cache_control():
                        # If the request is cacheable and we have a
                        # ``Cache-Control`` available then patch the header.
                        patch_cache_control(response, **self._meta.cache.cache_control())

                if request.is_ajax() and not response.has_header("Cache-Control"):
                    # IE excessively caches XMLHttpRequests, so we're disabling
                    # the browser cache here.
                    # See http://www.enhanceie.com/ie/bugs.asp for details.
                    patch_cache_control(response, no_cache=True)

                # Detect result content type and create some meaningfull disposition name
                if 'format' in request.GET:
                    if request.GET['format'] == 'graphml':
                        response['Content-Disposition'] = 'attachment; filename=graph.xml'
                    elif request.GET['format'] == 'tex':
                        response['Content-Disposition'] = 'attachment; filename=graph.tex'
                    elif request.GET['format'] == 'json':
                        response['Content-Disposition'] = 'attachment; filename=graph.json'

                return response
            except UnsupportedFormat as e:
                response = HttpResponse()
                response.status_code = 413
                return response               
            except (BadRequest, fields.ApiFieldError) as e:
                data = {"error": e.args[0] if getattr(e, 'args') else ''}
                return self.error_response(request, data, response_class=http.HttpBadRequest)
            except ValidationError as e:
                data = {"error": e.messages}
                return self.error_response(request, data, response_class=http.HttpBadRequest)
            except Exception as e:
                if hasattr(e, 'response'):
                    return e.response

                # A real, non-expected exception.
                # Handle the case where the full traceback is more helpful
                # than the serialized error.
                if settings.DEBUG and getattr(settings, 'TASTYPIE_FULL_DEBUG', False):
                    raise

                # Re-raise the error to get a proper traceback when the error
                # happend during a test case
                if request.META.get('SERVER_NAME') == 'testserver':
                    raise

                # Rather than re-raising, we're going to things similar to
                # what Django does. The difference is returning a serialized
                # error message.
                return self._handle_500(request, e)

        return wrapper

class GraphSerializer(Serializer):
    """
        Our custom serializer / deserializer for graph formats we support.
        The XML format is GraphML, anything else is not supported.
        The non-implemented deserialization of Tex / JSON input leads to a Tastypie exception,
        which is translated to 401 for the client. There is no explicit way in Tastypie to
        differentiate between supported serialization / deserialization formats.
    """
    formats = ['json', 'tex', 'graphml']
    content_types = {
        'json': 'application/json',
        'tex': 'application/text',
        'graphml': 'application/xml'
    }

    def to_tex(self, data, options=None):
        return data.obj.to_tikz()

    def to_graphml(self, data, options=None):
        return data.obj.to_graphml()

    def from_graphml(self, content):
        ''' 
           Tastypie serialization demands a dictionary of (graph) model
           attribute values here. We return a dummy to support the 
           format officially, and solve the rest in hydrate().
        '''
        return {}

class GraphAuthorization(Authorization):
    '''
        Tastypie authorization class. The main task of this class 
        is to restrict the accessible objects to the ones that the currently
        logged-in user is allowed to use.
    '''
    def read_list(self, object_list, bundle):
        ''' User is only allowed to get the graphs he owns.'''
        return object_list.filter(owner=bundle.request.user)

    def read_detail(self, object_list, bundle):
        ''' User is only allowed to get the graph if he owns it.'''
        return bundle.obj.owner == bundle.request.user

    def create_list(self, object_list, bundle):
        # Assuming they're auto-assigned to ``user``.
        return object_list

    def create_detail(self, object_list, bundle):
        return bundle.obj.owner == bundle.request.user

    def update_list(self, object_list, bundle):
        allowed = []
        # Since they may not all be saved, iterate over them.
        for obj in object_list:
            if obj.owner == bundle.request.user:
                allowed.append(obj)
        return allowed

    def update_detail(self, object_list, bundle):
        return bundle.obj.owner == bundle.request.user

    def delete_list(self, object_list, bundle):
        return object_list.filter(owner=bundle.request.user)

    def delete_detail(self, object_list, bundle):
        return bundle.obj.owner == bundle.request.user




# def graph_download(user, graph_id, export_format):
#     """
#     Function: graph_download
#         Provides a download response of the graph in the given format, or an HTTP error if 
#         the rendering job for the export format is not ready so far.

#         It is sufficient to prepare the HTTP response already here, since the link is independent
#         from the the kind of API being used for access

#     Parameters:
#      user          - The requesting user's object in the model
#      graph_id      - the id of the graph to be downloaded
#      export_format - The demanded export format

#     Returns:
#      {HTTPResponse} a django response object
#     """
#     if user.is_staff:
#         graph = get_object_or_404(Graph, pk=graph_id)
#     else:
#         graph = get_object_or_404(Graph, pk=graph_id, owner=user, deleted=False)        

#     response = HttpResponse()
#     response['Content-Disposition'] = 'attachment; filename=%s.%s' % (graph.name, export_format)

#     if export_format == 'xml':
#         response.content = graph.to_xml()
#         response['Content-Type'] = 'application/xml'
#     elif export_format == 'graphml':
#         response.content = graph.to_graphml()
#         response['Content=Type'] = 'application/xml'
#     elif export_format == 'json':
#         response.content = graph.to_json()
#         response['Content-Type'] = 'application/javascript'
#     elif export_format == 'tex':
#         response.content = graph.to_tikz()
#         response['Content-Type'] = 'application/text'
#     elif export_format in ('pdf', 'eps'):
#         try:
#             # Take the latest file that was successfully created
#             # This is based on the assumption that nobody calls this function before the job is done
#             job = graph.jobs.filter(kind=export_format).latest('created')
#             if not job.done():
#                 raise HttpResponseNotFoundAnswer()
#             response.content = job.result
#             response['Content-Type'] = 'application/pdf' if export_format == 'pdf' else 'application/postscript'
#         except ObjectDoesNotExist:
#             raise HttpResponseNotFoundAnswer()
#     else:
#         raise HttpResponseNotFoundAnswer()
#     return response


def job_create(user, graph_id, job_kind):
    """
        Starts a job of the given kind for the given graph.
        It is intended to return immediately with job object.
    """
    print user
    if user.is_staff:
        graph = get_object_or_404(Graph, pk=graph_id)
    else:
        graph = get_object_or_404(Graph, pk=graph_id, owner=user, deleted=False)

    job = Job(graph=graph, kind=job_kind, graph_modified=graph.modified)
    job.save()

    # return URL for job status information
    logger.debug('Created new %s job with ID %d for graph %d' % (job.kind, job.pk, graph.pk))
    return job
 
def job_status(user, job_id):
    ''' Returns the status information for the given job, and the job object if available.
        This API helper wraps functionality that is common to all frontend API versions of
        this call.
        0 - Job is done, deliver the result.
        1 - Job is done, but you can't deliver the result due to an error.
        2 - Job is not done, try again later.
        3 - Job does not exist, go away.
    '''
    try:
        job = Job.objects.get(pk=job_id)
        # Prevent cross-checking of jobs by different users
        assert(job.graph.owner == user or user.is_staff)
    except:
        # The job does not exist, or it shouldn't exist for this user.        
        return 3, None

    if job.done():
        if job.exit_code == 0:
            logger.debug("Job is done.")
            return 0, job
        else:
            logger.debug("Job is done, but with non-zero exit code.")
            mail_managers('Analysis of job %s ended with non-zero exit code.'%job.pk, job.graph.to_xml() )
            return 1, job
    else:       
        logger.debug("Job is pending.")
        return 2, job

