from django.db import models

from edge import Edge
from graph import Graph
from node import Node
from properties import Property
import notations

class Command(models.Model):
    """
    Class [abstract]: Command

    Abstract base class for any command in the system. Required for type correctness and contains meta data needed in every subtype.

    Fields:
     {bool}           undoable     - indicates if command can be undone (default: False)
     {const datetime} insert_date  - moment when the command was issued (default: now)
    """
    class Meta:
        app_label = 'FuzzEd'
        abstract  = True

    undoable    = models.BooleanField(default=False)
    insert_date = models.DateTimeField(auto_now_add=True, editable=False)

    def do(self):
        """
        Method [abstract]: do

        Stub for the command's do behaviour. Must be overwritten in sublasses.

        Returns:
         {None}
        """
        raise NotImplementedError('[Abstract Method] Implement in subclass')

    def undo(self):
        """
        Method [abstract]:
        
        Stub for the command's undo behaviour. Must be overwritten in sublcasses.

        Returns:
         {None}
        """
        raise NotImplementedError('[Abstract Method] Implement in subclass')

class AddEdge(Command):
    """
    Class: AddEdge
    
    Extends: Command

    Command that is issued when an edge was added to a graph.

    Fields:
     {<Edge>} edge  - the edge that was added
    """
    edge = models.ForeignKey(Edge, related_name='+')

    @staticmethod
    def create_of(graph_id, client_id, from_id, to_id):
        """
        Method [static]: create_of

        Convience factory method for issueing an add edge command from parameters as received from API calls. NOTE: the edge object that is required for this command is created and saved when invoking this method.

        Parameters:
         {str} graph_id      - the id of the graph that will contain this edge
         {str} client_id     - the id of the edge as set on the client
         {str} from_node_id  - the client id(!) of the node the edge origins
         {str} to_node_id    - the client id(!) of the node that terminates the edge

        Returns:
         {<AddEdge>} the add edge command instance
        """
        source = Node.objects.get(client_id=int(from_id), graph__pk=int(graph_id))
        target = Node.objects.get(client_id=int(to_id), graph__pk=int(graph_id))
        edge   = Edge(client_id=int(client_id), source=source, target=target, deleted=True)
        edge.save()

        return AddEdge(edge=edge)

    def do(self):
        """
        Method: do

        Adds the edge to the graph by removing the deleted flag from the instance. As the edge is by default marked as not deleted the invokation of this method is only mandatory when redoing this command.

        Returns:
         {None}
        """
        self.edge.deleted = False
        self.edge.save()
        self.save()

    def undo(self):
        """
        Method: undo
        
        Deletes the edge by setting its deletion flag.

        Returns:
         {None}
        """
        self.edge.deleted = True
        self.edge.save()
        self.save()

class AddGraph(Command):
    """
    Class: AddGraph

    Extends: Command
    
    Command that is issued when a graph was added.
    
    Fields:
     {<Graph>} graph  - the graph that was added
    """
    graph = models.ForeignKey(Graph, related_name='+')

    @staticmethod
    def create_of(kind, name, owner, undoable=False):
        """
        Method [static]: create_of
        
        Convenience factory method for issuing an add graph command from parameters as received from API calls. NOTE: the graph object that is required for this command is created and saved when invoking this method.
        
        Parameters:
         {str}  kind   - type identifier for the graph's notation
         {str}  name   - name of the graph
         {User} owner  - the user that owns this graph
        
        Returns:
         {<AddGraph>} the add graph command instance
        """
        graph = Graph(kind=kind, name=name, owner=owner, deleted=True)
        graph.save()

        return AddGraph(graph=graph, undoable=undoable)

    def do(self):
        self.graph.deleted = False
        self.graph.save()
        self.save()

    def undo(self):
        self.graph.deleted = True
        self.graph.save()
        self.save()

class AddNode(Command):
    """
    Class: AddNode
    
    Extends: Command

    Command that is issued when a node was added to a graph.

    Fields:
     {<Node>} node  - the node that was added
    """
    node = models.ForeignKey(Node, related_name='+')

    @staticmethod
    def create_of(graph_id, node_id, kind, x, y):
        """
        Method [static]: create_of

        Convenience factory method for issuing an add node command from parameters as received from API calls. NOTE: the node object that is required for this command is created and saved when invoking this method.

        Arguments:
         {str} graph_id  - the id of the graph the node is added to
         {str} node_id   - the client id(!) of the node as set on the client
         {str} kind      - the node's identification string
         {str} x         - x coordinate of the added node
         {str} y         - y coordinate of the added node
                      
        Returns:
         {<AddNode>} - the add node command instance
        """
        graph = Graph.objects.get(pk=int(graph_id))
        node  = Node(graph=graph, client_id=int(node_id), \
                     kind=kind, x=int(x), y=int(y), deleted=True)
        node.save()
        
        return AddNode(node=node)

    def do(self):
        """
        Method: do
        
        Adds the node to the graph by removing the deleted flag from the instance. As the node is by default marked as not deleted the invokation of this method is only mandatory when redoing this command.
        
        Returns:
         {None}
        """
        self.node.deleted = False
        self.node.save()
        self.save()

    def undo(self):
        """
        Method: do
        
        Removes the node from the graph by setting its deletion flag.

        Returns:
         {None}
        """
        self.node.deleted = True
        self.node.save()
        self.save()

class ChangeNode(Command):
    """
    Class: ChangeNode
    
    Extends: Command

    Command that is issued when properties of a node change
    """
    @staticmethod
    def create_from(graph_id, node_id, **updated_properties):
        """
        Method [static]: create_from
        
        Convience factory method for issueing a property changed command from parameters as received from API calls. NOTE: if the property does not yet exist it being created and saved.

        Parameters:
         {str} graph_id   - the id of the graph that contains the node thats property changed
         {str] node_id    - the client id(!) of the node thats property changed
         {str} key        - the name of the property that changed
         {str} new_value  - the value the property has been changed to

        Returns:
         {<PropertyChanged>}  - the property changed command instance
        """
        command = PropertiesChanged()
        command.save()

        for key, value in updated_properties:
            node_property, created = Property.objects.get_or_create(key=key, \
                                                                    node__client_id=int(node_id),\
                                                                    node__graph__pk=int(graph_id))
            property_change = PropertyChange(command=command, property=node_property,\
                                             old_value=node_property.value, new_value=value)
            property_change.save()

        return command

    def do(self):
        """
        Method: do
        
        Apply the change to the property - i.e. set the new value

        Returns:
         {None}
        """
        for change in self.changes:
            change.property.value = change.new_value
            change.property.save()
        self.save()

    def undo(self):
        """
        Method: undo
        
        Reverts the changes to the property - i.e. set old value

        Returns:
         {None}
        """
        for change in self.changes:
            change.property.value = change.old_value
            change.property.save()
        self.save()

class PropertyChange(models.Model):
    """
    Class: PropertyChange
    
    Extends: models.Model
    
    Small inline container class to model arbitrary number of property changes. 
    
    Attributes:
     {ChangeNode} command   - the command this property change belongs to
     {Property}   property  - the actual property that changed
     {str}        old_value - the value of the property before the change
     {str}        new_value - the updated value
    """
    class Meta:
        app_label = 'FuzzEd'

    command   = models.ForeignKey(ChangeNode, related_name='changes')
    property  = models.ForeignKey(Property, related_name='+')
    old_value = models.CharField(max_length=255)
    new_value = models.CharField(max_length=255)

class DeleteEdge(Command):
    """
    Class: DeleteEdge
    
    Extends: Command

    Command that is issued when an edge is deleted.

    Fields:
     {<Edge>} edge  - the edge that shall be deleted
    """
    edge = models.ForeignKey(Edge, related_name='+')

    @staticmethod
    def of(graph_id, edge_id):
        """
        Method [static]: of
        
        Convience factory method for issueing a delete node command from parameters as received from API calls. 

        Arguments:
         {str} graph_id  - the id of the graph that contains the edge to be deleted
         {str} edge_id   - the client id(!) of the edge to be deleted
        
        Returns:
         {<DeleteEdge>}  - the delete edge command instance
        """
        return DeleteEdge(Edge.objects.get(client_id=int(edge_id), node__graph__pk=int(graph_id)))

    def do(self):
        """
        Method: do
        
        Deletes the edge from the graph by setting its deletion flag

        Returns:
         {None}
        """
        self.edge.deleted = True
        self.edge.save()
        self.save()

    def undo(self):
        """
        Method: undo
        
        Restores the edge by removing its deletion flag

        Returns:
         {None}
        """
        self.edge.deleted = False
        self.edge.save()

class DeleteGraph(Command):
    """
    Class: Delete Graph
    
    Extends: Command

    Command that is issued when a graph is deleted.

    Fields:
     {<Graph>} graph  - the graph that shall be deleted
    """
    graph = models.ForeignKey(Graph, related_name='+')

    @staticmethod
    def of(graph_id):
        """
        Method [static]: of
        
        Convience factory method for issueing a delete graph command from parameters as received from API calls.

        Parameters:
         {str} graph_id  - the id of the graph to be deleted

        Returns:
         {<DeleteGraph>}  - the delete graph command instance
        """
        return DeleteGraph(graph=Graph.objects.get(pk=int(graph_id)))

    def do(self):
        """
        Method: do
        
        Deletes the graph by setting its deletion flag

        Returns:
         {None}
        """
        self.graph.deleted = True
        self.graph.save()
        self.save()

    def undo(self):
        """
        Method: undo
        
        Restores the graph by removing its deletion flag

        Returns:
         {None}
        """
        self.graph.deleted = False
        self.graph.save()

class DeleteNode(Command):
    """
    Class: DeleteNode
    
    Extends: Command

    Command that is issued when a node is deleted

    Fields:
     {<Node>} node  - the node that shall be deleted
    """
    node = models.ForeignKey(Node, related_name='+')

    @staticmethod
    def of(graph_id, node_id):
        """
        Method [static]: of
        
        Convience factory method for issueing an add node command from parameters as received from API calls.

        Parameters:
         {str} graph_id  - the id of the graph that contains the node to be deleted
         {str} node_id   - the client id(!) of the node to be deleted

        Returns:
         {<DeleteNode>} the delete node command instance
        """
        return DeleteNode(node=Node.objects.get(client_id=int(node_id),graph__pk=int(graph_id)))

    def do(self):
        """
        Method: do
        
        Removes the node from the containing graph by setting its deletion flag

        Returns:
         {None}
        """
        self.node.deleted = True
        self.node.save()
        self.save()

    def undo(self):
        """
        Method: undo
        
        Restores the given node by removing its deletion flag

        Returns:
         {None}
        """
        self.node.deleted = False
        self.node.save()

#TODO: this will become ChangeNode
class MoveNode(Command):
    """
    Class: MoveNode
    
    Extends: Command
    
    Command that issued when a node is moved
    
    Fields:
     {<Node>} node   - the node that is moved
     {int}    old_x  - the old x coordinate of the node
     {int}    old_y  - the old y coordinate of the node
     {int}    new_x  - the x coordinate the node was moved to
     {int}    new_y  - the y coordinate the node was moved to
    """
    node  = models.ForeignKey(Node, related_name='+')
    old_x = models.IntegerField()
    old_y = models.IntegerField()
    new_x = models.IntegerField()
    new_y = models.IntegerField()

    @staticmethod
    def of(graph_id, node_id, new_x, new_y):
        """
        Method [static]: of
        
        Convience factory method for issueing a node move command from parameters as received from API calls.
        
        Parameters:
         {str} graph_id  - the id of the graph that contains the moved node
         {str} node_id   - the client id(!) of the moved node
         {str} new_x     - the x coordinate the node was moved to
         {str} new_y     - the y coordinate the node was moved to

        Returns:
         {<MoveNode>} the move node command instance
        """
        node = Node.objects.get(client_id=int(node_id), graph__pk=int(graph_id))

        return MoveNode(node=node, old_x=node.x, old_y=node.y, new_x=new_x, new_y=new_y)

    def do(self):
        """
        Method: do
        
        Moves the node to its new coordinates by setting its new position.

        Returns:
         {None}
        """
        self.node.x = self.new_x
        self.node.y = self.new_y
        self.node.save()
        self.save()

    def undo(self):
        """
        Method: undo
        
        Revokes the node's movement by restoring its old position.

        Returns:
         {None}
        """
        self.node.x = self.old_x
        self.node.y = self.old_y
        self.node.save()