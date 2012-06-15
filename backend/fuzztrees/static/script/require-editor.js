define(['require-config', 'require-nodes', 'require-backend'], function(Config, Nodes, Backend) {

    /*
     *  ShapeMenu
     */
    function ShapeMenu() {
        this._shapes = jQuery('#' + Config.IDs.SHAPES_MENU);

        this._setupDragging();
        this._setupThumbnails();
    }

    ShapeMenu.prototype._setupDragging = function() {
        jQuery('#' + Config.IDs.SHAPES_MENU).draggable({
            containment:   '#' + Config.IDs.CONTENT,
            stack:         '.' + Config.Classes.NODE,
            cursor:        Config.Dragging.CURSOR,
            scroll:        false,
            snap:          '#' + Config.IDs.CONTENT,
            snapMode:      'inner',
            snapTolerance: Config.Dragging.SNAP_TOLERANCE
        });
    }

    ShapeMenu.prototype._setupThumbnails = function() {  
        var thumbnails = this._shapes.find('.' + Config.Classes.NODE_THUMBNAIL);
        var svgs       = thumbnails.children('svg');

        // scale the icons down
        svgs.width (svgs.width()  * Config.ShapeMenu.THUMBNAIL_SCALE_FACTOR);
        svgs.height(svgs.height() * Config.ShapeMenu.THUMBNAIL_SCALE_FACTOR);
        svgs.each(function() {
            var g = jQuery(this).children('g');
            g.attr('transform', 'scale(' + Config.ShapeMenu.THUMBNAIL_SCALE_FACTOR + ') ' + g.attr('transform'));
        });

        // make shapes in the menu draggable
        thumbnails.draggable({
            helper:   'clone',
            opacity:  Config.Dragging.OPACITY,
            cursor:   Config.Dragging.CURSOR,
            appendTo: 'body',
            revert:   'invalid',
            zIndex:   200
        });
    }

    /*
     *  PropertiesMenu
     */
    function PropertiesMenu() {
        // menu is the container and properties the actual element where properties will bea added
        this._menu = jQuery('#' + Config.IDs.PROPERTIES_MENU);
        this._list = this._menu.find('.ui-listview');

        this._setupDragging();
    }

    PropertiesMenu.prototype.hide = function() {
        this._menu.hide();

        _.each(this._nodes, function(node, index) {
            _.each(node.properties(), function(property) {
                property.hide();
            })
        });
        this._list.children(':not(:eq(0))').remove();

        delete this._nodes;
    }

    PropertiesMenu.prototype.show = function(nodes, force) {
        if (!_.isArray(nodes)) this._nodes = [nodes];
        else                   this._nodes =  nodes;

        if (force || typeof(this._nodes) === 'undefined' || _.any(this._nodes, function(node) { return node.properties().length > 0})) {
            this._menu.show();

            _.each(this._nodes, function(node) {
                var frame = this._makePropertyFrame(node)
                this._list.append(frame);

                _.each(node.properties(), function(property) {
                    property.show(frame.children('form'));
                }.bind(this));
            }.bind(this));

            this._list.listview('refresh');
        }

        return this;
    }

    PropertiesMenu.prototype._makePropertyFrame = function(node) {
        var li    = jQuery('<li>');

        var title = jQuery('<h3>')
            .html(node.name())
            .appendTo(li);

        var form  = jQuery('<form>')
            .attr('action', '#')
            .attr('method', 'get')
            .addClass(Config.Classes.PROPERTIES)
            .appendTo(li)
            .keydown(function(eventObject) {
                if (eventObject.which === jQuery.ui.keyCode.ENTER) {
                    eventObject.preventDefault();
                    return false;
                }
            });

        return li;
    }

    PropertiesMenu.prototype._setupDragging = function() {
        this._menu.draggable({
            containment:   '#' + Config.IDs.CONTENT,
            stack:         '.' + Config.Classes.NODE,
            cursor:        Config.Dragging.CURSOR,
            scroll:        false,
            snap:          '#' + Config.IDs.CONTENT,
            snapMode:      'inner',
            snapTolerance: Config.Dragging.SNAP_TOLERANCE
        });
    }

    /*
     *  Selection
     */
    function Selection() {
        this._nodes  = []; // node objects; not DOM elements
        this._connections = [] // jsPlumb Connection objects
        this._editor = jQuery('#' + Config.IDs.CANVAS).data(Config.Keys.EDITOR);
    }

    // clear the selection, leaving the nodes on the canvas
    Selection.prototype.clear = function() {
        _.each(this._nodes, function(node) {
            node.deselect();
        });

        // reset connection and endpoint styles
        _.each(this._connections, function(connection) {
            connection.setPaintStyle({
                strokeStyle: Config.JSPlumb.STROKE
            });
            connection.setHoverPaintStyle({
                strokeStyle: Config.JSPlumb.STROKE_HIGHLIGHTED
            });

            _.each(connection.endpoints, function(endpoint) {
                endpoint.setPaintStyle({
                    fillStyle: Config.JSPlumb.ENDPOINT_FILL
                });
            })
        });

        this._empty();
        this._editor.properties.hide();

        return this;
    }

    Selection.prototype.contains = function(element) {
        return _.indexOf(this._nodes, element) >= 0 || _.indexOf(this._connections, element) >= 0;
    }

    // make a new selection of the given node(s)
    Selection.prototype.ofNodes = function(nodes) {
        this.clear();

        if (_.isArray(nodes)) {
            this._nodes = nodes;
        } else {
            this._nodes.push(nodes);
        }

        _.each(this._nodes, function(node) {
            node.select();
        });
        this._editor.properties.show(nodes);

        return this;
    }

    // make a new selection of the given connections(s)
    Selection.prototype.ofConnections = function(connections) {
        this.clear();

        if (_.isArray(connections)) {
            this._connections = connections;
        } else {
            this._connections.push(connections);
        }

        // mark connections and their endpoints as selected
        _.each(this._connections, function(connection) {
            connection.setPaintStyle({
                strokeStyle: Config.JSPlumb.STROKE_SELECTED
            });
            connection.setHoverPaintStyle({
                strokeStyle: Config.JSPlumb.STROKE_SELECTED
            });

            _.each(connection.endpoints, function(endpoint) {
                endpoint.setPaintStyle({
                    fillStyle: Config.JSPlumb.STROKE_SELECTED
                });
            })
        });

        return this;
    }

    // remove the current contained nodes from the canvas and clear the selection
    Selection.prototype.remove = function() {
        _.each(this._nodes, function(node) {
            node.remove();
        })

        _.each(this._connections, function(connection) {
            jsPlumb.detach(connection);
        })

        this._empty();
        this._editor.properties.hide();

        return this;
    }

    // helper function to empty the selected nodes
    Selection.prototype._empty = function() {
        this._nodes = [];
        this._connections = [];
        return this;
    }

    /*
     *  Editor
     */
    function Editor(graph) {
        this._graph = graph;

        // locate own DOM elements and bind Editor instance to canvas
        this._canvas     = jQuery('#' + Config.IDs.CANVAS);
        this._background = this._canvas.svg().svg('get');
        this._canvas.data(Config.Keys.EDITOR, this);

        // create manager objects for the bars and the selection
        this.shapes     = new ShapeMenu();
        this.properties = new PropertiesMenu();
        this.selection  = new Selection();

        // run a few sub initializer
        this._setupBackground();
        this._setupCanvas();
        this._setupJsPlumb();
        this._setupKeyBindings();
    }

    // asynchronous factory method
    Editor.createFromGraphId = function(graphId) {
        Backend.getGraph(graphId,
            // success
            function(graph) {
                return new Editor(graph);
            },
            // failure
            function(error) {
                console.log(error);
            }
        );
    }

    Editor.prototype.graph = function() {
        return this._graph;
    }

    Editor.prototype.toGrid = function(first, second) {
        var x = Number.NaN;
        var y = Number.NaN;

        // if both parameter are numbers we can take them as they are
        if (_.isNumber(first) && _.isNumber(second)) {
            x = first;
            y = second;

        // however the first parameter could also be an object
        // of the form {x: NUMBER, y: NUMBER} (convenience reasons)
        } else if (typeof first === 'object') {
            x = first.x;
            y = first.y;
        }

        return {
            x: Math.round((first  - Config.Grid.HALF_SIZE) / Config.Grid.SIZE),
            y: Math.round((second - Config.Grid.HALF_SIZE) / Config.Grid.SIZE)
        }
    }

    Editor.prototype._drawGrid = function() {
        var height = this._canvas.height();
        var width  = this._canvas.width();

        // clear old background and resize svg container to current canvas size
        // important when window was resized in the mean time
        this._background.clear();
        this._background.configure({
            height: height,
            width:  width
        });

        // horizontal lines
        for (var y = Config.Grid.HALF_SIZE; y < height; y += Config.Grid.SIZE) {
            this._background.line(0, y, width, y, {
                stroke:          Config.Grid.STROKE,
                strokeWidth:     Config.Grid.STROKE_WIDTH,
                strokeDashArray: Config.Grid.STROKE_STYLE
            });
        }

        // vertical lines
        for (var x = Config.Grid.HALF_SIZE; x < width; x += Config.Grid.SIZE) {
            this._background.line(x, 0, x, height, {
                stroke:          Config.Grid.STROKE,
                strokeWidth:     Config.Grid.STROKE_WIDTH,
                strokeDashArray: Config.Grid.STROKE_STYLE
            });
        }
    }

    Editor.prototype._setupBackground = function() {
        this._drawGrid();

        // clicks on the canvas clear the selection
        this._canvas.click(this.selection.clear.bind(this.selection));
        // redraw the background grid when the window resizes
        jQuery(window).resize(this._drawGrid.bind(this));
    }

    Editor.prototype._setupCanvas = function() {
        // make canvas droppable for shapes from the shape menu
        this._canvas.droppable({
            accept:    '.' + Config.Classes.NODE_THUMBNAIL,
            tolerance: 'fit',
            drop:      this._shapeDropped.bind(this)
        });
    }

    Editor.prototype._setupJsPlumb = function() {
        jsPlumb.importDefaults({
            EndpointStyle: {
                fillStyle:   Config.JSPlumb.ENDPOINT_FILL
            },
            Endpoint:        [Config.JSPlumb.ENDPOINT_STYLE, 
                {
                    radius:     Config.JSPlumb.ENDPOINT_RADIUS,
                    cssClass:   Config.Classes.JSPLUMB_ENDPOINT,
                    hoverClass: Config.Classes.JSPLUMB_ENDPOINT_HOVER
                }],
            PaintStyle: {
                strokeStyle: Config.JSPlumb.STROKE,
                lineWidth:   Config.JSPlumb.STROKE_WIDTH
            },
            HoverPaintStyle: {
                strokeStyle: Config.JSPlumb.STROKE_HIGHLIGHTED
            },
            Connector:       Config.JSPlumb.STROKE_STYLE,
            Anchors:         ['BottomMiddle', 'TopMiddle'],
            ConnectionsDetachable: false
        });

        var editor = this;
        // listen for clicks on connections for selections
        jsPlumb.bind('click', function(connection, event) {
            event.stopPropagation();
            editor.selection.ofConnections(connection);
        });
    }

    Editor.prototype._setupKeyBindings = function() {
        jQuery(document).keydown(function(eventObject) {
            // hitting delete removes the current selection from the canvas
            if (eventObject.which === jQuery.ui.keyCode.DELETE) {
                this.selection.remove();
            }
        }.bind(this));
    }

    Editor.prototype._shapeDropped = function(uiEvent, uiObject) {
        //var node        = new (uiObject.draggable.data(Config.Keys.CONSTRUCTOR))();
        var typeId    = uiObject.draggable.attr('typeId');
        var offset      = this._canvas.offset();
        var gridCoords  = this.toGrid(uiEvent.pageX - offset.left, uiEvent.pageY - offset.top);

        // create node in the backend and append it to the DOM afterwards
        var editor = this;
        Backend.addNode(this._graph, typeId, gridCoords, function(node) {
            node._editor = editor;
            node.moveTo(gridCoords.x * Config.Grid.SIZE, gridCoords.y * Config.Grid.SIZE)
                .appendTo(editor._canvas);
            editor.selection.ofNodes(node);
        });
    }

    return Editor;
});