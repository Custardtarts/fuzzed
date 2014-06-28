from FuzzEd.models import Graph
from common import fixt_simple, FuzzEdTestCase

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

    def testBulkGraphCopy(self):
        response = self.post('/projects/%u/dashboard/edit/' % fixt_simple['pkProject'],
                             {'copy': 'copy', 'graph_id[]': fixt_simple['graphs']})
        self.assertEqual(response.status_code, 302)

    def testSingleGraphCopy(self):
        for graphid, kind in fixt_simple['graphs'].iteritems():
            response = self.post('/projects/%u/dashboard/edit/' % fixt_simple['pkProject'],
                                 {'copy': 'copy', 'graph_id[]': graphid})
            self.assertEqual(response.status_code, 302)
            # The view code has no reason to return the new graph ID, so the redirect is to the dashboard
            # We therefore determine the new graph by the creation time
            copy = Graph.objects.all().order_by('-created')[0]
            original = Graph.objects.get(pk=graphid)
            self.assertTrue(original.same_as(copy))
