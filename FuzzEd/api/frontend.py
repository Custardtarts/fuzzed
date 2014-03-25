"""
    This is the API for the web frontend. 
    Access restrictions are managed by Django session handling.

    Only frontend-specific functionality should be implemented in here, mainly everything that revolves
    around URL handling. 
"""

from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from FuzzEd.decorators import require_ajax
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.core.urlresolvers import reverse
from FuzzEd.middleware import HttpResponse, HttpResponseAccepted
from django.db import transaction
from django.views.decorators.cache import never_cache

# We expect these imports to go away main the main logic finally lives in common.py
from django.shortcuts import get_object_or_404
from FuzzEd.models import Graph, notations, commands, Node, Job, Notification
from FuzzEd.middleware import *
from django.core.exceptions import ObjectDoesNotExist, MultipleObjectsReturned
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.core.mail import mail_managers

import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('FuzzEd')


import json, common

@login_required
@csrf_exempt
@require_GET
def graph_download(request, graph_id):
    '''
        Provides a download response of the graph in the given format in the GET parameter, 
        or an HTTP error if the rendering job for the export format is not ready so far.
    '''
    export_format = request.GET.get('format', 'xml')
    if request.user.is_staff:
        graph = get_object_or_404(Graph, pk=graph_id)
    else:
        graph = get_object_or_404(Graph, pk=graph_id, owner=request.user, deleted=False)        

    response = HttpResponse()
    response['Content-Disposition'] = 'attachment; filename=%s.%s' % (graph.name, export_format)

    if export_format == 'xml':
        response.content = graph.to_xml()
        response['Content-Type'] = 'application/xml'
    elif export_format == 'graphml':
        response.content = graph.to_graphml()
        response['Content=Type'] = 'application/xml'
    elif export_format == 'json':
        response.content = graph.to_json()
        response['Content-Type'] = 'application/javascript'
    elif export_format == 'tex':
        response.content = graph.to_tikz()
        response['Content-Type'] = 'application/text'
    elif export_format in ('pdf', 'eps'):
        try:
            # Take the latest file that was successfully created
            # This is based on the assumption that nobody calls this function before the job is done
            job = graph.jobs.filter(kind=export_format).latest('created')
            if not job.done():
                raise HttpResponseNotFoundAnswer()
            response.content = job.result()
            response['Content-Type'] = 'application/pdf' if export_format == 'pdf' else 'application/postscript'
        except ObjectDoesNotExist:
            raise HttpResponseNotFoundAnswer()
    else:
        raise HttpResponseNotFoundAnswer()
    return response


    return common.graph_download(request.user, graph_id, export_format)

@login_required
@csrf_exempt
@require_GET
def job_status(request, job_id):
    ''' Returns the status information for the given job.
        202 is delivered if the job is pending, otherwise the result is immediately returned.
        The result may be the actual text data, or a download link to a binary file.
    '''
    try:
        job = Job.objects.get(pk=job_id)
        # Prevent cross-checking of jobs by different users
        assert(job.graph.owner == request.user or request.user.is_staff)
    except:
        # The job does not exist, or it shouldn't exist for this user.        
        raise HttpResponseNotFoundAnswer()

    if job.done():
        if job.exit_code == 0:
            logger.debug("Job is done.")
            return HttpResponse(job.result())
        else:
            logger.debug("Job is done, but with non-zero exit code.")
            mail_managers('Analysis of job %s ended with non-zero exit code.'%job.pk, job.graph.to_xml() )
            raise HttpResponseServerErrorAnswer("We have an internal problem analyzing this graph. Sorry! The developers are informed.")
    else:       
        return HttpResponseAccepted()
        
# hard-coded json response for DataTables plugin        
@login_required
@csrf_exempt
@require_http_methods(['GET'])
def job_status_test(request):
    ''' Returns the status information for the given job.
        202 is delivered if the job is pending, otherwise the result is immediately returned.
    '''
    
    # get values transmitted by DataTables plugin (http://datatables.net/usage/server-side)
    GET = request.GET
   
    sEcho = int(GET['sEcho'])  # needs to be send back to the website (as integer)
    displayStart =  GET['iDisplayStart']  # starting point in the current data set (from 0 to n-1)
    displayLength = GET['iDisplayLength'] # number of records that shall be returned to the frontend (table)
    
    
    # number of total records in the database
    totalRecords = 30
    
    response_data = {
        "sEcho" : sEcho,
        "iTotalRecords" : totalRecords,
        "iTotalDisplayRecords": totalRecords,
        "aaData": [{"ratio": 0.96, "min": 0.96, "max": 0.96, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 2}}, "costs": 1, "peak": 0.96, "id": "#0", "points": [[0.96, 1.0], [0.96, 1.0]]}, {"ratio": 0.896, "min": 0.896, "max": 0.896, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 3}}, "costs": 1, "peak": 0.896, "id": "#1", "points": [[0.896, 1.0], [0.896, 1.0]]}, {"ratio": 0.8192, "min": 0.8192, "max": 0.8192, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 4}}, "costs": 1, "peak": 0.8192, "id": "#2", "points": [[0.8192, 1.0], [0.8192, 1.0]]}, {"ratio": 0.73728, "min": 0.73728, "max": 0.73728, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 5}}, "costs": 1, "peak": 0.73728, "id": "#3", "points": [[0.73728, 1.0], [0.73728, 1.0]]}, {"ratio": 0.65536, "min": 0.65536, "max": 0.65536, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 6}}, "costs": 1, "peak": 0.65536, "id": "#4", "points": [[0.65536, 1.0], [0.65536, 1.0]]}, {"ratio": 0.5767168, "min": 0.5767168, "max": 0.5767168, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 7}}, "costs": 1, "peak": 0.5767168, "id": "#5", "points": [[0.5767168, 1.0], [0.5767168, 1.0]]}, {"ratio": 0.50331648, "min": 0.50331648, "max": 0.50331648, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 8}}, "costs": 1, "peak": 0.50331648, "id": "#6", "points": [[0.50331648, 1.0], [0.50331648, 1.0]]}, {"ratio": 0.436207616, "min": 0.436207616, "max": 0.436207616, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 9}}, "costs": 1, "peak": 0.436207616, "id": "#7", "points": [[0.436207616, 1.0], [0.436207616, 1.0]]}, {"ratio": 0.3758096384, "min": 0.3758096384, "max": 0.3758096384, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 10}}, "costs": 1, "peak": 0.3758096384, "id": "#8", "points": [[0.3758096384, 1.0], [0.3758096384, 1.0]]}, {"ratio": 0.3221225472, "min": 0.3221225472, "max": 0.3221225472, "choices": {"1390471480708": {"type": "RedundancyChoice", "n": 11}}, "costs": 1, "peak": 0.3221225472, "id": "#9", "points": [[0.3221225472, 1.0], [0.3221225472, 1.0]]}]
    }
    print json.dumps(response_data)
    
    return HttpResponse(json.dumps(response_data), content_type="application/json")
        
@login_required
@csrf_exempt
@require_GET
def job_create(request, graph_id, job_kind):
    '''
        Starts a job of the given kind for the given graph.
        It is intended to return immediately with job information for the frontend.
    '''
    job = common.job_create(request.user, graph_id, job_kind)
    response = HttpResponse(status=201)
    response['Location'] = reverse('frontend_job_status', args=[job.pk])
    return response

@login_required
@csrf_exempt
@require_ajax
@require_http_methods(['GET'])
@transaction.commit_on_success
@never_cache
def graphs(request):
    """
    Function: graphs
    
    This API handler is responsible for all graphs of the user. 
    
    Request Parameters: None
    Response:           200 - <GRAPHS_AS_JSON>
                               
    Parameters:
     {HTTPRequest} request  - django request object
                              
    Returns:
     {HTTPResponse} a django response object
    """
    graphs      = Graph.objects.filter(owner=request.user, deleted=False)
    json_graphs = {
        'graphs': [graph.to_dict() for graph in graphs]
    }
    return HttpResponse(json.dumps(json_graphs), 'application/javascript')

@login_required
@csrf_exempt
@require_ajax
@require_GET
@never_cache
def graph(request, graph_id):
    """
    Function: graph
    
    The function provides the JSON serialized version of the graph with the provided id given that the graph is owned
    by the requesting user and it is not marked as deleted.
    
    Request Parameters: None
    Response:           200 - <GRAPH_AS_JSON>
    
    Parameters:
     {HTTPRequest} request   - the django request object
     {int}         graph_id  - the id of the graph to be fetched
    
    Returns:
     {HTTPResponse} a django response object
    """
    if request.user.is_staff:
        graph = get_object_or_404(Graph, pk=graph_id)
    else:
        graph = get_object_or_404(Graph, pk=graph_id, owner=request.user, deleted=False)

    return HttpResponse(graph.to_json(), 'application/javascript')

@login_required
@csrf_exempt
@require_ajax
@require_GET
def graph_transfers(request, graph_id):
    """
    Function: graph_transfers

    Returns a list of transfers for the given graph

    Request Parameters: graph_id = <INT>
    Response:           200 - <TRANSFERS_AS_JSON>

    Parameters:
     {HTTPRequest} request  - the django request object
     {int}         graph_id - the id of the graph to get the transfers for

    Returns:
     {HTTPResponse} a django response object
    """
    transfers = []
    if request.user.is_staff:
        graph     = get_object_or_404(Graph, pk=graph_id)
    else:
        graph     = get_object_or_404(Graph, pk=graph_id, owner=request.user, deleted=False)        

    if graph.kind in ['faulttree', 'fuzztree']:
        for transfer in Graph.objects.filter(~Q(pk=graph_id), owner=request.user, kind=graph.kind, deleted=False):
            transfers.append({'id': transfer.pk, 'name': transfer.name})

    return HttpResponse(json.dumps({'transfers': transfers}), 'application/javascript', status=200)

@login_required
@csrf_exempt
@require_ajax
@require_POST
@transaction.commit_on_success
@never_cache
def nodes(request, graph_id):
    """
    Function: nodes
    
    This function creates a new node in the graph with the provided id. In order to be able to create the node four data
    items about the node are needed: its kind, its position (x and y coordinate) and an id as assigned by the client
    (calculated by the client to prevent waiting for round-trip). The response contains the JSON serialized
    representation of the newly created node and its new location URI.
    
    Request Parameters: client_id = <INT>, kind = <NODE_TYPE>, x = <INT>, y = <INT>
    Response:           201 - <NODE_AS_JSON>, Location = <NODE_URI>
    
    Parameters:
     {HTTPRequest} request   - the django request object
     {int}         graph_id  - the id of the graph where the node shall be added
    
    Returns:
     {HTTPResponse} a django response object
    """
    POST = request.POST
    if request.user.is_staff:
        graph = get_object_or_404(Graph, pk=graph_id)
    else:
        graph = get_object_or_404(Graph, pk=graph_id, owner=request.user, deleted=False)
    try:
        if graph.read_only:
            raise HttpResponseForbiddenAnswer('Trying to create a node in a read-only graph')

        kind = POST['kind']
        assert(kind in notations.by_kind[graph.kind]['nodes'])

        command = commands.AddNode.create_from(graph_id=graph_id, node_id=POST['id'],
                                               kind=kind, x=POST['x'], y=POST['y'], properties=json.loads(POST['properties']))
        command.do()
        node = command.node

        response = HttpResponse(node.to_json(), 'application/javascript', status=201)
        response['Location'] = reverse('node', args=[node.graph.pk, node.pk])
        return response

    # a int conversion of one of the parameters failed or kind is not supported by the graph
    except (ValueError, AssertionError, KeyError):
        raise HttpResponseBadRequestAnswer()

    # the looked up graph does not exist
    except ObjectDoesNotExist:
        raise HttpResponseNotFoundAnswer()

    # should never happen, but for completeness enlisted here
    except MultipleObjectsReturned:
        raise HttpResponseServerErrorAnswer()

@login_required
@csrf_exempt
@require_ajax
@require_http_methods(['DELETE', 'POST'])
@transaction.commit_on_success
@never_cache
def node(request, graph_id, node_id):
    """
    Function: node
        API handler for all actions on one specific node. This includes changing attributes of a node
        or deleting it.

        Request:            POST 
        Request Parameters: any key-value pairs of attributes that should be changed
        Response:           204 - JSON representation of the node

        Request:            DELETE 
        Request Parameters: none
        Response:           204

    Parameters:
        {HTTPRequest} request   - the django request object
        {int}         graph_id  - the id of the graph where the edge shall be added
        {int}         node_id   - the id of the node that should be changed/deleted

    Returns:
        {HTTPResponse} a django response object
    """
    try:
        node = get_object_or_404(Node, client_id=node_id, graph__pk=graph_id)

        if node.graph.read_only:
            raise HttpResponseForbiddenAnswer('Trying to modify a node in a read-only graph')

        if request.method == 'POST':
            # Interpret all parameters as json. This will ensure correct parsing of numerical values like e.g. ids
            parameters = json.loads(request.POST.get('properties', {}))

            logger.debug('Changing node %s in graph %s to %s' % (node_id, graph_id, parameters))
            command = commands.ChangeNode.create_from(graph_id, node_id, parameters)
            command.do()

            # return the updated node object
            return HttpResponse(node.to_json(), 'application/javascript', status=204)

        elif request.method == 'DELETE':
            command = commands.DeleteNode.create_from(graph_id, node_id)
            command.do()
            return HttpResponse(status=204)

    except Exception as exception:
        logger.error('Exception: ' + str(exception))
        raise exception

@login_required
@csrf_exempt
@require_ajax
@require_POST
@transaction.commit_on_success
@never_cache
def edges(request, graph_id):
    """
    Function: edges
    
    This API handler creates a new edge in the graph with the given id. The edge links the two nodes 'source' and
    'target' with each other that are provided in the POST body. Additionally, a request to this URL MUST provide
    an id for this edge that was assigned by the client (no wait for round-trip). The response contains the JSON
    serialized representation of the new edge and it location URI.
    
    Request Parameters: client_id = <INT>, source = <INT>, target = <INT>
    Response:           201 - <EDGE_AS_JSON>, Location = <EDGE_URI>
    
    Parameters:
     {HTTPRequest} request   - the django request object
     {int}         graph_id  - the id of the graph where the edge shall be added
    
    Returns:
     {HTTPResponse} a django response object
    """
    POST = request.POST
    try:
        if request.user.is_staff:
            graph = get_object_or_404(Graph, pk=graph_id)
        else:
            graph = get_object_or_404(Graph, pk=graph_id, owner=request.user, deleted=False)
        if graph.read_only:
            raise HttpResponseForbiddenAnswer('Trying to create an edge in a read-only graph')

        command = commands.AddEdge.create_from(graph_id=graph_id, client_id=POST['id'],
                                               from_id=POST['source'], to_id=POST['target'])
        command.do()

        edge = command.edge
        response = HttpResponse(edge.to_json(), 'application/javascript', status=201)
        response['Location'] = reverse('edge', kwargs={'graph_id': graph_id, 'edge_id': edge.client_id})

        return response

    # some values in the request were not parsable
    except (ValueError, KeyError):
        raise HttpResponseBadRequestAnswer()

    # either the graph, the source or the target node are not in the database
    except ObjectDoesNotExist:
        raise HttpResponseNotFoundAnswer("Invalid graph or node ID")

    # should never happen, just for completeness reasons here
    except MultipleObjectsReturned:
        raise HttpResponseServerErrorAnswer()

@login_required
@csrf_exempt
@require_ajax
@require_http_methods(['DELETE'])
@transaction.commit_on_success
@never_cache
def edge(request, graph_id, edge_id):
    """
    Function: edge
    
    This API handler deletes the edge from the graph using the both provided ids. The id of the edge hereby refers to
    the previously assigned client side id and NOT the database id. The response to this request does not contain any
    body.
    
    Request Parameters: None
    Response:           204
    
    Parameters:
     {HTTPRequest} request   - the django request object
     {int}         graph_id  - the id of the graph where the edge shall be deleted
     {int}         edge_id   - the id of the edge to be deleted
    
    Returns:
     {HTTPResponse} a django response object
    """
    try:
        if request.user.is_staff:
            graph = get_object_or_404(Graph, pk=graph_id)
        else:
            graph = get_object_or_404(Graph, pk=graph_id, owner=request.user, deleted=False)            
        if graph.read_only:
            raise HttpResponseForbiddenAnswer('Trying to delete an edge in a read-only graph')

        commands.DeleteEdge.create_from(graph_id=graph_id, edge_id=edge_id).do()
        return HttpResponse(status=204)

    except ValueError:
        raise HttpResponseBadRequestAnswer()

    except ObjectDoesNotExist:
        raise HttpResponseNotFoundAnswer("Invalid edge ID")

    except MultipleObjectsReturned:
        raise HttpResponseServerErrorAnswer()

# TODO: PROVIDE ALL PROPERTIES OF A NODE (/nodes/<id>/properties)
def properties(**kwargs):
    pass

# TODO: PROVIDE THE VALUE OF A PROPERTY WITH GIVEN KEY (/nodes/<id>/properties/<key>)
def property(**kwargs):
    pass

@login_required
@csrf_exempt
@require_ajax
@require_http_methods(['GET', 'POST'])
@transaction.commit_on_success
@never_cache
def undos(request, graph_id):
    #
    # TODO: IS NOT WORKING YET
    # TODO: UPDATE DOC STRING
    #
    """
    Fetch undo command stack from backend
    API Request:  GET 
    API Response: JSON body with command array of undo stack

    Tell the backend that an undo has been issued in the model
    API Request:  POST 
    API Response: no body, status code 204
    """
    if request.method == 'GET':
        #TODO: Fetch undo stack for the graph
        return HttpResponseNoResponse()
        
    else:
        #TODO: Perform top command on undo stack
        return HttpResponseNoResponse()

@login_required
@csrf_exempt
@require_ajax
@require_http_methods(['GET', 'POST'])
@transaction.commit_on_success
@never_cache
def redos(request, graph_id):
    #
    # TODO: IS NOT WORKING YET
    # TODO: UPDATE DOC STRING
    #
    """
    Fetch redo command stack from backend
    API Request:  GET 
    API Response: JSON body with command array of redo stack

    Tell the backend that an redo has been issued in the model
    API Request:  POST 
    API Response: no body, status code 204
    """
    if request.method == 'GET':
        #TODO Fetch redo stack for the graph
        return HttpResponseNoResponse()
    else:
        #TODO Perform top command on redo stack
        return HttpResponseNoResponse()

@csrf_exempt
@require_http_methods(['GET', 'POST'])
def job_files(request, job_secret):
    ''' Allows to retrieve a job input file (GET), or to upload job result files (POST).
        This method is expected to only be used by our backend daemon script, 
        which gets the shared secret as part of the job URL.
    '''
    job = get_object_or_404(Job, secret=job_secret)
    if request.method == 'GET':
        logger.debug("Delivering data for job %d"%job.pk)
        response = HttpResponse()
        response.content, response['Content-Type'] = job.input_data()
        logger.debug(response.content)
        return response
    elif request.method == 'POST':
        if job.done():
            logger.error("Job already done, discarding uploaded results")
            return HttpResponse() 
        else:
            logger.debug("Storing result data for job %d"%job.pk)
            # Retrieve binary file and store it
            assert(len(request.FILES.values())==1)
            job.result = request.FILES.values()[0].read()
            job.parseResult(job.result)
            job.exit_code = 0       # This saves as a roundtrip. Having files means everything is ok.
            job.save()
            return HttpResponse()
            
@csrf_exempt
@require_http_methods(['POST'])
def job_exitcode(request, job_secret):
    ''' Allows to set the exit code of a job. 
        This method is expected to only be used by our backend daemon script, 
        which gets the shared secret as part of the PostgreSQL notification message.
        This reduces the security down to the ability of connecting to the PostgreSQL database,
        otherwise the job URL cannot be determined.
    '''
    job = get_object_or_404(Job, secret=job_secret)
    logger.debug("Storing exit code for job %d"%job.pk)
    job.exit_code = request.POST['exit_code']
    job.save()
    return HttpResponse()        

@csrf_exempt
@require_http_methods(['POST'])
def noti_dismiss(request, noti_id):
    """
    Function: noti_dismiss

    API call being used when the user dismisses the notification box on the start (project overview)
    page.
    """
    noti = get_object_or_404(Notification, pk=noti_id)
    noti.users.remove(request.user)
    noti.save()
    return HttpResponse(status=200)

