'''
    This is the test suite.

    The typical workflow to add new tests is the following:
    - Get yourself an empty local database with './manage.py flush'.
    - Draw one or more test graphs. Make sure that they are owner by the user with user.pk = 1.
    - Create a fixture file from it with 'fab fixture_save:<filename.json>'. 
    - Create a class such as 'SimpleFixtureTestCase' to wrap all ID's for your fixture file.
    - Derive your test case class from it. Check the helper functions in 'FuzzEdTestCase'.
    - Run the tests with 'fab run_tests'.
    - Edit your fixture file by loading it into the local database with 'fab fixture_load:<filename.json>'

    TODO: Several test would look better if the model is checked afterwards for the changes being applied
        (e.g. node relocation). Since we use the LiveServerTestCase base, this is not possible, since
        database modifications are not commited at all. Explicit comitting did not help ...
'''

import json
import time
import os
import sys
import subprocess
from subprocess import Popen
import unittest
from xml.dom.minidom import parse

from django.test import LiveServerTestCase, TestCase
from django.test.client import Client
from django.contrib.auth.models import User

from FuzzEd.models.graph import Graph
from FuzzEd.models.node import Node
from FuzzEd.models.job import Job
from FuzzEd.models.node_group import NodeGroup
from FuzzEd.models.notification import Notification


# This disables all the debug output from the FuzzEd server, e.g. Latex rendering nodes etc.
#logging.disable(logging.CRITICAL)

# The fixtures used in different test classes
fixt_analysis = {
                'files' :  ['analysis.json', 'testuser.json'], 
                'graphs':  {7: 'faulttree', 8: 'faulttree'},
                'results': {7: 'results/rate_tree.xml', 8: 'results/prdc_tree.xml'},               
                'rate_faulttree': 7,                # Graph PK
                'prdc_faulttree': 8,                # Graph PK
                'prdc_configurations': 8,           # Decomposition number
                'prdc_peaks': [0.31482, 0.12796, 0.25103, 0.04677, 0.36558, 0.19255, 0.30651, 0.11738]
                }

fixt_simple = {
                'files' : ['simple.json', 'testuser.json'], 
                'graphs': {1: 'faulttree', 2: 'fuzztree', 3: 'rbd'},
                'pkProject': 1,
                'pkFaultTree': 1,
                'pkDFD': 1,  # TODO: This is a hack, since nobody checks the validity of node groups for the graph kind so far
                'clientIdEdge': 4,
                'clientIdAndGate': 1,
                'clientIdBasicEvent': 2
              }

fixt_mincut = {
                'files': ['mincut1.json', 'testuser.json'],
                'mincut_faulttree': 1,
                'mincut_numcuts': 3
              }

fixt_unicode = {
                'files': ['unicode.json', 'testuser.json'],
                'graphs': {1: 'faulttree'},
                'pkProject': 1,
                'pkFaultTree': 1
    
               }

class InternalTestCase(TestCase):
    """
        The tests for internal functions that are not exposed directly via one of the APIs.
    """
    fixtures = fixt_analysis['files']

    def testResultParsing(self):
        for graphPk, graphResult in fixt_analysis['results'].iteritems(): 
            graph = Graph.objects.get(pk=graphPk)
            job=Job(result=open('FuzzEd/fixtures/'+graphResult).read(), graph=graph)
            job.parse_result()

class FuzzEdTestCase(LiveServerTestCase):
    """
        The base class for all test cases that work on exposed function calls. 
        Mainly provides helper functions for deal with auth stuff.
    """

    def setUpAnonymous(self):
        ''' If the test case wants to have a anonymous login session, it should call this function in setUp().'''
        self.c = Client()

    def setUpLogin(self):
        ''' If the test case wants to have a functional login session, it should call this function in setUp().'''
        self.c = Client()
        self.c.login(username='testadmin', password='testadmin')

    def get(self, url):
        return self.c.get(url)

    def post(self, url, data):
        return self.c.post(url, data)

    def getWithAPIKey(self, url):
        return self.c.get(url, **{'HTTP_AUTHORIZATION': 'ApiKey f1cc367bc09fc95720e6c8a4225ae2b912fff91b'})

    def postWithAPIKey(self, url, data, content_type):
        return self.c.post(url, data, content_type,
                           **{'HTTP_AUTHORIZATION': 'ApiKey f1cc367bc09fc95720e6c8a4225ae2b912fff91b'})

    def ajaxGet(self, url):
        return self.c.get(url, HTTP_X_REQUESTED_WITH='XMLHttpRequest')

    def ajaxPost(self, url, data, content_type):
        """
        :rtype : django.http.response.HttpResponse
        """
        return self.c.post(url, data, content_type, **{'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest'})

    def ajaxPatch(self, url, data, content_type):
        """
        :rtype : django.http.response.HttpResponse
        """
        return self.c.patch(url, data, content_type, **{'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest'})

    def ajaxDelete(self, url):
        return self.c.delete(url, HTTP_X_REQUESTED_WITH='XMLHttpRequest')

    def requestJob(self, base_url, graph, kind):
        """ Helper function for requesting a job. """
        newjob = json.dumps({'kind': kind})
        response = self.ajaxPost(base_url + '/graphs/%u/jobs/' % graph, newjob, 'application/json')
        self.assertNotEqual(response.status_code, 500)  # the backend daemon is not started
        self.assertEqual(response.status_code, 201)  # test if we got a created job
        assert ('Location' in response)
        jobUrl = response['Location']
        code = 202
        assert (not jobUrl.endswith('jobs/'))
        print "Waiting for result from " + jobUrl,
        while (code == 202):
            response = self.ajaxGet(jobUrl)
            code = response.status_code
        self.assertEqual(response.status_code, 200)
        return response

class ViewsTestCase(FuzzEdTestCase):
    """ 
        Tests for different Django views and their form submissions. 
    """
    fixtures = fixt_simple['files']

    def setUp(self):
        self.setUpLogin()

    def testRootView(self):
        ''' Root view shall redirect to projects overview. '''
        response = self.get('/')
        self.assertEqual(response.status_code, 302)

    def testProjectsView(self):
        response = self.get('/projects/')
        self.assertEqual(response.status_code, 200)

    def testEditorView(self):
        for graphId, kind in fixt_simple['graphs'].iteritems():
            response = self.get('/editor/%u' % graphId)
            self.assertEqual(response.status_code, 200)

    def testInvalidEditorView(self):
        response = self.get('/editor/999')
        self.assertEqual(response.status_code, 404)

    def testGraphCopy(self):
        for graphid, kind in fixt_simple['graphs'].iteritems():
            response = self.post('/graphs/%u/' % graphid, {'copy': 'copy'})
            self.assertEqual(response.status_code, 302)
            # The view code has no reason to return the new graph ID, so the redirect is to the dashboard
            # We therefore determine the new graph by the creation time
            copy = Graph.objects.all().order_by('-created')[0]
            original = Graph.objects.get(pk=graphid)
            self.assertTrue(original.same_as(copy))


class GraphMLFilesTestCase(FuzzEdTestCase):
    """ 
        Testing different GraphML file imports. 
    """
    fixtures = fixt_simple['files']

    def setUp(self):
        self.setUpAnonymous()

    def testImportFiles(self):
        files = [f for f in os.listdir('FuzzEd/fixtures') if f.endswith(".graphml")]
        for f in files:
            text = open('FuzzEd/fixtures/' + f).read()
            # Now import the same GraphML
            response = self.postWithAPIKey(
                        '/api/v1/graph/?format=graphml&project=%u' % fixt_simple['pkProject'], 
                        text,
                        'application/xml')
            self.assertEqual(response.status_code, 201)


class ExternalAPITestCase(FuzzEdTestCase):
    """ 
        Tests for the Tastypie API. 
    """
    fixtures = fixt_simple['files']

    def setUp(self):
        self.setUpAnonymous()

    def testMissingAPIKey(self):
        response = self.get('/api/v1/project/?format=json')
        self.assertEqual(response.status_code, 401)

    def testOriginalAPIKeyFormat(self):
        ''' We have our own APIKey format, so the original Tastypie version should no longer work.'''
        response = self.c.get('/api/v1/project/?format=json',
                              **{'HTTP_AUTHORIZATION': 'ApiKey testadmin:f1cc367bc09fc95720e6c8a4225ae2b912fff91b'})
        self.assertEqual(response.status_code, 401)

    def testRootResource(self):
        ''' Root view of external API should provide graph and project resource base URLs, even without API key.'''
        response = self.get('/api/v1/?format=json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        assert ('graph' in data)
        assert ('project' in data)

    def testProjectListResource(self):
        response = self.getWithAPIKey('/api/v1/project/?format=json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        assert ('objects' in data)
        assert ('graphs' in data['objects'][0])

    def testGraphListResource(self):
        response = self.getWithAPIKey('/api/v1/graph/?format=json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)

    def testSingleProjectResource(self):
        response = self.getWithAPIKey('/api/v1/project/%u/?format=json' % fixt_simple['pkProject'])
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)

    def testJsonExport(self):
        for id, kind in fixt_simple['graphs'].iteritems():
            response = self.get('/api/v1/graph/%u/?format=json' % id)
            self.assertEqual(response.status_code, 401)
            response = self.getWithAPIKey('/api/v1/graph/%u/?format=json' % id)
            data = json.loads(response.content)
            self.assertEqual(response.status_code, 200)

    def testLatexExport(self):
        for id, kind in fixt_simple['graphs'].iteritems():
            if kind in ['faulttree', 'fuzztree']:
                response = self.get('/api/v1/graph/%u/?format=tex' % id)
                self.assertEqual(response.status_code, 401)
                response = self.getWithAPIKey('/api/v1/graph/%u/?format=tex' % id)
                self.assertEqual(response.status_code, 200)
                assert ("tikz" in response.content)

    def testGraphmlExport(self):
        for id, kind in fixt_simple['graphs'].iteritems():
            if kind in ['faulttree', 'fuzztree']:
                # Should only be possible with API key authentication
                response = self.get('/api/v1/graph/%u/?format=graphml' % id)
                self.assertEqual(response.status_code, 401)
                response = self.getWithAPIKey('/api/v1/graph/%u/?format=graphml' % id)
                self.assertEqual(response.status_code, 200)
                assert ("<graphml" in response.content)

    def testGraphmlImport(self):
        for id, kind in fixt_simple['graphs'].iteritems():
            # First export GraphML
            response = self.getWithAPIKey('/api/v1/graph/%u/?format=graphml' % id)
            self.assertEqual(response.status_code, 200)
            graphml = response.content
            # Now import the same GraphML
            response = self.postWithAPIKey('/api/v1/graph/?format=graphml&project=%u' % fixt_simple['pkProject'], graphml,
                                           'application/xml')
            self.assertEqual(response.status_code, 201)
            # Check if the claimed graph really was created
            newid = int(response['Location'][-2])
            original = Graph.objects.get(pk=id)
            copy = Graph.objects.get(pk=newid)
            self.assertTrue(original.same_as(copy))

    def testInvalidGraphImportProject(self):
        # First export valid GraphML
        response = self.getWithAPIKey('/api/v1/graph/%u/?format=graphml' % fixt_simple['pkFaultTree'])
        self.assertEqual(response.status_code, 200)
        graphml = response.content
        # Now send request with wrong project ID
        response = self.postWithAPIKey('/api/v1/graph/?format=graphml&project=99', graphml, 'application/xml')
        self.assertEqual(response.status_code, 403)

    def testMissingGraphImportProject(self):
        # First export valid GraphML
        response = self.getWithAPIKey('/api/v1/graph/%u/?format=graphml' % fixt_simple['pkFaultTree'])
        self.assertEqual(response.status_code, 200)
        graphml = response.content
        # Now send request with wrong project ID
        response = self.postWithAPIKey('/api/v1/graph/?format=graphml', graphml, 'application/xml')
        self.assertEqual(response.status_code, 403)

    def testInvalidGraphImportFormat(self):
        for wrong_format in ['json', 'tex', 'xml']:
            response = self.postWithAPIKey('/api/v1/graph/?format=%s&project=%u' % (wrong_format, fixt_simple['pkProject']),
                                           "<graphml></graphml>", 'application/text')
            self.assertEqual(response.status_code, 413)

    def testInvalidContentType(self):
        for format in ['application/text', 'application/x-www-form-urlencoded']:
            response = self.postWithAPIKey('/api/v1/graph/?format=graphml&project=%u' % (fixt_simple['pkProject']),
                                           "<graphml></graphml>", format)
            self.assertEqual(response.status_code, 413)


    def testFoo(self):
        ''' Leave this out, and the last test will fail. Dont ask me why.'''
        assert (True)


class FrontendApiTestCase(FuzzEdTestCase):
    """
        Tests for the Frontend API called from JavaScript. 
    """
    fixtures = fixt_simple['files']

    baseUrl = '/api/front'

    def setUp(self):
        self.setUpLogin()

        #TODO: Test that session authentication is checked in the API implementation

    #TODO: Test that the user can only access his graphs, and not the ones of other users

    def _testValidGraphJson(self, content):
        for key in ['id', 'seed', 'name', 'type', 'readOnly', 'nodes', 'edges', 'nodeGroups']:
            self.assertIn(key, content)

    def testGetGraph(self):
        for id, kind in fixt_simple['graphs'].iteritems():
            url = self.baseUrl + '/graphs/%u' % fixt_simple['pkFaultTree']
            response = self.ajaxGet(url)
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)
            self._testValidGraphJson(content)
        response = self.ajaxGet(self.baseUrl + '/graphs/9999')
        self.assertEqual(response.status_code, 404)

    def testGraphDownload(self):
        for id, kind in fixt_simple['graphs'].iteritems():
            for format, test_str in [('graphml', '<graphml'), ('json', '{'), ('tex', '\\begin')]:
                url = self.baseUrl + '/graphs/%u?format=%s' % (fixt_simple['pkFaultTree'], format)
                response = self.ajaxGet(url)
                self.assertEqual(response.status_code, 200)
                self.assertIn(test_str, response.content)

    def testGetGraphs(self):
        url = self.baseUrl + '/graphs/'
        response = self.ajaxGet(url)
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        print content
        assert ('graphs' in content)

    def testGraphFiltering(self):
        url = self.baseUrl + '/graphs/?kind=faulttree'
        response = self.ajaxGet(url)
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        print content
        assert ('graphs' in content)

    def testCreateNode(self):
        newnode = json.dumps({'y': 3,
                              'x': 7,
                              'kind': 'basicEvent',
                              'client_id': 888,
                              'properties': '{}'})

        response = self.ajaxPost(self.baseUrl + '/graphs/%u/nodes/' % fixt_simple['pkFaultTree'],
                                 newnode,
                                 'application/json')
        self.assertEqual(response.status_code, 201)
        print response['Location']
        newid = int(response['Location'].split('/')[-1])
        newnode = Node.objects.get(client_id=newid, deleted=False)


    def testCreateNodeGroup(self):
        nodes = [fixt_simple['clientIdAndGate'], fixt_simple['clientIdBasicEvent']]
        newgroup = json.dumps({'client_id': 999, 'nodeIds': nodes})
        response = self.ajaxPost(
                    self.baseUrl + '/graphs/%u/nodegroups/' % fixt_simple['pkDFD'],
                    newgroup,
                    'application/json')
        self.assertEqual(response.status_code, 201)
        print response['Location']
        newid = int(response['Location'].split('/')[-1])
        newgroup = NodeGroup.objects.get(client_id=newid, deleted=False)
        #TODO: Doesn't work due to non-saving of LiveServerTestCase
        #       saved_nodes=newgroup.nodes.all()
        #       self.assertItemsEqual(nodes, saved_nodes)

        # Get complete graph and see if the node group is registered correctly
        url = self.baseUrl + '/graphs/%u' % fixt_simple['pkDFD']
        response = self.ajaxGet(url)
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        for group in content['nodeGroups']:
            self.assertEqual(group['id'], 999)
            self.assertItemsEqual(group['nodeIds'], nodes)
            print group

    def testDeleteNode(self):
        response = self.ajaxDelete(
            self.baseUrl + '/graphs/%u/nodes/%u' % (fixt_simple['pkFaultTree'], fixt_simple['clientIdBasicEvent'])
        )
        self.assertEqual(response.status_code, 204)

    def testDeleteNodeGroup(self):
        #TODO: Fixture should have a node group, instead of creating it here
        nodes = [fixt_simple['clientIdAndGate'], fixt_simple['clientIdBasicEvent']]
        newgroup = json.dumps({'client_id': 999, 'nodeIds': nodes})
        response = self.ajaxPost(self.baseUrl + '/graphs/%u/nodegroups/' % fixt_simple['pkDFD'],
                                 newgroup,
                                 'application/json')
        self.assertEqual(response.status_code, 201)
        newgroup = response['Location']
        # Try delete
        response = self.ajaxDelete(newgroup)
        self.assertEqual(response.status_code, 204)

    def testRelocateNode(self):
        newpos = json.dumps({'properties': {"y": 3, "x": 7}})
        response = self.ajaxPatch(
                    self.baseUrl + '/graphs/%u/nodes/%u' % (fixt_simple['pkFaultTree'], fixt_simple['clientIdBasicEvent']),
                    newpos,
                    "application/json")
        self.assertEqual(response.status_code, 202)

    def testNodePropertyChange(self):
        newprop = json.dumps({"properties": {"key": "foo", "value": "bar"}})
        response = self.ajaxPatch(self.baseUrl + '/graphs/%u/nodes/%u' % (fixt_simple['pkFaultTree'], fixt_simple['clientIdBasicEvent']),
                                  newprop,
                                  "application/json")
        self.assertEqual(response.status_code, 202)
        #TODO: Fetch graph and check that the property is really stored


    def testNodeGroupPropertyChange(self):
        #TODO: Fixture should have a node group, instead of creating it here
        nodes = [fixt_simple['clientIdAndGate'], fixt_simple['clientIdBasicEvent']]
        newgroup = json.dumps({'client_id': 999, 'nodeIds': nodes})
        response = self.ajaxPost(self.baseUrl + '/graphs/%u/nodegroups/' % fixt_simple['pkDFD'],
                                 newgroup,
                                 'application/json')
        self.assertEqual(response.status_code, 201)
        newgroup = response['Location']
        # Try changing
        newprop = json.dumps({"properties": {"key": "foo", "value": "bar"}})
        response = self.ajaxPatch(newgroup,
                                  newprop,
                                  "application/json")
        self.assertEqual(response.status_code, 202)
        #TODO: Fetch graph and check that the property is really stored


    def testEdgePropertyChange(self):
        newprop = json.dumps({"properties": {"key": "foo", "value": "bar"}})
        response = self.ajaxPatch(self.baseUrl + '/graphs/%u/edges/%u' % (fixt_simple['pkDFD'], fixt_simple['clientIdEdge']),
                                  newprop,
                                  "application/json")
        self.assertEqual(response.status_code, 202)
        #TODO: Fetch graph and check that the property is really stored

    def testDeleteEdge(self):
        response = self.ajaxDelete(
            self.baseUrl + '/graphs/%u/edges/%u' % (fixt_simple['pkFaultTree'], fixt_simple['clientIdEdge']))
        self.assertEqual(response.status_code, 204)

    def testCreateEdge(self):
        newedge = json.dumps(
            {   'client_id': 4714, 
                'source': fixt_simple['clientIdAndGate'], 
                'target': fixt_simple['clientIdBasicEvent']
            }
        )
        response = self.ajaxPost(self.baseUrl + '/graphs/%u/edges/' % fixt_simple['pkFaultTree'],
                                 newedge,
                                 'application/json')
        self.assertEqual(response.status_code, 201)

    def testNotificationDismiss(self):
        # Create notification entry in the database
        u = User.objects.get(username='testadmin')
        n = Notification(title="Test notification")
        n.save()
        n.users.add(u)
        n.save()
        # Now check the dismiss call
        response = self.ajaxDelete(self.baseUrl + '/notification/%u/' % n.pk)
        self.assertEqual(response.status_code, 204)


class AnalysisInputFilesTestCase(FuzzEdTestCase):
    """
        These are tests based on the analysis engine input files in fixture/analysis.
        They only test if the analysis engine crashes on them.
        The may later be translated to real tests with some expected output.
    """

    @unittest.skipUnless(sys.platform.startswith("linux"), "requires Vagrant Linux")
    def testFileAnalysis(self):
        for root, dirs, files in os.walk('FuzzEd/fixtures/analysis'):
            for f in files:
                fname = root + os.sep + f
                print "Testing " + fname
                retcode = subprocess.call('backends/lib/ftanalysis_exe %s /tmp/output.xml /tmp' % (fname), shell=True)
                self.assertEqual(retcode, 0, fname + " failed")
                dom = parse('/tmp/output.xml')

class BackendDaemonFromFrontendTestCase(FuzzEdTestCase):
    """
        Tests for backend functionality, as being triggered from frontend calls.
        This demands firing up the backend daemon in the setup phase.
    """

    baseUrl = '/api/front'

    def setUp(self):
        # Start up backend daemon in testing mode so that it uses port 8081 of the live test server
        print "Starting backend daemon"
        os.chdir("backends")
        self.backend = Popen(["python", "daemon.py", "--testing"])
        time.sleep(2)
        os.chdir("..")
        self.setUpLogin()

    def tearDown(self):
        print "\nShutting down backend daemon"
        self.backend.terminate()


class AnalysisFixtureTestCase(BackendDaemonFromFrontendTestCase):
    """
        This is a base class that wraps all information about the 'analysis' fixture.
        Don't add new fixtures here. Either load - modify - save the existing fixture file,
        or create a new class for your new fixture.
    """
    fixtures = fixt_analysis['files']

    @unittest.skipUnless(sys.platform.startswith("linux"), "requires Vagrant Linux")
    def testRateFaulttree(self):
        response = self.requestJob(self.baseUrl, self.rate_faulttree, 'topevent')
        result = json.loads(response.content)
        self.assertEqual(bool(result['validResult']), True)
        self.assertEqual(result['errors'], {})
        self.assertEqual(result['warnings'], {})
        self.assertEqual(result['configurations'][0]['peak'], 1.0)

    @unittest.skipUnless(sys.platform.startswith("linux"), "requires Vagrant Linux")
    def testPRDCFuzztree(self):
        response = self.requestJob(self.baseUrl, self.prdc_fuzztree, 'topevent')
        print response.content
        result = json.loads(response.content)
        self.assertEqual(bool(result['validResult']), True)
        self.assertEqual(result['errors'], {})
        self.assertEqual(result['warnings'], {})
        self.assertEqual(len(result['configurations']), fixt_analysis['prdc_configurations'])
        for conf in result['configurations']:
            assert (round(conf['peak'], 5) in self.prdc_peaks)

    def testFrontendAPIPdfExport(self):
        for graphPk, graphType in fixt_analysis['graphs'].iteritems():
            pdf = self.requestJob(self.baseUrl, graphPk, 'pdf')
            # The result of a PDF rendering job is the download link
            self.assertEqual('application/pdf', pdf['CONTENT-TYPE'])

    @unittest.skipUnless(sys.platform.startswith("linux"), "requires Vagrant Linux")
    def testFrontendAPIEpsExport(self):
        for graph in self.graphs:
            eps = self.requestJob(self.baseUrl, graph, 'eps')
            self.assertEqual('application/postscript', eps['CONTENT-TYPE'])


class MinCutFixtureTestCase(BackendDaemonFromFrontendTestCase):
    """
        This is a base class that wraps all information about the 'mincut' fixture.
        Don't add new fixtures here. Either load - modify - save the existing fixture file,
        or create a new class for your new fixture.
    """
    fixtures = fixt_mincut['files']

    @unittest.skipUnless(sys.platform.startswith("linux"), "requires Vagrant Linux")
    def testMincutFaulttree(self):
        response = self.requestJob(self.baseUrl, fixt_mincut['mincut_faulttree'], 'topevent')
        result = json.loads(response.content)
        self.assertEqual(bool(result['validResult']), True)
        self.assertEqual(result['errors'], {})
        self.assertEqual(result['warnings'], {})
        # TODO: self.assertEqual(len(result['mincutResults']), 3)

class UnicodeTestCase(FuzzEdTestCase):
    fixtures = fixt_unicode['files']

    def setUp(self):
        self.setUpLogin()

    def testTikzSerialize(self):
        g = Graph.objects.get(pk=fixt_unicode['pkFaultTree'])
        assert (len(g.to_tikz()) > 0)

