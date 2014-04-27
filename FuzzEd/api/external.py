#from oauth2_provider.views.generic import ProtectedResourceView        see urls.py for further explanation

from FuzzEd.models import Graph, Project

import logging, common
logger = logging.getLogger('FuzzEd')

class GraphResource(common.GraphResource):
    class Meta:
        queryset = Graph.objects.filter(deleted=False)
        authentication = common.OurApiKeyAuthentication()
        authorization = common.GraphAuthorization()
        allowed_methods = ['get', 'post']
        serializer = common.GraphSerializer()
        excludes = ['deleted', 'owner', 'read_only']

class GraphSerializer(common.GraphSerializer):
    pass

class ProjectResource(common.ProjectResource):
    class Meta:
        queryset = Project.objects.filter(deleted=False)
        authentication = common.OurApiKeyAuthentication()
        list_allowed_methods = ['get']
        detail_allowed_methods = ['get']
        excludes = ['deleted', 'owner']
        nested = 'graph'


# class GraphJobExportView(ProtectedResourceView):
#     """ Base class for API views that export a graph based on a rendering job result. """
#     export_format = None
#     def get(self, request, *args, **kwargs):
#         assert('graph_id' in kwargs)
#         graph_id = int(kwargs['graph_id'])
#         job = api.job_create(request.user, graph_id, self.export_format)
#         while not job.done():
#             # TODO: Move this to central settings.ini
#             time.sleep(2)
#         status, job = api.job_status(request.user, job.pk)
#         if status == 0:
#             return api.graph_download(request.user, graph_id, self.export_format)
#         else:
#             raise HttpResponseServerErrorAnswer("Internal error, could not create file. Try the web frontend.")

