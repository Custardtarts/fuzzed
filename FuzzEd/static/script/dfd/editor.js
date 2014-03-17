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
                nodes = _.map(nodes, function(node){return jQuery(node).data(this.config.Keys.NODE);}.bind(this));
                this.graph.create_communication_zone(nodes);
            }
        },

        _ungroupSelection: function() {
            var selectedNodes = '.' + this.config.Classes.SELECTED + '.' + this.config.Classes.NODE;

            nodes = jQuery(selectedNodes);
            nodes = _.map(nodes, function(node){return jQuery(node).data(this.config.Keys.NODE);}.bind(this));
            this.graph.delete_communication_zone(nodes);
            
        }
    });
});