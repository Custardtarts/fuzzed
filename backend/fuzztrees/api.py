from django.http import HttpResponse, HttpResponseNotAllowed, HttpResponseBadRequest, HttpResponseNotFound
from django.core.urlresolvers import reverse
from django.contrib.auth.decorators import login_required
from django.db import transaction
from fuzztrees.models import Graph, Node, Edge, History, GRAPH_JS_TYPE
from nodes_config import NODE_TYPES
import json

@login_required
def undos(request, graph_id):
	"""
	Fetch undo command stack from backend
	API Request:  GET /api/graphs/[graphID]/undos, no body
	API Response: JSON body with command array of undo stack

	Tell the backend that an undo has been issued in the model
	API Request:  POST /api/graphs/[graphID]/undos, no body
	API Response: no body, status code 204
	"""
	if request.is_ajax():
		if request.method == 'GET':
			#TODO: Fetch undo stack for the graph
			return HttpResponse(status=200)
		elif request.method == 'POST':
			#TODO: Perform top command on undo stack
			return HttpResponse(status=204)
		return HttpResponseNotAllowed(['GET', 'POST']) 

@login_required
def redos(request, graph_id):
	"""
	Fetch redo command stack from backend
	API Request:  GET /api/graphs/[graphID]/redos, no body
	API Response: JSON body with command array of redo stack

	Tell the backend that an redo has been issued in the model
	API Request:  POST /api/graphs/[graphID]/redos, no body
	API Response: no body, status code 204
	"""
	if request.is_ajax():
		if request.method == 'GET':
			#TODO Fetch redo stack for the graph
			return HttpResponse(status=200)
		elif request.method == 'POST':
			#TODO Perform top command on redo stack
			return HttpResponse(status=204)
		return HttpResponseNotAllowed(['GET', 'POST']) 

@login_required
@transaction.commit_manually
def graphs(request):
	"""
	Add new graph in the backend
	API Request:            POST /api/graphs
	API Request Parameters: type=[GRAPH_TYPE], name=[graph name]
	API Response:           no body, status code 201, location URI for new graph
	"""	
	if request.is_ajax():
		if request.method == 'POST':
			if 'type' in request.POST and 'name' in request.POST:
				# add new graph		
				try:
					t=int(request.POST['type'])
					assert(t in GRAPH_JS_TYPE)
					g=Graph(name=request.POST['name'], owner=request.user, type=t)
					g.save()
					c=History(command=1, graph=g)
					c.save()
					transaction.commit()
				except:
					transaction.rollback()
					return HttpResponseBadRequest()	
				else:		
					response=HttpResponse(status=201)
					response['Location']=reverse('graph', args=[g.pk])
					return response
			else:
				return HttpResponseBadRequest()
		return HttpResponseNotAllowed(['POST']) 

@login_required
def graph(request, graph_id):
	"""
	Fetch serialized current graph from backend
	API Request:  GET /api/graphs/[graphID] , no body
	API Response: JSON body with serialized graph
	"""
	if request.is_ajax():
		if request.method == 'GET':
			# fetch graph 
			try:
				g=Graph.objects.get(pk=graph_id, owner=request.user, deleted=False)
			except:
				return HttpResponseNotFound()
			top=g.nodes.get(root=True)
			#fan={'id': 'fan', 'name': 'Fan'}
			#chip={'id': 'chip', 'name': 'Chip'}
			#cpu={'id': 'cpu', 'name': 'CPU', 'children': [fan, chip]}
			#disc={'id': 'disc', 'name': 'Disc'}
			#tree={'id': 'tree', 'name': 'TOP', 'children': [cpu, disc]}	
			data=json.dumps(top.getTreeDict())
			return HttpResponse(data, 'application/javascript')
		return HttpResponseNotAllowed(['GET']) 
	
@login_required
@transaction.commit_manually
def nodes(request, graph_id):
	"""
	Add new node to graph stored in the backend
	API Request:            POST /api/graphs/[graphID]/nodes
	API Request Parameters: parent=[parentID], type=[NODE_TYPE]
	API Response:           no body, status code 201, location URI for new node
	"""
	if request.is_ajax():
		if request.method == 'POST':
			if 'parent' in request.POST and 'type' in request.POST:
				try:
					t=int(request.POST['type'])
					assert(t in NODE_TYPES)
					g=Graph.objects.get(pk=graph_id, deleted=False)
					p=Node.objects.get(pk=request.POST['parent'], deleted=False)
					n=Node(type=t, graph=g)
					n.save()
					c=History(command=2, graph=g, node=n)
					c.save()
					e=Edge(src=p, dest=n)
					e.save()
					c2=History(command=3, graph=g, edge=e)
					c2.save()
					transaction.commit()
				except Exception, e:
					transaction.rollback()
					return HttpResponseBadRequest()			
				else:					
					response=HttpResponse(status=201)
					response['Location']=reverse('node', args=[g.pk, n.pk])
					return response
		return HttpResponseNotAllowed(['POST']) 

@login_required	
def node(request, graph_id, node_id):
	"""
	Delete node from graph stored in the backend
	API Request:  DELETE /api/graphs/[graphID]/nodes/[nodeID], no body
	API Response: no body, status code 204

	Move node to another position in the graph	
	API Request:            POST /api/graphs/[graphID]/nodes/[nodeID] 
	API Request Parameters: parent=[nodeID]
	API Response:           no body, status code 204

	Change property of a node
	API Request:            POST /api/graphs/[graphID]/nodes/[nodeID]
	API Request Parameters: key=... , val=...
	API Response:           no body, status code 204

	Morph node to another type
	API Request:            POST /api/graphs/[graphID]/nodes/[nodeID]
	API Request Parameters: type=[NODE_TYPE]
	API Response:           no body, status code 204
	"""
	if request.is_ajax():
		try:
			g=Graph.objects.get(pk=graph_id, deleted=False)
			n=Node.objects.get(pk=node_id, deleted=False)
		except:
			return HttpResponseBadRequest()						
		if request.method == 'DELETE':
			try:
				# remove edges explicitly to keep history
				for e in n.outgoing.all():
					e.deleted=True
					e.save()
					c=History(command=6, graph=g, edge=e)
					c.save()
				for e in n.incoming.all():
					e.deleted=True
					e.save()
					c=History(command=6, graph=g, edge=e)
					c.save()
				n.deleted=True
				n.save()
				c=History(command=5, graph=g, node=n)
				c.save()
				transaction.commit()
			except:
				transaction.rollback()
				return HttpResponseBadRequest()						
			else:
				return HttpResponse(status=204)
		elif request.method == 'POST':
			if 'parent' in request.POST:
				#TODO relocate node
				return HttpResponse(status=204)
			elif 'key' in request.POST and 'val' in request.POST:
				#TODO change node property
				return HttpResponse(status=204)
			elif 'type' in request.POST:
				#TODO change node type			
				return HttpResponse(status=204)
			else:
				return HttpResponseBadRequest()
		return HttpResponseNotAllowed(['DELETE','POST']) 
	
	