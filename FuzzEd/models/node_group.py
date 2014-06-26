import json

from django.db import models

from FuzzEd.models import Node, Graph


class NodeGroup(models.Model):
    class Meta:
        app_label = 'FuzzEd'

    client_id = models.BigIntegerField()
    graph     = models.ForeignKey(Graph, null=False, related_name='groups')
    nodes     = models.ManyToManyField(Node)
    deleted   = models.BooleanField(default=False)

    def to_dict(self):
        return {'id': self.client_id,
                'nodeIds': [node.client_id for node in self.nodes.all()],
                'properties': {prop.key: {'value': prop.value} for prop in self.properties.filter(deleted=False)},
        }

    def to_json(self):
    	return json.dumps(self.to_dict())

    def get_attr(self, key):
        """
        Method: get_attr

        Use this method to fetch an group's attribute. It looks in the node group object and its related properties.

        Parameters:
            {string} key - The name of the attribute.

        Returns:
            {attr} The found attribute. Raises a ValueError if no attribute for the given key exist.
        """
        if hasattr(self, key):
            return getattr(self, key)
        else:
            try:
                prop = self.properties.get(key=key)
                return prop.value
            except Exception:
                raise ValueError()


    def set_attr(self, key, value):
        """
        Method: set_attr

        Use this method to set a group's attribute. It looks in the group object and its related properties for an
        attribute with the given name and changes it. If non exist, a new property is added saving this attribute.

        Parameters:
            {string} key - The name of the attribute.
            {attr} value - The new value that should be stored.
        """
        assert(self.pk)
        from FuzzEd.models import Property
        value = Property.sanitized_value(self, key, value)
        if hasattr(self, key):
            setattr(self, key, value)
        else:
            prop, created = self.properties.get_or_create(key=key, defaults={'node_group': self})
            prop.value = value
            prop.save()

    def set_attrs(self, d):
        '''
            Set groups attributes according to the provided dictionary.

            TODO: Replace by true bulk insert implementation.
        '''
        for key, value in d.iteritems():
            self.set_attr(key, value)

