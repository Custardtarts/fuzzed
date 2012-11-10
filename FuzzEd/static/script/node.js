define(['config', 'mirror', 'properties', 'backend', 'class', 'jsplumb', 'jquery.svg'],
    function(Config, Mirror, Properties, Backend, Class) {

    /*
     *  Abstract Node Base Class
     */
    return Class.extend({
        init: function(graph, properties) {
            //TODO: use me, where me is 'graph' parameter
            this.kind = properties.kind || 'node';

            // merge all members of the configuration (defaults) into this object
            jQuery.extend(true, this, FuzztreeConfig.nodes[this.kind]);

            // merge all given properties into this object
            jQuery.extend(this, properties);

            // logic
            this._editor = undefined; // will be set when appending
            this._graph  = undefined; // will be set as soon as it get added to a concrete graph

            if (typeof this.id === 'undefined') {
                // make sure the 0 is not reassigned; it's reserved for the top event
                this.id = new Date().getTime() + 1;
            }

            // state
            this._disabled    = false;
            this._highlighted = false;
            this._selected    = false;

            // visuals
            // TODO: maybe move that to a better place
            jsPlumb.extend(this.connector, jsPlumb.Defaults.PaintStyle);

            var visuals             = this._setupVisualRepresentation();
            this._container         = visuals.container;
            this._nodeImage         = visuals.nodeImage;
            this._connectionHandle  = visuals.connectionHandle;
            this._optionalIndicator = visuals.optionalIndicator;

            this.propertyMirrors     = this._setupMirrors(this.propertyMirrors);
            this.propertyMenuEntries = this._setupPropertyMenuEntries(this.propertyMenuEntries);
        },

        allowsConnectionsTo: function(otherNode) {
            // no connections to same node
            if (this == otherNode) return false;

            // otherNode must be in the 'allowConnectionTo' list defined in the notations
            var allowed = false;
            _.each(this.allowConnectionTo, function(nodeKind) {
                if (otherNode instanceof nodeKindToClassMapping[nodeKind]) allowed = true;
            });
            if (!allowed) return false;

            // no connections to the top event
            // TODO: this can not be covered with the notations since 'allowConnectionTo' is the wrong direction
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
            });
            this._container.remove();
        },

        moveTo: function(x, y) {
            this.x = x;
            this.y = y;

            var pixelPos = this._editor.toPixel(x, y);
            var image = this._nodeImage;
            var offsetX = image.position().left + image.outerWidth(true) / 2;
            var offsetY = image.position().top  + image.outerHeight(true) / 2;

            this._container.css({
                left: pixelPos.x - offsetX || 0,
                top:  pixelPos.y - offsetY || 0
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
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_HIGHLIGHTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
                }
            } else {
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_NORMAL);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_NORMAL);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
                }
            }

            return this;
        },

        disable: function() {
            this._disabled = true;
            this._nodeImage.primitives.css('stroke', Config.Node.STROKE_DISABLED);
            this._optionalIndicator.attr('stroke', Config.Node.STROKE_DISABLED);
            if (!this.optional) {
                this._optionalIndicator.attr('fill', Config.Node.STROKE_DISABLED);
            }

            return this;
        },

        enable: function() {
            this._disabled = false;

            if (this._selected) {
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_SELECTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_SELECTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_SELECTED);
                }
            } else if (this._highlighted) {
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_HIGHLIGHTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
                }
            } else {
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_NORMAL);
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
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_HIGHLIGHTED);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
                }
            } else {
                this._nodeImage.primitives.css('stroke', Config.Node.STROKE_NORMAL);
                this._optionalIndicator.attr('stroke', Config.Node.STROKE_NORMAL);
                if (!this.optional) {
                    this._optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
                }
            }

            return this;
        },

        properties: function() {
            return {}
        },

        select: function() {
            // don't allow selection of disabled nodes
            if (this._disabled) return this;

            this._selected = true;
            this._container.addClass(Config.Classes.NODE_SELECTED);
            this._nodeImage.primitives.css('stroke', Config.Node.STROKE_SELECTED);
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

        /**
         *  Method: _getPositionOnCanvas
         *      Returns the (pixel) position of the node (center of the node image) relative to the canvas.
         *  Returns:
         *      Object containing the 'x' and 'y' position.
         */
        _getPositionOnCanvas: function() {
            var editorOffset = this._editor.canvas.offset();
            var x = this._nodeImage.offset().left + this._nodeImage.width() / 2 - editorOffset.left;
            var y = this._nodeImage.offset().top + this._nodeImage.height() / 2 - editorOffset.top;

            return {'x': x, 'y': y};
        },

        _resize: function() {
            // calculate the scale factor
            var marginOffset = this._nodeImage.outerWidth(true) - this._nodeImage.width();
            var scaleFactor  = (Config.Grid.SIZE - marginOffset) / this._nodeImage.height();

            // resize the svg and the groups
            this._nodeImage.attr('width', this._nodeImage.width()  * scaleFactor);
            this._nodeImage.attr('height', this._nodeImage.height() * scaleFactor);

            var newTransform = 'scale(' + scaleFactor + ')';
            if (this._nodeImage.groups.attr('transform')) {
                newTransform += ' ' + this._nodeImage.groups.attr('transform');
            }
            this._nodeImage.groups.attr('transform', newTransform);

            // XXX: In Webkit browsers the container div does not resize properly. This should fix it.
            this._container.width(this._nodeImage.width());
        },

        _setupDragging: function() {
            jsPlumb.draggable(this._container, {
                containment: 'parent',
                opacity:     Config.Dragging.OPACITY,
                cursor:      Config.Dragging.CURSOR,
                grid:        [Config.Grid.SIZE, Config.Grid.SIZE],
                stack:       '.' + Config.Classes.NODE + ', .' + Config.Classes.JSPLUMB_CONNECTOR,

                // start dragging callback
                start:       function() {
                    this._editor.selection.ofNodes(this);
                }.bind(this),

                // stop dragging callback
                stop:        function(eventObject, uiHelpers) {
                    var coordinates = this._editor.toGrid(this._getPositionOnCanvas());
                    Backend.changeNode(this, coordinates);
                }.bind(this)
            });
        },

        _setupEndpoints: function() {
            // get upper and lower image offsets
            if (typeof this.optional === 'undefined' || this.optional == null) {
                var topOffset = this._nodeImage.offset().top - this._container.offset().top;
            } else {
                var optionalIndicatorWrapper = jQuery(this._optionalIndicator._container);
                var topOffset = optionalIndicatorWrapper.offset().top - this._container.offset().top;
                topOffset += 1; // fine-tuning
            }
            topOffset -= this.connector.offset.top;
            var bottomOffset = this._nodeImage.offset().top - this._container.offset().top + this._nodeImage.height();
            bottomOffset += this.connector.offset.bottom;
            bottomOffset -= 2; // fine-tuning

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

        _setupMirrors: function(propertyMirrors) {
            var mirrors = {};
            if (typeof propertyMirrors === 'undefined') return mirrors;

            _.each(FuzztreeConfig.propertiesDisplayOrder, function(property) {
                var mirrorDefinition = propertyMirrors[property];

                if (typeof mirrorDefinition === 'undefined' || mirrorDefinition === null) return;
                mirrors[property] = new Mirror(this._container, mirrorDefinition);
            }.bind(this))

            return mirrors;
        },

        _setupPropertyMenuEntries: function(propertyMenuEntries) {
            var menuEntries = {};
            if (typeof propertyMenuEntries === 'undefined') return menuEntries;

            _.each(FuzztreeConfig.propertiesDisplayOrder, function(property) {
                var menuEntry = propertyMenuEntries[property];
                if (typeof menuEntry === 'undefined' || menuEntry === null) return;

                var mirror = this.propertyMirrors[property]

                menuEntry.property = property;
                menuEntries[property] = Properties.newFrom(this, mirror, menuEntry);
            }.bind(this));

            if (_.has(menuEntries, 'optional')) {
                menuEntries.optional.change = function() {
                    this.setOptional(this.optional);
                }.bind(this)
            }

            return menuEntries;
        },

        _setupVisualRepresentation: function() {
            // get the thumbnail, clone it and wrap it with a container (for labels)
            var container = jQuery('<div>');
            var nodeImage = jQuery('#' + Config.IDs.SHAPES_MENU + ' #' + this.kind).clone();
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
                .removeAttr('id')
                // add new classes for the actual node
                .addClass(Config.Classes.NODE_IMAGE)
                .appendTo(container);

            // links to primitive shapes and groups of the SVG for later manipulation (highlighting, ...)
            nodeImage.primitives = nodeImage.find('rect, circle, path');
            nodeImage.groups = nodeImage.find('g');

            if (this.numberOfIncomingConnections != 0) {
                var connectionHandle = jQuery('<i class="icon-plus icon-white"></i>')
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
    })
});