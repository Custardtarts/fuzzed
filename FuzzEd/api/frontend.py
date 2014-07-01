import json
import logging

from django import http
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect
from tastypie.authentication import SessionAuthentication
from tastypie.authorization import Authorization
from tastypie.bundle import Bundle
from tastypie.exceptions import ImmediateHttpResponse
from tastypie.http import HttpApplicationError, HttpAccepted, HttpForbidden, HttpNotFound, HttpMultipleChoices
from tastypie import fields
from django.core.mail import mail_managers
from tastypie.resources import ModelResource
from tastypie.serializers import Serializer

from FuzzEd.models import Job, Graph, Notification, Node, NodeGroup, Edge, Result
import common

logger = logging.getLogger('FuzzEd')

class GraphOwnerAuthorization(Authorization):
    """
        A tastypie authorization class that checks if the 'graph' attribute
        links to a graph that is owned by the requesting user.
    """

    def read_list(self, object_list, bundle):
        return object_list.filter(graph__owner=bundle.request.user)

    def read_detail(self, object_list, bundle):
        return bundle.obj.graph.owner == bundle.request.user

    def create_list(self, object_list, bundle):
        # Assuming they're auto-assigned to graphs that are owned by the requester
        return object_list

    def create_detail(self, object_list, bundle):
        #graph = Graph.objects.get(pk=bundle.data['graph'], deleted=False)
        return bundle.data['graph'].owner == bundle.request.user and not bundle.data['graph'].read_only

    def update_list(self, object_list, bundle):
        allowed = []
        # Since they may not all be saved, iterate over them.
        for obj in object_list:
            if obj.graph.owner == bundle.request.user and not bundle.obj.graph.read_only:
                allowed.append(obj)
        return allowed

    def update_detail(self, object_list, bundle):
        return bundle.obj.graph.owner == bundle.request.user and not bundle.obj.graph.read_only

    def delete_list(self, object_list, bundle):
        return object_list.filter(graph__owner=bundle.request.user)

    def delete_detail(self, object_list, bundle):
        return bundle.obj.graph.owner == bundle.request.user

class JobResource(common.JobResource):
    """
        An API resource for jobs.
        Jobs look different for the JS client than they look for the backend,
        so we have a custom implementation here.
    """

    class Meta:
        queryset = Job.objects.all()
        authorization = GraphOwnerAuthorization()
        authentication = SessionAuthentication()
        list_allowed_methods = ['post']
        detail_allowed_methods = ['get']

    graph = fields.ToOneField('FuzzEd.api.common.GraphResource', 'graph')

    def get_resource_uri(self, bundle_or_obj=None, url_name='api_dispatch_list'):
        """
            Since we change the API URL format to nested resources, we need also to
            change the location determination for a given resource object.
        """
        job_secret = bundle_or_obj.obj.secret
        graph_pk = bundle_or_obj.obj.graph.pk
        return reverse('job', kwargs={'api_name': 'front', 'pk': graph_pk, 'secret': job_secret})

    def obj_create(self, bundle, **kwargs):
        """
            Create a new job for the given graph.
            The request body contains the information about the kind of job being requested.
            The result is a job URL that is based on the generated job secret.
            This is the only override that allows us to access 'kwargs', which contains the
            graph_id from the original request.
        """
        graph = Graph.objects.get(pk=kwargs['graph_id'], deleted=False)
        # Check if we have a cached result, and deliver this job
        job = Job.exists_with_result(graph=graph, kind=bundle.data['kind'])
        if not job:
            # We need a truly new job
            bundle.data['graph'] = graph
            bundle.data['graph_modified'] = graph.modified
            bundle.data['kind'] = bundle.data['kind']
            bundle.obj = self._meta.object_class()
            bundle = self.full_hydrate(bundle)
            return self.save(bundle)
        else:
            logger.debug("Responding with cached job URL, instead of creating a new one")
            bundle.obj = job
            return bundle

    def get_detail(self, request, **kwargs):
        """
            Called by the request dispatcher in case somebody tries to GET a job resource.
            For the frontend, deliver the current job status if pending, or the result.
        """
        basic_bundle = self.build_bundle(request=request)
        try:
            job = self.cached_obj_get(bundle=basic_bundle, **self.remove_api_resource_names(kwargs))
        except ObjectDoesNotExist:
            return http.HttpNotFound()
        except MultipleObjectsReturned:
            return http.HttpMultipleChoices("More than one resource is found at this URI.")

        if job.done():
            if job.exit_code == 0:
                response = {}
                # We deliver the columns layout for the result tables + all global issues
                results_url = reverse('results', kwargs={'api_name': 'front', 'pk': job.graph.pk, 'secret': job.secret})
                if not job.requires_download:
                    response['columns'] = [{'mData': key, 'sTitle': title} for key, title in job.result_titles ]
                try:
                    response['issues'] = Result.objects.get(job=job, kind=Result.GRAPH_ISSUES).issues                
                except:
                    # no global issues recorded, that's fine                
                    pass
                response = HttpResponse(json.dumps(response))
                response["Location"] = results_url
                return response
            else:
                logger.debug("Job is done, but with non-zero exit code.")
                mail_managers('Job %s for graph %u ended with non-zero exit code %u.' % (job.pk, job.graph.pk, job.exit_code), job.graph.to_xml())
                return HttpApplicationError()
        else:
            # Job is pending, tell this by HTTP return code
            return HttpAccepted()

    def apply_authorization_limits(self, request, object_list):
        # Prevent cross-checking of jobs by different users
        return object_list.filter(graph__owner=request.user)

class NotificationResource(ModelResource):
    """
        An API resource for notifications.
    """

    class Meta:
        queryset = Notification.objects.all()
        detail_allowed_methods = ['delete']
        authentication = SessionAuthentication()

    def obj_delete(self, bundle, **kwargs):
        noti = self.obj_get(bundle=bundle, **kwargs)
        noti.users.remove(bundle.request.user)
        noti.save()

class NodeSerializer(Serializer):
    """
        Our custom node serializer. Using the default serializer would demand that the
        graph reference is included, while we take it from the nested resource URL.
    """
    formats = ['json']
    content_types = {
        'json': 'application/json'
    }

    def from_json(self, content):
        data_dict = json.loads(content)
        if 'properties' in data_dict:
            props = data_dict['properties']
            for key, val in props.iteritems():
                # JS code: {'prop_name': {'value':'prop_value'}}
                # All others: {'prop_name': 'prop_value'}
                if isinstance(val, dict) and 'value' in val:
                    props[key] = val['value']
        return data_dict

    def to_json(self, data):
        return json.dumps(data)

class NodeResource(ModelResource):
    """
        An API resource for nodes.
    """

    class Meta:
        queryset = Node.objects.filter(deleted=False)
        authorization = GraphOwnerAuthorization()
        authentication = SessionAuthentication()
        serializer = NodeSerializer()
        list_allowed_methods = ['get', 'post']
        detail_allowed_methods = ['get', 'post', 'patch', 'delete']
        excludes = ['deleted', 'id']

    graph = fields.ToOneField('FuzzEd.api.common.GraphResource', 'graph')

    def get_resource_uri(self, bundle_or_obj):
        """
            Since we change the API URL format to nested resources, we need also to
            change the location determination for a given resource object.
        """
        node_client_id = bundle_or_obj.obj.client_id
        graph_pk = bundle_or_obj.obj.graph.pk
        return reverse('node', kwargs={'api_name': 'front', 'pk': graph_pk, 'client_id': node_client_id})

    def obj_create(self, bundle, **kwargs):
        """
             This is the only override that allows us to access 'kwargs', which contains the
             graph_id from the original request.
        """
        bundle.data['graph'] = Graph.objects.get(pk=kwargs['graph_id'], deleted=False)
        bundle.obj = self._meta.object_class()
        bundle = self.full_hydrate(bundle)
        bundle.obj.save()   # Save node, so that set_attr has something to relate to
        if 'properties' in bundle.data:
            bundle.obj.set_attrs(bundle.data['properties'])            
        return self.save(bundle)

    def patch_detail(self, request, **kwargs):
        """
            Updates a resource in-place. We could also override obj_update, which is
            the Tastypie intended-way of having a custom PATCH implementation, but this
            method gets a full updated object bundle that is expected to be directly written
            to the object. In this method, we still have access to what actually really
            comes as part of the update payload.

            If the resource is updated, return ``HttpAccepted`` (202 Accepted).
            If the resource did not exist, return ``HttpNotFound`` (404 Not Found).
        """
        try:
            # Fetch relevant node object as Tastypie does it
            basic_bundle = self.build_bundle(request=request)
            obj = self.cached_obj_get(bundle=basic_bundle, **self.remove_api_resource_names(kwargs))
        except ObjectDoesNotExist:
            return http.HttpNotFound()
        except MultipleObjectsReturned:
            return http.HttpMultipleChoices("More than one resource is found at this URI.")

        # Deserialize incoming update payload JSON from request
        deserialized = self.deserialize(request, request.body,
                                        format=request.META.get('CONTENT_TYPE', 'application/json'))
        if 'properties' in deserialized:
            obj.set_attrs(deserialized['properties'])            
        # return the updated node object
        return HttpResponse(obj.to_json(), 'application/json', status=202)

class NodeGroupSerializer(Serializer):
    """
        Our custom node group serializer. Using the default serializer would demand that the
        graph reference is included, while we take it from the nested resource URL.
    """
    formats = ['json']
    content_types = {
        'json': 'application/json'
    }

    def from_json(self, content):
        data_dict = json.loads(content)
        if 'properties' in data_dict:
            props = data_dict['properties']
            for key, val in props.iteritems():
                # JS code: {'prop_name': {'value':'prop_value'}}
                # All others: {'prop_name': 'prop_value'}
                if isinstance(val, dict) and 'value' in val:
                    props[key] = val['value']
        return data_dict

    def to_json(self, data):
        return json.dumps(data)


class NodeGroupResource(ModelResource):
    '''
        An API resource for node groups.
    '''

    class Meta:
        queryset = NodeGroup.objects.filter(deleted=False)
        authorization = GraphOwnerAuthorization()
        authentication = SessionAuthentication()        
        serializer = NodeGroupSerializer()
        list_allowed_methods = ['post']
        detail_allowed_methods = ['delete', 'patch']
        excludes = ['deleted']

    graph = fields.ToOneField('FuzzEd.api.common.GraphResource', 'graph')

    def get_resource_uri(self, bundle_or_obj):
        """
            Since we change the API URL format to nested resources, we need also to
            change the location determination for a given resource object.
        """
        group_client_id = bundle_or_obj.obj.client_id
        graph_pk = bundle_or_obj.obj.graph.pk
        return reverse('nodegroup', kwargs={'api_name': 'front', 'pk': graph_pk, 'client_id': group_client_id})

    def obj_create(self, bundle, **kwargs):
        """
            The method called by the dispatcher when a NodeGroup resource is created.

            This is the only override that allows us to access 'kwargs', which contains the
            graph_id from the original request.
        """
        try:
            bundle.data['graph'] = Graph.objects.get(pk=kwargs['graph_id'], deleted=False)
        except:
            raise ImmediateHttpResponse(response=HttpForbidden("You can't use this graph."))
        bundle.obj = self._meta.object_class()
        bundle = self.full_hydrate(bundle)
        bundle = self.save(bundle)  # Prepare ManyToMany relationship
        for node_id in bundle.data['nodeIds']:
            try:
                # The client may refer to nodes that are already gone,
                # we simply ignore them
                node = Node.objects.get(graph=bundle.data['graph'], client_id=node_id, deleted=False)
                bundle.obj.nodes.add(node)
            except ObjectDoesNotExist:
                pass
        if 'properties' in bundle.data:
            bundle.obj.set_attrs(bundle.data['properties'])
        bundle.obj.save()
        return self.save(bundle)

    def patch_detail(self, request, **kwargs):
        """
            Updates a resource in-place. We could also override obj_update, which is
            the Tastypie intended-way of having a custom PATCH implementation, but this
            method gets a full updated object bundle that is expected to be directly written
            to the object. In this method, we still have access to what actually really
            comes as part of the update payload.

            If the resource is updated, return ``HttpAccepted`` (202 Accepted).
            If the resource did not exist, return ``HttpNotFound`` (404 Not Found).
        """
        try:
            # Fetch relevant node object as Tastypie does it
            basic_bundle = self.build_bundle(request=request)
            obj = self.cached_obj_get(bundle=basic_bundle, **self.remove_api_resource_names(kwargs))
        except ObjectDoesNotExist:
            return http.HttpNotFound()
        except MultipleObjectsReturned:
            return http.HttpMultipleChoices("More than one resource is found at this URI.")

        # Deserialize incoming update payload JSON from request
        deserialized = self.deserialize(request, request.body,
                                        format=request.META.get('CONTENT_TYPE', 'application/json'))
        if 'properties' in deserialized:
            obj.set_attrs(deserialized['properties'])
        if 'nodeIds' in deserialized:
            logger.debug("Updating nodes for node group")
            obj.nodes.clear()    # nodes_set is magically created by Django
            node_objects = Node.objects.filter(deleted=False, graph=obj.graph, client_id__in=deserialized['nodeIds'])
            obj.nodes = node_objects
            obj.save()

        # return the updated node group object
        return HttpResponse(obj.to_json(), 'application/json', status=202)

class EdgeSerializer(Serializer):
    """
        Our custom edge serializer. Using the default serializer would demand that the
        graph reference is included, while we take it from the nested resource URL.
        It would also demand that nodes are referenced by their full URL's, which we do not
        do.
    """
    formats = ['json']
    content_types = {
        'json': 'application/json'
    }

    def from_json(self, content):
        data_dict = json.loads(content)
        if 'properties' in data_dict:
            props = data_dict['properties']
            for key, val in props.iteritems():
                # JS code: {'prop_name': {'value':'prop_value'}}
                # All others: {'prop_name': 'prop_value'}
                if isinstance(val, dict) and 'value' in val:
                    props[key] = val['value']
        return data_dict

class EdgeResource(ModelResource):
    """
        An API resource for edges.
    """

    class Meta:
        queryset = Edge.objects.filter(deleted=False)
        serializer = EdgeSerializer()
        authorization = GraphOwnerAuthorization()
        authentication = SessionAuthentication()        
        list_allowed_methods = ['get', 'post']
        detail_allowed_methods = ['get', 'post', 'delete', 'patch']
        excludes = ['deleted', 'id']

    graph = fields.ToOneField('FuzzEd.api.common.GraphResource', 'graph')
    source = fields.ToOneField(NodeResource, 'source')
    target = fields.ToOneField(NodeResource, 'target')

    def get_resource_uri(self, bundle_or_obj):
        """
            Since we change the API URL format to nested resources, we need also to
            change the location determination for a given resource object.
        """
        edge_client_id = bundle_or_obj.obj.client_id
        graph_pk = bundle_or_obj.obj.graph.pk
        return reverse('edge', kwargs={'api_name': 'front', 'pk': graph_pk, 'client_id': edge_client_id})

    def obj_create(self, bundle, **kwargs):
        """
         This is the only override that allows us to access 'kwargs', which contains the
         graph_id from the original request.
        """
        graph = Graph.objects.get(pk=kwargs['graph_id'], deleted=False)
        bundle.data['graph'] = graph
        bundle.data['source'] = Node.objects.get(client_id=bundle.data['source'], graph=graph, deleted=False)
        bundle.data['target'] = Node.objects.get(client_id=bundle.data['target'], graph=graph, deleted=False)
        bundle.obj = self._meta.object_class()
        bundle = self.full_hydrate(bundle)
        bundle.obj.save()       # to allow property changes
        if 'properties' in bundle.data:
            bundle.obj.set_attrs(bundle.data['properties'])
        return self.save(bundle)

    def patch_detail(self, request, **kwargs):
        """
            Updates a resource in-place. We could also override obj_update, which is
            the Tastypie intended-way of having a custom PATCH implementation, but this
            method gets a full updated object bundle that is expected to be directly written
            to the object. In this method, we still have access to what actually really
            comes as part of the update payload.

            If the resource is updated, return ``HttpAccepted`` (202 Accepted).
            If the resource did not exist, return ``HttpNotFound`` (404 Not Found).
        """
        try:
            # Fetch relevant node object as Tastypie does it
            basic_bundle = self.build_bundle(request=request)
            obj = self.cached_obj_get(bundle=basic_bundle, **self.remove_api_resource_names(kwargs))
        except ObjectDoesNotExist:
            return HttpNotFound()
        except MultipleObjectsReturned:
            return HttpMultipleChoices("More than one resource is found at this URI.")

        # Deserialize incoming update payload JSON from request
        deserialized = self.deserialize(request, request.body,
                                        format=request.META.get('CONTENT_TYPE', 'application/json'))
        if 'properties' in deserialized:
            obj.set_attrs(deserialized['properties'])
        # return the updated edge object
        return HttpResponse(obj.to_json(), 'application/json', status=202)

class ProjectResource(common.ProjectResource):
    class Meta(common.ProjectResource.Meta):
        authentication = SessionAuthentication()


class GraphSerializer(common.GraphSerializer):
    """
        The frontend gets its own JSON format for the graph information,
        not the default HATEOAS format generated by Tastypie. For this reason,
        we need a frontend API specific JSON serializer.
    """

    def to_json(self, data, options=None):
        if isinstance(data, Bundle):
            return data.obj.to_json(use_value_dict=True)
        elif isinstance(data, dict):
            if 'objects' in data:               # object list
                graphs = []
                for graph in data['objects']:
                    graphs.append({'url': reverse('graph', kwargs={'api_name': 'front', 'pk': graph.obj.pk}),
                                   'name': graph.obj.name})
                return json.dumps({'graphs': graphs})
            else:
                # Traceback error message, instead of a result
                return json.dumps(data)


class GraphResource(common.GraphResource):
    """
        Override our GraphResource Meta class to register the custom
        frontend JSON serializer and the frontent auth method.
        This version also configures the dispatching to the nested resource implementations in this file.
    """

    class Meta(common.GraphResource.Meta):
        authentication = SessionAuthentication()
        serializer = GraphSerializer()
        nodes = fields.ToManyField(NodeResource, 'nodes')
        edges = fields.ToManyField(EdgeResource, 'edges')

    def dispatch_edges(self, request, **kwargs):
        edge_resource = EdgeResource()
        return edge_resource.dispatch_list(request, graph_id=kwargs['pk'])

    def dispatch_edge(self, request, **kwargs):
        edge_resource = EdgeResource()
        return edge_resource.dispatch_detail(request, graph_id=kwargs['pk'], client_id=kwargs['client_id'])

    def dispatch_nodes(self, request, **kwargs):
        node_resource = NodeResource()
        return node_resource.dispatch_list(request, graph_id=kwargs['pk'])

    def dispatch_node(self, request, **kwargs):
        node_resource = NodeResource()
        return node_resource.dispatch_detail(request, graph_id=kwargs['pk'], client_id=kwargs['client_id'])

    def dispatch_nodegroups(self, request, **kwargs):
        nodegroup_resource = NodeGroupResource()
        return nodegroup_resource.dispatch_list(request, graph_id=kwargs['pk'])

    def dispatch_nodegroup(self, request, **kwargs):
        nodegroup_resource = NodeGroupResource()
        return nodegroup_resource.dispatch_detail(request, graph_id=kwargs['pk'], client_id=kwargs['client_id'])

    def dispatch_jobs(self, request, **kwargs):
        job_resource = JobResource()
        return job_resource.dispatch_list(request, graph_id=kwargs['pk'])

    def dispatch_job(self, request, **kwargs):
        job_resource = JobResource()
        return job_resource.dispatch_detail(request, graph_id=kwargs['pk'], secret=kwargs['secret'])

    def dispatch_results(self, request, **kwargs):
        result_resource = ResultResource()
        return result_resource.dispatch_list(request, graph_id=kwargs['pk'], secret=kwargs['secret'])


class ResultResource(ModelResource):
    """
        An API resource for results.
    """
    class Meta:
        queryset = Result.objects.all()
        authorization = GraphOwnerAuthorization()
        authentication = SessionAuthentication()
        list_allowed_methods = ['get']

    def get_list(self, request, **kwargs):
        """
            Called by the request dispatcher in case somebody tries to GET result resources
            for a particular job.
        """
        job = Job.objects.get(secret=kwargs['secret'], graph=kwargs['graph_id'])

        if job.requires_download:
            return job.result_download()

        # It is an analysis result
        #import pdb; pdb.set_trace()

        # Determine options given by data tables
        start  = int(request.GET.get('iDisplayStart', 0))
        length = int(request.GET.get('iDisplayLength', 10))
        sort_cols = int(request.GET.get('iSortingCols',0))
        # Create sorted QuerySet
        sort_fields = []
        for i in range(sort_cols):
            # Consider strange datatables way of expressing sorting criteria
            sort_col = int(request.GET['iSortCol_'+str(i)]) 
            
            if (request.GET['bSortable_'+ str(sort_col)] == 'true'):
                sort_dir = request.GET['sSortDir_'+str(i)] 
                db_field_name=job.result_titles[sort_col - 1][0] # first column is not sent from the backend
                logger.debug("Sorting result set for "+db_field_name)
                if sort_dir == "desc":
                    db_field_name = "-"+db_field_name          
                sort_fields.append(db_field_name)
                
        results = job.results.all().exclude(kind=Result.GRAPH_ISSUES)
        if len(sort_fields) > 0:
            results = results.order_by(*sort_fields)
        all_count = results.count()
        results = results[start:start+length]

        assert('sEcho' in request.GET)
        response_data = {
                            "sEcho": request.GET['sEcho'],
                            "iTotalRecords": all_count,
                            "iTotalDisplayRecords": all_count
                        }    
        response_data['aaData'] = [result.to_dict() for result in results]
        logger.debug("Delivering result data: "+str(response_data))
        return HttpResponse(json.dumps(response_data), content_type="application/json")

    






