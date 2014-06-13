define(['graph', 'faulttree/node', 'faulttree/config', 'json!notations/faulttree.json'],
function(Graph, FaulttreeNode, FaulttreeConfig, FaulttreeNotation) {
    /**
     *  Package: Faulttree
     */

    /**
     *  Class: Graph
     *
     *  Faulttree-specific graph.
     *
     *  Extends <Base::Graph>.
     */
    return Graph.extend({
        /**
         *  Group: Accessors
         */

        /**
         *  Method: getConfig
         *    See <Base::Graph::getConfig>.
         */
        getConfig: function() {
            return FaulttreeConfig;
        },

        /**
         *  Method: getNodeClass
         *    See <Base::Graph::getNodeClass>.
         */
        getNodeClass: function() {
            return FaulttreeNode;
        },

        /**
         *  Method: getNotation
         *    See <Base::Graph::getNotation>.
         */
        getNotation: function() {
            return FaulttreeNotation;
        },

        // _clone's purpose is not to actually copy any properties, but to make the clone be in the same node group
        //    as the original, so they share common properties implicitly
        _clone: function(node) {
            var clone = this.addNode({
                kind: node.kind,
                x: node.x + 1,
                y: node.y + 1
            });

            // if the original node is not part of a NodeGroup yet, create a new one out of the node and the clone
            if (typeof node.nodegroup === 'undefined') {
                this.addNodeGroup({
                    nodeIds: [node.id, clone.id]
                });
            } else {
                node.nodegroup.addNode(clone);
            }
        }
    });
});
