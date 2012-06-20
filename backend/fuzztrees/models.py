from django.db import models
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404


from nodes_config import NODE_TYPES, nodeTypeChoices

class GraphTypes():
	FAULT_TREE=1
	FUZZ_TREE=2
	RBD=3

GRAPH_TYPE = (
    ( GraphTypes.FAULT_TREE, u'Fault Tree'),
    ( GraphTypes.FUZZ_TREE, u'Fuzz Tree'),	
    ( GraphTypes.RBD, u'Reliability Block Diagram')
)

GRAPH_JS_TYPE = {
	1: 'faulttree',
	2: 'fuzztree',
	3: 'rbd'
}

class Commands():
	ADD_GRAPH=1
	ADD_NODE=2
	ADD_EDGE=3
	DEL_GRAPH=4
	DEL_NODE=5
	DEL_EDGE=6	
	CHANGE_COORD=7
	CHANGE_PROP=8
	CMD_GROUP=9

COMMAND_TYPE = (
	(Commands.ADD_GRAPH, 'Add graph'),		
	(Commands.ADD_NODE, 'Add node'), 		
	(Commands.ADD_EDGE, 'Add edge'),		
	(Commands.DEL_GRAPH, 'Delete graph'),		
	(Commands.DEL_NODE, 'Delete node'), 		
	(Commands.DEL_EDGE, 'Delete edge'),
	(Commands.CHANGE_COORD, 'Change node coordinates'),
	(Commands.CHANGE_PROP, 'Change node property'),
	(Commands.CMD_GROUP, 'Start of command group')		
)

class Graph(models.Model):
	type = models.PositiveSmallIntegerField(choices=GRAPH_TYPE)
	owner = models.ForeignKey(User, related_name='graphs')
	deleted = models.BooleanField(default=False)

	def created(self):
		try:
			c=self.commands.get(command=Commands.ADD_GRAPH)
			return c.insert_date
		except:
			return "(Unknown)"

	def __unicode__(self):
		try:
			nameProp=Property.objects.get(graph=self, key='name')
			return nameProp.val
		except:
			return "Graph"+str(self.pk)

	def dump(self, tree=None, indent=0):
		if not tree:
			root=self.nodes.filter(root=True)[0]
			tree=root.getTreeDict()
			print "Tree dump:"
		print "|"*indent + "-%s (%s)"%(tree['name'], tree['id'])
		if "children" in tree:
			for subtree in tree['children']:
				self.dump(subtree, indent+1)

	def toJsonDict(self):
		nodesArray = [n.toJsonDict() for n in self.nodes.filter(deleted=False)]
		print nodesArray
		return {'id': self.pk, 'name': str(self), 'type': GRAPH_JS_TYPE[self.type], 'nodes': nodesArray}

	def saveAddEvent(self):
		c=History(command=Commands.ADD_GRAPH, graph=self)
		c.save()

	def saveDeleteEvent(self):
		c=History(command=Commands.DEL_GRAPH, graph=self)
		c.save()

class Node(models.Model):
	client_id = models.BigIntegerField()
	type = models.PositiveSmallIntegerField(choices=nodeTypeChoices())
	xcoord = models.IntegerField()
	ycoord = models.IntegerField()
	graph = models.ForeignKey(Graph, null=False, related_name='nodes')
	deleted = models.BooleanField(default=False)

	def __unicode__(self):
		try:
			nameProp=Property.objects.get(node=self, key='name')
			return nameProp.val
		except:
			return NODE_TYPES[self.type]['type'] + "_" + str(self.pk)

	def toJsonDict(self):
		pos = {'x': self.xcoord, 'y': self.ycoord}
		edgesArray = [e.toJsonDict() for e in self.outgoing.all().filter(deleted=False)]
		props = dict([p.toTuple() for p in self.properties])
		return {'id': self.client_id, 'type': NODE_TYPES[self.type]['type'] , 'position': pos, 'properties': props, 'outgoingEdges': edgesArray}

	def getChildren(self):
		edges=self.outgoing.all().filter(deleted=False)
		if len(edges)>0:
			return [e.dest.getTreeDict() for e in edges]
		else:
			return ''

	def getTreeDict(self):
		if self.name=='':
			d={'id':self.pk,'name':NODE_TYPES[self.type]['name']}
		else:
			d={'id':self.pk,'name':self.name}
		kids=self.getChildren()
		if kids:
			d['children']=kids
		return d

	def saveAddEvent(self):
		c=History(command=Commands.ADD_NODE, node=self)
		c.save()

	def saveDeleteEvent(self):
		c=History(command=Commands.DEL_NODE, node=self)
		c.save()


class Edge(models.Model):
	client_id = models.BigIntegerField()
	src  = models.ForeignKey(Node, null=False, related_name='outgoing')
	dest = models.ForeignKey(Node, null=False, related_name='incoming')
	deleted = models.BooleanField(default=False)

	def __unicode__(self):
		return str(self.src) + "->" + str(self.dest)

	def toJsonDict(self):
		return {'id': self.client_id, 'source': self.src.client_id, 'target': self.dest.client_id}

	def saveAddEvent(self):
		c=History(command=Commands.ADD_EDGE, edge=self)
		c.save()

	def saveDeleteEvent(self):
		c=History(command=Commands.DEL_EDGE, edge=self)
		c.save()


class Property(models.Model):
	graph = models.ForeignKey(Graph, null=True, related_name='properties')
	node = models.ForeignKey(Node, null=True, related_name='properties')
	edge = models.ForeignKey(Edge, null=True, related_name='properties')
	key = models.CharField(max_length=255)
	val = models.CharField(max_length=255)
	deleted = models.BooleanField(default=False)

	def __unicode__(self):
		if self.node:
			return "Node "+str(node)+":%s = %s"%(self.key, self.val)
		elif self.graph:
			return "Graph "+str(graph)+":%s = %s"%(self.key, self.val)
		else:
			return "Edge "+str(edge)+":%s = %s"%(self.key, self.val)

	def toTuple(self):
		return (self.key, self.val)

	def saveChangeEvent(self, graph):
		h=History(command=Commands.CHANGE_PROP, prop=self)
		h.oldkey=self.key
		h.oldval=self.val
		h.graph=graph
		h.save()

class History(models.Model):
	command = models.PositiveSmallIntegerField(choices=COMMAND_TYPE, null=False)
	graph = models.ForeignKey(Graph, null=False, related_name='commands')
	node = models.ForeignKey(Node, null=True)
	edge = models.ForeignKey(Edge, null=True)
	prop = models.ForeignKey(Property, null=True)
	oldxcoord = models.IntegerField(null=True)
	oldycoord = models.IntegerField(null=True)
	oldkey = models.CharField(max_length=255, null=True)
	oldval = models.CharField(max_length=255, null=True)
	group = models.ForeignKey('History', null=True)
	insert_date = models.DateTimeField(null=False, blank=False, auto_now_add=True, editable=False)

def createFuzzTreeGraph(owner, title):
	g=Graph(owner=owner)
	g.type=GraphTypes.FUZZ_TREE
	g.save()
	g.saveAddEvent()
	p=Property(graph=g, key='name', val=title)
	p.saveChangeEvent(g)    # change from empty property to filled propery
	p.save()

def delGraph(g):
	g.deleted=True
	g.save()
	g.saveDeleteEvent()

def renameGraph(g, newName):
	p=get_object_or_404(Property, graph=g, key='name')
	p.saveChangeEvent(g)
	p.val=newName
	p.save()

def setNodeProperty(node, key, value):
	p=Property.objects.get(node=node, key=key)
	p.saveChangeEvent(node.graph)
	p.val=value
	p.save()

