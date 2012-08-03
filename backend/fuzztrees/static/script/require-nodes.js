define(['require-config','json!config/fuzztree.json', 'require-properties', 'require-backend', 'require-oop', 'jsplumb', 'jquery.svg'], function(Config, FuzztreeConfig, Properties, Backend, Class) {

    /*
     *  Abstract Node Base Class
     */
    var Node = Class.extend({
        type: 'node',

        init: function(properties) {
            // merge all members of the configuration (defaults) into this object
            jQuery.extend(this, FuzztreeConfig.nodes[this.type]);

            // merge all given properties into this object
            jQuery.extend(this, properties);


            // logic
            this._editor     = undefined; // will be set when appending
            this._graph      = undefined; // will be set as soon as it get added to a concrete graph

            if (typeof this.id === 'undefined') {
                this.id = new Date().getTime() + 1; // make sure the 0 is not reassigned; it's reserved for the top event
            }

            // state
            this._disabled    = false;
            this._highlighted = false;
            this._selected    = false;

            // visuals
            //TODO: maybe move that to a better place
            jsPlumb.extend(this.connector, jsPlumb.Defaults.PaintStyle);

            var visuals            = this._setupVisualRepresentation();
            this._container         = visuals.container;
            this._nodeImage         = visuals.nodeImage;
            this._connectionHandle  = visuals.connectionHandle;
            this._optionalIndicator = visuals.optionalIndicator;
        },

        allowsConnectionsTo: function(otherNode) {
            // no connections to same node
            if (this == otherNode) return false;

            // otherNode must be in the 'allowConnectionTo' list defined in the config
            var allowed = false;
            _.each(this.allowConnectionTo, function(nodeType) {
                if (otherNode instanceof nodeTypeToClassMapping[nodeType]) allowed = true;
            });
            if (!allowed) return false;

            // no connections to the top event
            //TODO: this can not be covered with the config since 'allowConnectionTo' is the wrong direction
            if (otherNode instanceof TopEvent) return false;

            // there is already a connection between these nodes
            var connections = jsPlumb.getConnections({
                //XXX: the selector should suffice, but due to a bug in jsPlumb we need the IDs here
                source: this._container.attr('id'),
                target: otherNode._container.attr('id')
            });
            if (connections.length != 0) return false;

            // no connection if endpoint is full
            var endpoints = jsPlumb.getEndpoints(otherNode._container);
            if (endpoints) {
                //XXX: find a better way to determine endpoint
                var targetEndpoint = _.find(endpoints, function(endpoint){
                    return endpoint.isTarget || endpoint._makeTargetCreator
                });
                if (targetEndpoint && targetEndpoint.isFull()) return false;
            }

            return true;
        },

        appendTo: function(domElement) {
            // some visual stuff, interaction and endpoints need to go here since they require the elements to be
            // already in the DOM. This is why we cannot initialize all of it already in the constructor
            this._container.appendTo(domElement);

            this._resize();
            this._setupEndpoints();
            this._setupDragging();
            this._setupMouse();

            return this;
        },

        remove: function() {
            _.each(jsPlumb.getEndpoints(this._container), function(endpoint) {
                jsPlumb.deleteEndpoint(endpoint);
            })
            this._container.remove();
        },

        moveTo: function(x, y) {
            var image = this._nodeImage;
            var offsetX = image.position().left + image.outerWidth(true) / 2;
            var offsetY = image.position().top  + image.outerHeight(true) / 2;

            this._container.css({
                left: x - offsetX || 0,
                top:  y - offsetY || 0
            });

            return this;
        },

        container: function() {
            return this._container;
        },

        graph: function(newGraph) {
            if (typeof newGraph === 'undefined') return this._graph;

            this._graph = newGraph;
            return this;
        },

        deselect: function() {
            this._selected = false;

            this._container.removeClass(Config.Classes.NODE_SELECTED);

            if (this._highlighted) {
                this._nodeImage.find('path').css('stroke', Config.Node.STROKE_HIGHLIGHTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
                }
            } else {
                this._nodeImage.find('path').css('stroke', Config.Node.STROKE_NORMAL);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_NORMAL);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
                }
            }

            return this;
        },

        disable: function() {
            this._disabled = true;
            this._container.find('path').css('stroke', Config.Node.STROKE_DISABLED);
            this._optionalIndicator.attr('stroke', Config.Node.STROKE_DISABLED);
            if (!this.optional) {
                this._optionalIndicator.attr('fill', Config.Node.STROKE_DISABLED);
            }

            return this;
        },

        enable: function() {
            this._disabled = false;

            if (this._selected) {
                this._container.find('path').css('stroke', Config.Node.STROKE_SELECTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_SELECTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_SELECTED);
                }
            } else if (this._highlighted) {
                this._container.find('path').css('stroke', Config.Node.STROKE_HIGHLIGHTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
                }
            } else {
                this._container.find('path').css('stroke', Config.Node.STROKE_NORMAL);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_NORMAL);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
                }
            }

            return this;
        },

        highlight: function(highlight) {
            this._highlighted = typeof highlight === 'undefined' ? true : highlight;
            // don't highlight selected or disabled nodes (visually)
            if (this._selected || this._disabled) return this;

            if (this._highlighted) {
                this._container.find('path').css('stroke', Config.Node.STROKE_HIGHLIGHTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
                }
            } else {
                this._container.find('path').css('stroke', Config.Node.STROKE_NORMAL);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_NORMAL);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
                }
            }

            return this;
        },

        select: function() {
            // don't allow selection of disabled nodes
            if (this._disabled) return this;

            this._selected = true;
            this._container.addClass(Config.Classes.NODE_SELECTED);
            this._nodeImage.find('path').css('stroke', Config.Node.STROKE_SELECTED);
            this._optionalIndicator.attr('stroke', Config.Node.STROKE_SELECTED);
            if (!this.optional) {
                this._optionalIndicator.attr('fill', Config.Node.STROKE_SELECTED);
            }

            return this;
        },

        setOptional: function(optional) {
            this.optional = optional;

            if (optional) {
                this._optionalIndicator.attr('fill', Config.Node.OPTIONAL_INDICATOR_FILL);
            } else if (this._selected) {
                this._optionalIndicator.attr('fill', Config.Node.STROKE_SELECTED);
            } else if (this._highlighted) {
                this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
            } else {
                this._optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
            }
        },

        properties: function() {
            // return this._properties;
            //TODO: how to get all properties (attributes in the properties menu) of a node?
            // iterating over the propertyDisplayOrder and checking whether a node has that property?
            return {};
        },


        _resize: function() {
            // find the node's svg element and path groups
            var image = this._container.children('.' + Config.Classes.NODE_IMAGE);
            var svg   = image.children('svg');
            var g     = svg.children('g');

            // calculate the scale factor
            var marginOffset = image.outerWidth(true) - image.width();
            var scaleFactor  = (Config.Grid.SIZE - marginOffset) / svg.height();

            // resize the svg and the groups
            svg.width (svg.width()  * scaleFactor);
            svg.height(svg.height() * scaleFactor);
            g.attr('transform', 'scale(' + scaleFactor + ') ' + g.attr('transform'));
        },

        _setupDragging: function() {
            jsPlumb.draggable(this._container, {
                containment: 'parent',
                opacity:     Config.Dragging.OPACITY,
                cursor:      Config.Dragging.CURSOR,
                grid:        [Config.Grid.SIZE, Config.Grid.SIZE],
                stack:       '.' + Config.Classes.NODE,

                // start dragging callback
                start:       function() {
                    this._editor.selection.ofNodes(this);
                }.bind(this),

                // stop dragging callback
                stop:        function(eventObject, uiHelpers) {
                    var editorOffset = this._editor._canvas.offset();
                    var coordinates = this._editor.toGrid({
                        //XXX: find a better way (give node position function...)
                        x: this._nodeImage.offset().left - editorOffset.left,
                        y: this._nodeImage.offset().top - editorOffset.top
                    });
                    Backend.moveNode(this, coordinates);
                }.bind(this)
            });
        },

        _setupEndpoints: function() {
            // get upper and lower image offsets
            if (typeof this.optional === 'undefined' || this.optional == null) {
                var topOffset    = this._nodeImage.offset().top - this._container.offset().top;
            } else {
                var optionalIndicatorWrapper = jQuery(this._optionalIndicator._container);
                var topOffset    = optionalIndicatorWrapper.offset().top - this._container.offset().top;
            }
            topOffset -= this.connector.offset.top;
            var bottomOffset = this._nodeImage.offset().top - this._container.offset().top + this._nodeImage.height();
            bottomOffset += this.connector.offset.bottom;

            // make node source
            if (this.numberOfIncomingConnections != 0) {
                //TODO: we can use an halo icon instead later
                jsPlumb.makeSource(this._connectionHandle, {
                    parent: this._container,
                    anchor:   [ 0.5, 0, 0, 1, 0, bottomOffset],
                    maxConnections: this.numberOfIncomingConnections,
                    connectorStyle: this.connector,
                    dragOptions: {
                        drag: function() {
                            // disable all nodes that can not be targeted
                            var nodesToDisable = jQuery('.' + Config.Classes.NODE + ':not(.'+ Config.Classes.NODE_DROP_ACTIVE + ')');
                            nodesToDisable.each(function(index, node){
                                jQuery(node).data('node').disable();
                            });
                        },
                        stop: function() {
                            // re-enable disabled nodes
                            var nodesToEnable = jQuery('.' + Config.Classes.NODE + ':not(.'+ Config.Classes.NODE_DROP_ACTIVE + ')');
                            nodesToEnable.each(function(index, node){
                                jQuery(node).data('node').enable();
                            });
                        }
                    }
                });
            }

            // make node target
            var targetNode = this;
            if (this.numberOfOutgoingConnections != 0) {
                jsPlumb.makeTarget(this._container, {
                    anchor:         [ 0.5, 0, 0, -1, 0, topOffset],
                    maxConnections: this.numberOfOutgoingConnections,
                    dropOptions: {
                        accept: function(draggable) {
                            var elid = draggable.attr('elid');
                            if (typeof elid === 'undefined') return false;

                            // this is not a connection-dragging-scenario
                            var sourceNode = jQuery('.' + Config.Classes.NODE + ':has(#' + elid + ')').data('node');
                            if (typeof sourceNode === 'undefined') return false;

                            return sourceNode.allowsConnectionsTo(targetNode);
                        },
                        activeClass: Config.Classes.NODE_DROP_ACTIVE
                    }
                });
            }
        },

        _setupMouse: function() {
            // click on the node
            this._container.click(function(eventObject) {
                eventObject.stopPropagation();
                this._editor.selection.ofNodes(this);
            }.bind(this));

            // hovering over a node
            this._container.hover(
                // mouse in
                function() {
                    this.highlight();
                }.bind(this),

                // mouse out
                function() {
                    this.highlight(false);
                }.bind(this)
            );
        },

        _setupVisualRepresentation: function() {
            // get the thumbnail, clone it and wrap it with a container (for labels)
            var container = jQuery('<div>');
            var nodeImage = jQuery('#' + Config.IDs.SHAPES_MENU + ' #' + this.type).clone();
            var optionalIndicatorWrapper = jQuery('<div>').svg();
            var optionalIndicator = optionalIndicatorWrapper.svg('get');

            container
                .attr('id', nodeImage.attr('id') + this.id)
                .addClass(Config.Classes.NODE)
                .css('position', 'absolute')
                .data(Config.Keys.NODE, this);

            //TODO: config
            var radius = Config.Node.OPTIONAL_INDICATOR_RADIUS;
            var optionalIndicatorCircle = optionalIndicator.circle(null, radius+1, radius+1, radius, {
                strokeWidth: 2,
                fill: this.optional ? Config.Node.OPTIONAL_INDICATOR_FILL : Config.Node.STROKE_NORMAL,
                stroke: Config.Node.STROKE_NORMAL
            });

            // external method for changing attributes of the circle later
            optionalIndicator.attr = function(attr, value) {
                var setting = {}
                setting[attr] = value;
                optionalIndicator.change(optionalIndicatorCircle, setting);
            };

            optionalIndicatorWrapper
                .addClass(Config.Classes.NODE_OPTIONAL_INDICATOR)
                .appendTo(container);

            // hide the optional indicator for nodes with undefined value
            if (typeof this.optional === 'undefined' || this.optional == null) {
                optionalIndicatorWrapper.css('visibility', 'hidden');
            }

            nodeImage
                // cleanup the thumbnail's specific properties
                .removeClass('ui-draggable')
                .removeClass(Config.Classes.NODE_THUMBNAIL)
                .removeAttr('id')
                // add new classes for the actual node
                .addClass(Config.Classes.NODE_IMAGE)
                .appendTo(container);

            if (this.numberOfIncomingConnections != 0) {
                var connectionHandle = jQuery('<span class="ui-icon ui-icon-plus ui-icon-shadow"></span>')
                    .addClass(Config.Classes.NODE_HALO_CONNECT)
                    .appendTo(container);
            }

            return {
                container:         container,
                nodeImage:         nodeImage,
                connectionHandle:  connectionHandle,
                optionalIndicator: optionalIndicator
            };
        }

    });

    /*
     *  Abstract Event Base Class
     */
    var Event = Node.extend({
        type: 'event'
    });

    /*
     *  Abstract Gate Base Class
     */
    var Gate = Node.extend({
        type: 'gate'
    });

    /*
     *  Top Event
     */
    var TopEvent = Event.extend({
        type: 'topEvent'
    });

    /*
     *  Basic Event
     */
    var BasicEvent = Event.extend({
        type: 'basicEvent'
    });

    /*
     *  Basic Event Set
     */
    var BasicEventSet = BasicEvent.extend({
        type: 'basicEventSet'
    });

    /*
     *  Intermediate Event
     */
    var IntermediateEvent = Event.extend({
        type: 'intermediateEvent'
    });

    /*
     *  Intermediate Event Set
     */
    var IntermediateEventSet = IntermediateEvent.extend({
        type: 'intermediateEventSet'
    });

    /*
     *  AndGate
     */
    var AndGate = Gate.extend({
        type: 'andGate'
    });

    /*
     *  OrGate
     */
    var OrGate = Gate.extend({
        type: 'orGate'
    });

    /*
     *  XorGate
     */
    var XorGate = Gate.extend({
        type: 'xorGate'
    });

    /*
     *  PriorityAndGate
     */
    var PriorityAndGate = Gate.extend({
        type: 'priorityAndGate'
    });

    /*
     *  VotingOrGate
     */
    var VotingOrGate = Gate.extend({
        type: 'votingOrGate'
    });

    /*
     *  InhibitGate
     */
    var InhibitGate = Gate.extend({
        type: 'inhibitGate'
    });

    /*
     *  ChoiceEvent
     */
    var ChoiceEvent = Event.extend({
        type: 'choiceEvent'
    });

    /*
     *  Redundancy Event
     */
    var RedundancyEvent = Event.extend({
        type: 'redundancyEvent'
    });

    /*
     *  Undeveloped Event
     */
    var UndevelopedEvent = Event.extend({
        type: 'undevelopedEvent'
    });

    /*
     *  House Event
     */
    var HouseEvent = Event.extend({
        type: 'houseEvent'
    });

    /*
     *  Mapping table for resolving note types into classes
     */
    var nodeTypeToClassMapping = {
        'node': Node,
        'event': Event,
        'gate': Gate,
        'basicEvent': BasicEvent,
        'basicEventSet': BasicEventSet,
        'intermediateEvent': IntermediateEvent,
        'intermediateEventSet': IntermediateEventSet,
        'redundancyEvent': RedundancyEvent,
        'choiceEvent': ChoiceEvent,
        'undevelopedEvent': UndevelopedEvent,
        'houseEvent': HouseEvent,
        'topEvent': TopEvent,
        'andGate': AndGate,
        'priorityAndGate': PriorityAndGate,
        'orGate': OrGate,
        'xorGate': XorGate,
        'votingOrGate': VotingOrGate,
        'inhibitGate': InhibitGate
    }

    /*
        Function: newNodeWithType
            Factory method. Returns a new Node of the given type.

        Parameter:
            type - String specifying the type of the new Node. See Config.Node.Types.

        Returns:
            A new Node of the given type
     */
    function newNodeForType(type, properties) {
        var nodeClass = nodeTypeToClassMapping[type];
        return new nodeClass(properties);
    }

    /*
     *  Return the collection of all nodes for require
     */
    return {
        // classes
        BasicEvent:       BasicEvent,
        BasicEventSet:    BasicEventSet,
        UndevelopedEvent: UndevelopedEvent,
        IntermediateEvent:IntermediateEvent,
        AndGate:          AndGate,
        OrGate:           OrGate,
        XorGate:          XorGate,
        PriorityAndGate:  PriorityAndGate,
        VotingOrGate:     VotingOrGate,
        InhibitGate:      InhibitGate,
        ChoiceEvent:      ChoiceEvent,
        RedundancyEvent:  RedundancyEvent,
        HouseEvent:       HouseEvent,
        TopEvent:         TopEvent,

        newNodeForType:   newNodeForType
    };
})