define(['editor', 'dfd/graph', 'dfd/config', 'jquery', 'underscore'], function(Editor, DfdGraph, DfdConfig) {
    /**
     *  Package: DFD
     */

    /**
     *  Class: DfdEditor
     *    DFD-specific <Base::Editor> class.
     *
     *  Extends: <Base::Editor>
     */
    return Editor.extend({
        /**
         *  Group: Accessors
         */

        /**
         *  Method: getConfig
         *
         *  Returns:
         *    The <DfdConfig> object.
         *
         *  See also:
         *    <Base::Editor::getConfig>
         */
        getConfig: function() {
            return DfdConfig;
        },

        /**
         *  Method: getGraphClass
         *
         *  Returns:
         *    The <DfdGraph> class.
         *
         *  See also:
         *    <Base::Editor::getGraphClass>
         */
        getGraphClass: function() {
            return DfdGraph;
        },

        _setupJsPlumb: function() {
            this._super();
            jsPlumb.connectorClass += " outlined";
            return this;
        },


        _setupMenuActions: function() {
            this._super();

            jQuery('#' + this.config.IDs.ACTION_GROUP).click(function() {
                this._groupSelection();
            }.bind(this));

            jQuery('#' + this.config.IDs.ACTION_UNGROUP).click(function() {
                this._ungroupSelection();
            }.bind(this));

            // set the shortcut hints from 'Ctrl+' to '⌘' when on Mac
            if (navigator.platform == 'MacIntel' || navigator.platform == 'MacPPC') {
                jQuery('#' + this.config.IDs.ACTION_GROUP + ' span').text('⌘G');
                jQuery('#' + this.config.IDs.ACTION_UNGROUP + ' span').text('⌘U');
            }


            return this;
        },

        _setupKeyBindings: function(readOnly) {
            this._super(readOnly)
            if (readOnly) return this;

            jQuery(document).keydown(function(event) {
                if (event.which === 'G'.charCodeAt() && (event.metaKey || event.ctrlKey)) {
                    this._groupPressed(event);
                } else if (event.which === 'U'.charCodeAt() && (event.metaKey || event.ctrlKey)) {
                    this._ungroupPressed(event);
                }
            }.bind(this));

            return this;
        },

        _groupPressed: function(event) {
            // prevent that node is being deleted when we edit an input field
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();

            this._groupSelection();

            return this;
        },

        _ungroupPressed: function(event) {
            // prevent that node is being deleted when we edit an input field
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();

            this._ungroupSelection();

            return this;
        },

        _groupSelection: function() {
            var selectedNodes = '.' + this.config.Classes.SELECTED + '.' + this.config.Classes.NODE;

            nodes = jQuery(selectedNodes);
            if(nodes.length > 1)
            {
                var jsonNodeGroup = {
                    nodes: _.map(nodes, function(node){return jQuery(node).data(this.config.Keys.NODE).id;}.bind(this))
                };
                this.graph.addNodeGroup(jsonNodeGroup);
            }
        },

        _ungroupSelection: function() {
            var selectedNodes = '.' + this.config.Classes.SELECTED + '.' + this.config.Classes.NODE;

            var nodeIds = _.map(jQuery(selectedNodes), function(node){
                return jQuery(node).data(this.config.Keys.NODE).id;
            }.bind(this));

            var nodeGroup = undefined;

            // find the correct node group, whose node ids match the selected ids
            _.each(this.graph.nodeGroups, function(ng) {
                var ngIds = ng.nodeIds();
                if (jQuery(ngIds).not(nodeIds).length == 0 && jQuery(nodeIds).not(ngIds).length == 0) {
                    nodeGroup = ng;
                }
            });

            if (typeof nodeGroup === undefined) return false;

            this.graph.deleteNodeGroup(nodeGroup);
            return true;
        }
    });
});