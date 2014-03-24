define(['class', 'config', 'jquery', 'jsplumb'],
function(Class, Config) {
    /**
     *  Class: {Abstract} Edge
     *
     *  Blah
     *
     */
    return Class.extend({
        id:         undefined,
        source:     undefined,
        target:     undefined,
        properties: undefined,
        graph:      undefined,

        _jsPlumbEdge: undefined,

        init: function(graph, sourceOrJsPlumbEdge, target, properties) {
            this.graph = graph;

            if (arguments.length === 2) {
                // case 1: create Edge instance for existing jsPlumbConnection (e.g. as event handler)
                this.source = jQuery(sourceOrJsPlumbEdge.source).data(Config.Keys.NODE);
                this.target = jQuery(sourceOrJsPlumbEdge.target).data(Config.Keys.NODE);
                this.properties = {};
                this._initFromJsPlumbEdge(sourceOrJsPlumbEdge);

            } else {
                // case 2: create Edge instance and create corresponding jsPlumbConnection (programmatic creation)
                this._init(sourceOrJsPlumbEdge, target, properties);
            }
        },

        _init: function(source, target, properties) {
            this.source = source;
            this.target = target;

            // having properties implies already having an id
            this.id = typeof properties.id === 'undefined' ? this.graph.createId() : properties.id;
            this.properties = properties;

            var jsPlumbEdge = jsPlumb.connect({
                source:    source.container,
                target:    target.container,
                fireEvent: false
            });
            jsPlumbEdge._fuzzedId = this.id;
            this._initFromJsPlumbEdge(jsPlumbEdge);
        },

        _initFromJsPlumbEdge: function(jsPlumbEdge) {
            this._jsPlumbEdge = jsPlumbEdge;

            jsPlumbEdge._fuzzedId = (typeof jsPlumbEdge._fuzzedId === 'undefined') ? this.graph.createId() : jsPlumbEdge._fuzzedId;
            this.id = jsPlumbEdge._fuzzedId;

            // store the ID in an attribute so we can retrieve it later from the DOM element
            jQuery(jsPlumbEdge.canvas).data(Config.Keys.CONNECTION_ID, jsPlumbEdge._fuzzedId);

            this.source.setChildProperties(this.target);

            // correct target and source node incoming and outgoing edges
            this.source.outgoingEdges.push(this);
            this.target.incomingEdges.push(this);

            // call home
            jQuery(document).trigger(
                Config.Events.GRAPH_EDGE_ADDED,
                [this.id, this.source.id, this.target.id]
            );

            return this;
        }
    });
});
