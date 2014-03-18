"""
    This is the API for everybody else beside the frontend. 
    Access restrictions here are managed by Tastypie's API key.
"""

#from oauth2_provider.views.generic import ProtectedResourceView        see urls.py for further explanation
from FuzzEd.middleware import HttpResponseServerErrorAnswer
from tastypie.resources import ModelResource
from tastypie.authentication import ApiKeyAuthentication   
from tastypie.authorization import Authorization
from tastypie.exceptions import Unauthorized
from tastypie.serializers import Serializer
from tastypie import fields
from FuzzEd.models import Project, Graph

import time


class ProjectResource(ModelResource):
    graphs = fields.ToManyField('FuzzEd.api_ext.GraphResource', 'graphs')

    class Meta:
        queryset = Project.objects.filter(deleted=False)
        authentication = ApiKeyAuthentication()
        list_allowed_methods = ['get']
        detail_allowed_methods = ['get']
        excludes = ['deleted', 'owner']
        nested = 'graph'


    def get_object_list(self, request):
        return super(ProjectResource, self).get_object_list(request).filter(owner=request.user)

class GraphSerializer(Serializer):
    """
        Our custom serializer / deserializer for graph formats we support.
        The XML format is GraphML, anything else is not supported.
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
        #TODO: Perform some real importing
        return Graph.from_graphml(content).to_dict()

class GraphAuthorization(Authorization):
    #TODO: Consider project ownership here for create requests
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
        raise Unauthorized("Sorry, no deletes.")

    def delete_detail(self, object_list, bundle):
        raise Unauthorized("Sorry, no deletes.")    


class GraphResource(ModelResource):
    class Meta:
        queryset = Graph.objects.filter(deleted=False)
        authentication = ApiKeyAuthentication()
        authorization = GraphAuthorization()
        allowed_methods = ['get', 'post']
        serializer = GraphSerializer()
        excludes = ['deleted', 'owner', 'read_only']

    project = fields.ToOneField(ProjectResource, 'project')

    def get_object_list(self, request):
        return super(GraphResource, self).get_object_list(request).filter(owner=request.user)

    def hydrate(self, bundle):
        bundle.obj.owner=bundle.request.user
        #TODO: Make sure that users can only save to their own projects
        bundle.obj.project=Project.objects.get(pk=bundle.request.GET['project'])
        return bundle

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

