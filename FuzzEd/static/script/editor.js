define(['factory', 'class', 'menus', 'canvas', 'backend', 'alerts', 'progress_indicator', 'jquery-classlist', 'jsplumb'],
function(Factory, Class, Menus, Canvas, Backend, Alerts, Progress) {
    /**
     *  Package: Base
     */

    /**
     * Class: Editor
     *      This is the _abstract_ base class for all graph-kind-specific editors. It manages the visual components
     *      like menus and the graph itself. It is also responsible for global keybindings.
     */
    return Class.extend({
        /**
         * Group: Members:
         *      {Object}              config                        - Graph-specific <Config> object.
         *      {<Graph>}             graph                         - <Graph> instance to be edited.
         *      {<PropertiesMenu>}    properties                    - The <PropertiesMenu> instance used by this editor
         *                                                            for changing the properties of nodes of the edited
         *                                                            graph.
         *      {<ShapesMenu>}        shapes                        - The <Menu::ShapeMenu> instance use by this editor
         *                                                            to show the available shapes for the kind of the
         *                                                            edited graph.
         *      {<Backend>}           _backend                      - The instance of the <Backend> that is used to
         *                                                            communicate graph changes to the server.
         *      {Object}              _currentMinContentOffsets     - Previously calculated minimal content offsets.
         *      {jQuery Selector}     _nodeOffsetPrintStylesheet    - The dynamically generated stylesheet used to fix
         *                                                            the node offset when printing the page.
         *      {Underscore Template} _nodeOffsetStylesheetTemplate - The underscore.js template used to generate the
         *                                                            CSS transformation for the print offset.
         */
        factory:                       undefined,
        graph:                         undefined,
        properties:                    undefined,
        shapes:                        undefined,
        layout:                        undefined,

        _backend:                      undefined,
        _currentMinNodeOffsets:        {'top': 0, 'left': 0},
        _nodeOffsetPrintStylesheet:    undefined,
        _nodeOffsetStylesheetTemplate: undefined,

        _clipboard:                    undefined,

        /**
         * Group: Initialization
         */

        /**
         * Constructor: init
         *      Sets up the editor interface, handlers and loads the graph with the given ID from the backend.
         *
         * Parameters:
         *      {Number} graphId - The ID of the graph that is going to be edited by this editor.
         */
        init: function(graphId) {
            if (typeof graphId !== 'number')
                throw new TypeError('numeric graph ID', typeof graphId);

            this._backend = Backend.establish(graphId);

            // remember certain UI elements
            this._progressIndicator = jQuery('#' + Factory.getModule('Config').IDs.PROGRESS_INDICATOR);
            this._progressMessage = jQuery('#' + Factory.getModule('Config').IDs.PROGRESS_MESSAGE);

            // run a few sub initializer
            this._setupJsPlumb()
                ._setupNodeOffsetPrintStylesheet()
                ._setupEventCallbacks()
                ._setupMenuActions()
                ._setupDropDownBlur();

            // fetch the content from the backend
            this._loadGraph(graphId);
        },

        /**
         * Group: Graph Loading
         */

        /**
         * Method: _loadGraph
         *      Asynchronously loads the graph with the given ID from the backend. <_loadGraphFromJson> will be called
         *      when retrieval was successful.
         *
         * Parameters:
         *      {Number} graphId - ID of the graph that should be loaded.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _loadGraph: function(graphId) {
            this._backend.getGraph(
                this._loadGraphFromJson.bind(this),
                this._loadGraphError.bind(this)
            );

            return this;
        },

        /**
         * Method: _loadGraphCompleted
         *      Callback that gets fired when the graph is loaded completely. We need to perform certain actions
         *      afterwards, like initialization of menus and activation of backend observers to prevent calls to the
         *      backend while the graph is initially constructed.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _loadGraphCompleted: function(readOnly) {
            // create manager objects for the bars
            //TODO: put this into the factory
            this.properties = new Menus.PropertiesMenu(Factory.getNotation().propertiesDisplayOrder);
            this.shapes     = new Menus.ShapeMenu();
            this.layout     = new Menus.LayoutMenu();
            this.graph.layoutMenu = this.layout;
            this._backend.activate();

            if (readOnly) {
                Alerts.showInfoAlert('Remember:', 'this diagram is read-only');
                this.shapes.disable();
                this.properties.disable();
                Canvas.disableInteraction();
            }

            // update the available menu items for the first time
            this._updateMenuActions();

            // enable user interaction
            this._setupMouse()
                ._setupKeyBindings(readOnly);

            // fade out the splash screen
            jQuery('#' + Factory.getModule('Config').IDs.SPLASH).fadeOut(Factory.getModule('Config').Splash.FADE_TIME, function() {
                jQuery(this).remove();
            });

            return this;
        },

        /**
         * Method: _loadGraphError
         *      Callback that gets called in case <_loadGraph> results in an error.
         */
        _loadGraphError: function(response, textStatus, errorThrown) {
            throw new NetworkError('could not retrieve graph');
        },

        /**
         * Method: _loadGraphFromJson
         *      Callback triggered by the backend, passing the loaded JSON representation of the graph. It will
         *      initialize the editor's graph instance using the <Graph> class returned in <getGraphClass>.
         *
         * Parameters:
         *      {Object} json - JSON representation of the graph, loaded from the backend.
         *
         *  Returns:
         *      This {<Editor>} instance for chaining.
         */
        _loadGraphFromJson: function(json) {
            this.graph = Factory.create('Graph', json);
            this._loadGraphCompleted(json.readOnly);

            return this;
        },

        /**
         *  Group: Setup
         */
        
        /**
         * Method: _setupDropDownBlur
         *      Register an event handler that takes care of closing and blurring all currently open drop down menu
         *      items from the toolbar.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupDropDownBlur: function () {
            jQuery('#' + Factory.getModule('Config').IDs.CANVAS).mousedown(function(event) {
                // close open bootstrap dropdown
                jQuery('.dropdown.open')
                    .removeClass('open')
                    .find('a')
                    .blur();
            });
            
            return this;
        },

        /**
         * Method: _setupMenuActions
         *      Registers the event handlers for graph type - independent menu entries that trigger JS calls
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupMenuActions: function() {
            jQuery('#' + Factory.getModule('Config').IDs.ACTION_GRID_TOGGLE).click(function() {
                Canvas.toggleGrid();
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_CUT).click(function() {
                this._cutSelection();
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_COPY).click(function() {
                this._copySelection();
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_PASTE).click(function() {
                this._paste();
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_DELETE).click(function() {
                this._deleteSelection();
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_SELECTALL).click(function(event) {
                this._selectAll(event);
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_LAYOUT_CLUSTER).click(function() {
                this.graph._layoutWithAlgorithm(this.graph._getClusterLayoutAlgorithm());
            }.bind(this));

            jQuery('#' + Factory.getModule('Config').IDs.ACTION_LAYOUT_TREE).click(function() {
                this.graph._layoutWithAlgorithm(this.graph._getTreeLayoutAlgorithm());
            }.bind(this));

            // set the shortcut hints from 'Ctrl+' to '⌘' when on Mac
            if (navigator.platform == 'MacIntel' || navigator.platform == 'MacPPC') {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_CUT + ' span').text('⌘X');
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_COPY + ' span').text('⌘C');
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_PASTE + ' span').text('⌘P');
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_SELECTALL + ' span').text('⌘A');
            }

            return this;
        },

        /**
         * Method: _setupJsPlumb
         *      Sets all jsPlumb defaults used by this editor.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupJsPlumb: function() {
            jsPlumb.importDefaults({
                EndpointStyle: {
                    fillStyle:   Factory.getModule('Config').JSPlumb.ENDPOINT_FILL
                },
                Endpoint:        [Factory.getModule('Config').JSPlumb.ENDPOINT_STYLE, {
                    radius:      Factory.getModule('Config').JSPlumb.ENDPOINT_RADIUS,
                    cssClass:    Factory.getModule('Config').Classes.JSPLUMB_ENDPOINT,
                    hoverClass:  Factory.getModule('Config').Classes.HIGHLIGHTED
                }],
                PaintStyle: {
                    strokeStyle: Factory.getModule('Config').JSPlumb.STROKE_COLOR,
                    lineWidth:   Factory.getModule('Config').JSPlumb.STROKE_WIDTH,
                    outlineColor:Factory.getModule('Config').JSPlumb.OUTLINE_COLOR,
                    outlineWidth:Factory.getModule('Config').JSPlumb.OUTLINE_WIDTH
                },
                HoverPaintStyle: {
                    strokeStyle: Factory.getModule('Config').JSPlumb.STROKE_COLOR_HIGHLIGHTED
                },
                HoverClass:      Factory.getModule('Config').Classes.HIGHLIGHTED,
                Connector:       [Factory.getModule('Config').JSPlumb.CONNECTOR_STYLE, Factory.getModule('Config').JSPlumb.CONNECTOR_OPTIONS],
                ConnectionsDetachable: false,
                ConnectionOverlays: Factory.getModule('Config').JSPlumb.CONNECTION_OVERLAYS
            });

            jsPlumb.connectorClass = Factory.getModule('Config').Classes.JSPLUMB_CONNECTOR;

            return this;
        },

        /**
         * Method: _setupMouse
         *      Sets up callbacks that fire when the user interacts with the editor using his mouse. So far this is
         *      only concerns resizing the window.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupMouse: function() {
            jQuery(window).resize(function() {
                var content = jQuery('#' + Factory.getModule('Config').IDs.CONTENT);

                Canvas.enlarge({
                    x: content.width(),
                    y: content.height()
                }, true);
            }.bind(this));

            return this;
        },

        /**
         * Method: _setupKeyBindings
         *      Setup the global key bindings
         *
         * Keys:
         *      ESCAPE             - Clear selection.
         *      DELETE/BACKSPACE   - Delete all selected elements (nodes/edges).
         *      UP/RIGHT/DOWN/LEFT - Move the node in the according direction
         *      CTRL/CMD + A       - Select all nodes and edges
         *      CTRL/CMD + C/X/V   - Copy, cut and paste
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupKeyBindings: function(readOnly) {
            if (readOnly) return this;

            jQuery(document).keydown(function(event) {
                if (event.which == jQuery.ui.keyCode.ESCAPE) {
                    this._escapePressed(event);
                } else if (event.which === jQuery.ui.keyCode.DELETE || event.which === jQuery.ui.keyCode.BACKSPACE) {
                    this._deletePressed(event);
                } else if (event.which === jQuery.ui.keyCode.UP) {
                    this._arrowKeyPressed(event, 0, -1);
                } else if (event.which === jQuery.ui.keyCode.RIGHT) {
                    this._arrowKeyPressed(event, 1, 0);
                } else if (event.which === jQuery.ui.keyCode.DOWN) {
                    this._arrowKeyPressed(event, 0, 1);
                } else if (event.which === jQuery.ui.keyCode.LEFT) {
                    this._arrowKeyPressed(event, -1, 0);
                } else if (event.which === 'A'.charCodeAt() && (event.metaKey || event.ctrlKey)) {
                    this._selectAllPressed(event);
                } else if (event.which === 'C'.charCodeAt() && (event.metaKey || event.ctrlKey)) {
                    this._copyPressed(event);
                } else if (event.which === 'X'.charCodeAt() && (event.metaKey || event.ctrlKey)) {
                    this._cutPressed(event);
                } else if (event.which === 'V'.charCodeAt() && (event.metaKey || event.ctrlKey)) {
                    this._pastePressed(event);
                }
            }.bind(this));

            return this;
        },

        /**
         * Method: _setupNodeOffsetPrintStylesheet
         *      Creates a print stylesheet which is used to compensate the node offsets on the canvas when printing.
         *      Also sets up the CSS template which is used to change the transformation every time the content changes.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupNodeOffsetPrintStylesheet: function() {
            // dynamically create a stylesheet, append it to the head and keep the reference to it
            this._nodeOffsetPrintStylesheet = jQuery('<style>')
                .attr('type',  'text/css')
                .attr('media', 'print')
                .appendTo('head');

            // this style will transform all elements on the canvas by the given 'x' and 'y' offset
            var transformCssTemplateText =
                '#' + Factory.getModule('Config').IDs.CANVAS + ' > * {\n' +
                '   transform: translate(<%= x %>px,<%= y %>px);\n' +
                '   -ms-transform: translate(<%= x %>px,<%= y %>px); /* IE 9 */\n' +
                '   -webkit-transform: translate(<%= x %>px,<%= y %>px); /* Safari and Chrome */\n' +
                '   -o-transform: translate(<%= x %>px,<%= y %>px); /* Opera */\n' +
                '   -moz-transform: translate(<%= x %>px,<%= y %>px); /* Firefox */\n' +
                '}';
            // store this as a template so we can use it later to manipulate the offset
            this._nodeOffsetStylesheetTemplate = _.template(transformCssTemplateText);

            return this;
        },

        /**
         * Method: _setupEventCallbacks
         *      Registers all event listeners of the editor.
         *
         * On:
         *      <Config::Events::NODE_DRAG_STOPPED>
         *      <Config::Events::NODE_ADDED>
         *      <Config::Events::NODE_DELETED>
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _setupEventCallbacks: function() {
            // events that trigger a re-calculation of the print offsets
            jQuery(document).on(Factory.getModule('Config').Events.NODE_DRAG_STOPPED,  this._updatePrintOffsets.bind(this));
            jQuery(document).on(Factory.getModule('Config').Events.NODE_ADDED,         this._updatePrintOffsets.bind(this));
            jQuery(document).on(Factory.getModule('Config').Events.NODE_DELETED,       this._updatePrintOffsets.bind(this));

            // update the available menu actions corresponding to the current selection
            jQuery(document).on([ Factory.getModule('Config').Events.NODE_SELECTED,
                                  Factory.getModule('Config').Events.NODE_UNSELECTED ].join(' '), this._updateMenuActions.bind(this));

            // show status of global AJAX events in navbar
            jQuery(document).ajaxSend(Progress.showAjaxProgress);
            jQuery(document).ajaxSuccess(Progress.flashAjaxSuccessMessage);
            jQuery(document).ajaxError(Progress.flashAjaxErrorMessage);

            return this;
        },

        /**
         * Group: Graph Editing
         */

        /**
         * Method: _deleteSelection
         *      Will remove the selected nodes and edges.
         *
         * Returns:
         *      This {<Editor>} instance for chaining
         */
        _deleteSelection: function() {
            var deletableNodes      = this._deletable(this._selectedNodes());
            var deletableEdges      = this._deletable(this._selectedEdges());
            var deletableNodeGroups = this._deletable(this._selectedNodeGroups());

            // delete selected nodes
            _.each(deletableNodes, this.graph.deleteNode.bind(this.graph));

            // delete selected edges
            _.each(deletableEdges, this.graph.deleteEdge.bind(this.graph));

            // delete selected node groups
            _.each(deletableNodeGroups, this.graph.deleteNodeGroup.bind(this.graph));

            // if at least one element was deletable, hide the properties window
            if (_.union(deletableNodes, deletableEdges, deletableNodeGroups).length > 0) this.properties.hide();

            // update the available menu actions
            this._updateMenuActions();

            return this;
        },

        /**
         * Method: _selectedNodes
         *      Finds currently selected nodes.
         *
         * Returns:
         *      An array of currently selected {<Node>} instances.
         */
        _selectedNodes: function() {
            var selectedNodes = '.' + Factory.getModule('Config').Classes.SELECTED + '.' + Factory.getModule('Config').Classes.NODE;

            var nodes = [];
            jQuery(selectedNodes).each(function(index, element) {
                var node = this.graph.getNodeById(jQuery(element).data(Factory.getModule('Config').Keys.NODE).id);
                nodes.push(node);
            }.bind(this));

            return nodes;
        },

        /**
         * Method: _selectedEdges
         *      Finds currently selected edges.
         *
         * Returns:
         *      An array of currently selected {<Edge>} instances.
         */
        _selectedEdges: function() {
            var selectedEdges = '.' + Factory.getModule('Config').Classes.SELECTED + '.' + Factory.getModule('Config').Classes.JSPLUMB_CONNECTOR;

            var edges = [];
            jQuery(selectedEdges).each(function(index, element) {
                var edge = jQuery(element).data(Factory.getModule('Config').Keys.EDGE);
                edges.push(edge);
            }.bind(this));

            return edges;
        },

        /**
         * Method: _selectedNodeGroups
         *      Finds currently selected node groups.
         *
         * Returns:
         *      An array of currently selected {<NodeGroup>} instances.
         */
        _selectedNodeGroups: function() {
            var nodegroups = [];
            // find selected node groups (NASTY!!!)
            var allNodeGroups = '.' + Factory.getModule('Config').Classes.NODEGROUP;

            jQuery(allNodeGroups).each(function(index, element) {
                var nodeGroup = jQuery(element).data(Factory.getModule('Config').Keys.NODEGROUP);
                // since the selectable element is an svg path, we need to look for that nested element and check its
                //   state of selection via the CSS class .selected
                if (nodeGroup.container.find("svg path").hasClass(Factory.getModule('Config').Classes.SELECTED)) {
                    nodegroups.push(nodeGroup);
                }
            }.bind(this));

            return nodegroups;
        },

        /**
         * Method: _copyable
         *      Filters the given array of elements (Nodes, Edges, NodeGroups) for copyable ones.
         *
         * Returns:
         *      An array of elements that are copyable.
         */
        _copyable: function(elements) {
            return _.filter(elements, function(elem) { return elem.copyable; });
        },

        /**
         * Method: _deletable
         *      Filters the given array of elements (Nodes, Edges, NodeGroups) for deletable ones.
         *
         * Returns:
         *      An array of elements that are deletable.
         */
        _deletable: function(elements) {
            return _.filter(elements, function(elem) { return elem.deletable; });
        },

        /**
         * Method: _cuttable
         *      Filters the given array of elements (Nodes, Edges, NodeGroups) for cuttable ones.
         *
         * Returns:
         *      An array of elements that are cuttable.
         */
        _cuttable: function(elements) {
            return _.intersection(this._copyable(elements), this._deletable(elements));
        },

        /**
         * Method: _updateMenuActions
         *      Will update the enabled/disabled status of the menu actions depending on the current selection.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */

        _updateMenuActions: function() {
            var selectedNodes = this._selectedNodes();
            var selectedElems =       selectedNodes.concat(
                                this._selectedEdges().concat(
                                this._selectedNodeGroups()));

            // copy is only available when at least one node is copyable as copying edges or node groups solely won't
            //  have any effect (because they can't be restored)
            if (this._copyable(selectedNodes).length > 0) {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_COPY).parent().removeClass('disabled');
            } else {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_COPY).parent().addClass('disabled');
            }

            // same here: cut is only available when at least one node is cuttable
            if (this._cuttable(selectedNodes).length > 0) {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_CUT).parent().removeClass('disabled');
            } else {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_CUT).parent().addClass('disabled');
            }

            // delete is only available when the selection is not empty and at least one element is deletable
            if (selectedElems.length > 0 && this._deletable(selectedElems).length > 0) {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_DELETE).parent().removeClass('disabled');
            } else {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_DELETE).parent().addClass('disabled');
            }

            // paste is only available when there is something in the clipboard
            if (this._getClipboard()) {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_PASTE).parent().removeClass('disabled');
            } else {
                jQuery('#' + Factory.getModule('Config').IDs.ACTION_PASTE).parent().addClass('disabled');
            }

            return this;
        },

        /**
         * Method: _selectAll
         *      Will select all nodes and edges.
         *
         * Parameters:
         *      {jQuery::Event} event - the issued select all keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */

        _selectAll: function(event) {
            //XXX: trigger selection start event manually here
            //XXX: hack to emulate a new selection process
            Canvas.container.data(Factory.getModule('Config').Keys.SELECTABLE)._mouseStart(event);

            jQuery('.'+Factory.getModule('Config').Classes.SELECTEE)
                .addClass(Factory.getModule('Config').Classes.SELECTING)
                .addClass(Factory.getModule('Config').Classes.SELECTED);

            //XXX: trigger selection stop event manually here
            //XXX: nasty hack to bypass draggable and selectable incompatibility, see also canvas.js
            Canvas.container.data(Factory.getModule('Config').Keys.SELECTABLE)._mouseStop(null);
        },

        /**
         * Method: _deselectAll
         *      Deselects all the nodes and edges in the current graph.
         *
         * Parameters:
         *      {jQuery::Event} event - (optional) the issued select all keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _deselectAll: function(event) {
            if (typeof event === 'undefined') {
                event = window.event;
            }

            //XXX: Since a deselect-click only works without metaKey or ctrlKey pressed,
            // we need to deactivate them manually.
            var hackEvent = jQuery.extend({}, event, {
                metaKey: false,
                ctrlKey: false
            });

            //XXX: deselect everything
            // This uses the jQuery.ui.selectable internal functions.
            // We need to trigger them manually in order to simulate a click on the canvas.
            Canvas.container.data(Factory.getModule('Config').Keys.SELECTABLE)._mouseStart(hackEvent);
            Canvas.container.data(Factory.getModule('Config').Keys.SELECTABLE)._mouseStop(hackEvent);

            return this;
        },

        /**
         * Method: _copySelection
         *      Will copy all selected nodes by serializing and saving them to HTML5 Local Storage or the _clipboard
         *      variable if the former capability is not available.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _copySelection: function() {
            // select copyable elements and transform them into dicts for later serialization
            var nodes      = _.invoke(this._copyable(this._selectedNodes()), 'toDict');
            var edges      = _.invoke(this._copyable(this._selectedEdges()), 'toDict');
            var nodegroups = _.invoke(this._copyable(this._selectedNodeGroups()), 'toDict');

            // copying only makes sense, when at least one node is involved (i.e. in the current selection), because
            //  edges and node groups can only be recreated at paste, when nodes are as well.
            if (nodes.length === 0) return;

            var clipboard = {
                'pasteCount': 0,
                'nodes':      nodes,
                'edges':      edges,
                'nodeGroups': nodegroups
            };

            this._updateClipboard(clipboard);

            // update available menu actions, so the paste menu action will be enabled
            this._updateMenuActions();
        },

        /**
         * Method: _paste
         *      Will paste previously copied nodes from HTML5 Local Storage or the _clipboard variable.
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _paste: function() {
            // fetch clipboard from local storage or variable
            var clipboard = this._getClipboard();

            // if there is nothing in the clipboard, return
            if (!clipboard) return;

            // deselect the original nodes and edges
            this._deselectAll();

            // increase paste count (used for nicely positioning multiple pastes)
            var pasteCount = ++clipboard.pasteCount;
            this._updateClipboard(clipboard);

            var nodes       = clipboard.nodes;
            var edges       = clipboard.edges;
            var nodeGroups  = clipboard.nodeGroups;
            var ids         = {}; // stores to every old id the newly generated id to connect the nodes again
            var boundingBox = this._boundingBoxForNodes(nodes); // used along with pasteCount to place the copy nicely

            _.each(nodes, function(jsonNode) {
                var pasteId  = this.graph.createId();
                ids[jsonNode.id] = pasteId;
                jsonNode.id = pasteId;
                jsonNode.x += pasteCount * (boundingBox.width + 1);
                jsonNode.y += pasteCount * (boundingBox.height + 1);

                var node = this.graph.addNode(jsonNode);
                if (node) node.select();
            }.bind(this));

            _.each(edges, function(jsonEdge) {
                jsonEdge.id = undefined;
                jsonEdge.source = ids[jsonEdge.sourceNodeId] || jsonEdge.sourceNodeId;
                jsonEdge.target = ids[jsonEdge.targetNodeId] || jsonEdge.targetNodeId;

                var edge = this.graph.addEdge(jsonEdge);
                if (edge) edge.select();
            }.bind(this));

            _.each(nodeGroups, function(jsonNodeGroup) {
                // remove the original nodeGroup's identity
                jsonNodeGroup.id = undefined;
                // map old ids to new ids
                jsonNodeGroup.nodeIds = _.map(jsonNodeGroup.nodeIds, function(nodeId) {
                    return ids[nodeId] || nodeId;
                });

                var nodeGroup = this.graph.addNodeGroup(jsonNodeGroup);
                if (nodeGroup) nodeGroup.select();
            }.bind(this));

            //XXX: trigger selection stop event manually here
            //XXX: nasty hack to bypass draggable and selectable incompatibility, see also canvas.js
            Canvas.container.data(Factory.getModule('Config').Keys.SELECTABLE)._mouseStop(null);
        },

        /**
         * Method: _cutSelection
         *      Will delete and copy selected nodes by using _updateClipboard().
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _cutSelection: function() {
            this._copySelection();
            this._deleteSelection();

            // set the just copied clipboard's pasteCount to -1, so that it will paste right in place of the original.
            var clipboard = this._getClipboard();
            --clipboard.pasteCount;
            this._updateClipboard(clipboard);
        },

        /**
         * Method: _groupSelection
         *
         *   Will create a new NodeGroup with the current selected nodes.
         *
         *   Note: Node Groups are an abstract concept, that every diagram type has to implement on its own. So this
         *   method can't be accessed by the user, unless you provide Menu Actions or Key Events for it.
         *   (see dfd/editor.js for examples of correct subclassing)
         *
         * Returns:
         *   This Editor instance for chaining.
         */
        _groupSelection: function() {
            var selectedNodes = this._selectedNodes();

            if(selectedNodes.length > 1)
            {
                var jsonNodeGroup = {
                    nodeIds: _.map(selectedNodes, function(node){return node.id;}.bind(this))
                };
                this.graph.addNodeGroup(jsonNodeGroup);
            }

            return this;
        },

        /**
         * Method: _ungroupSelection
         *
         *   Will ungroup either the NodeGroup, that only consists of the selected nodes, or the selected NodeGroups
         *   directly.
         *
         *   Note: This method can't be accessed by the user, unless you provide Menu Actions or Key Events for it.
         *   (see dfd/editor.js for examples of correct subclassing)
         *
         * Returns:
         *   Success
         */
        _ungroupSelection: function() {
            var nodeIds = _.map(this._selectedNodes(), function(node) { return node.id; }.bind(this));

            // case [1]: find the correct node group, whose node ids match the selected ids
            // (i.e. the user has to select all members of a NodeGroup to remove the NodeGroup)
            _.each(this.graph.nodeGroups, function(ng) {
                var ngIds = ng.nodeIds();
                // math recap: two sets are equal, when both their differences are zero length
                if (jQuery(ngIds).not(nodeIds).length === 0 && jQuery(nodeIds).not(ngIds).length === 0) {
                    this.graph.deleteNodeGroup(ng);
                    return true;
                }
            }.bind(this));

            // case [2]: the user selected NodeGroups, (s)he wants to delete, do him/her the favor to delete them
            _.each(this._selectedNodeGroups(), this.graph.deleteNodeGroup.bind(this.graph));

            return false;
        },

        /**
         * Method: _boundingBoxForNodes
         *      Returns the (smallest) bounding box for the given nodes by accessing their x and y coordinates and
         *      finding the minimum and maximum. Used by _paste() to place the copy nicely.
         *
         * Returns:
         *      An {Object} containing the 'width' and 'height' keys of the calculated bounding box.
         */

        _boundingBoxForNodes: function(nodes) {
            var topMostNode     = { 'y': Number.MAX_VALUE };
            var leftMostNode    = { 'x': Number.MAX_VALUE };
            var bottomMostNode  = { 'y': 0 };
            var rightMostNode   = { 'x': 0 };

            _.each(nodes, function(node) {
                if (node.y < topMostNode.y)    { topMostNode    = node; }
                if (node.x < leftMostNode.x)   { leftMostNode   = node; }
                if (node.y > bottomMostNode.y) { bottomMostNode = node; }
                if (node.x > rightMostNode.x)  { rightMostNode  = node; }
            }.bind(this));

            return {
                'width':  rightMostNode.x - leftMostNode.x,
                'height': bottomMostNode.y - topMostNode.y
            };
        },


        /**
         * Group: Clipboard Handling
         */

        /**
         * Method: _updateClipboard
         *      Saves the given clipboardDict either to html5 Local Storage or at least to the Graph's _clipboard var
         *      as JSON string.
         *
         * Parameters:
         *      {Object} clipboardDict - JSON object to be stored
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _updateClipboard: function(clipboardDict) {
            var clipboardString = JSON.stringify(clipboardDict);
            if (typeof window.Storage !== 'undefined') {
                localStorage['clipboard_' + this.graph.kind] = clipboardString;
            } else { // fallback
                this._clipboard = clipboardString;
            }

            return this;
        },

        /**
         * Method: _getClipboard
         *      Returns the current clipboard either from html5 Local Storage or from the Graph's _clipboard var as
         *      JSON.
         *
         * Returns:
         *      The clipboard contents as {Object}.
         */
        _getClipboard: function() {
            if (typeof window.Storage !== 'undefined' && typeof localStorage['clipboard_' + this.graph.kind] !== 'undefined') {
                return JSON.parse(localStorage['clipboard_' + this.graph.kind]);
            } else if (typeof this._clipboard !== 'undefined') {
                return JSON.parse(this._clipboard);
            } else {
                return false;
            }
        },

        /**
         * Group: Keyboard Interaction
         */

        /**
         * Method: _arrowKeyPressed
         *      Event callback for handling presses of arrow keys. Will move the selected nodes in the given direction
         *      by and offset equal to the canvas' grid size. The movement is not done when an input field is currently
         *      in focus.
         *
         * Parameters:
         *      {jQuery::Event} event      - the issued delete keypress event
         *      {Number}        xDirection - signum of the arrow key's x direction movement (e.g. -1 for left)
         *      {Number}        yDirection - signum of the arrow key's y direction movement (e.g.  1 for down)
         *
         * Return:
         *      This {<Editor>} instance for chaining
         */
        _arrowKeyPressed: function(event, xDirection, yDirection) {
            if (jQuery(event.target).is('input, textarea')) return this;

            var selectedNodes = '.' + Factory.getModule('Config').Classes.SELECTED + '.' + Factory.getModule('Config').Classes.NODE;
            jQuery(selectedNodes).each(function(index, element) {
                var node = jQuery(element).data(Factory.getModule('Config').Keys.NODE);
                node.moveBy({
                    x: xDirection * Canvas.gridSize,
                    y: yDirection * Canvas.gridSize
                });
            }.bind(this));

            jQuery(document).trigger(Factory.getModule('Config').Events.NODES_MOVED);

            return this;
        },

        /**
         * Method: _deletePressed
         *      Event callback for handling delete key presses. Will remove the selected nodes and edges by calling
         *      _deleteSelection as long as no input field is currently focused (allows e.g. character removal in
         *      properties).
         *
         * Parameters:
         *      {jQuery::Event} event - the issued delete keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining
         */
        _deletePressed: function(event) {
            // prevent that node is being deleted when we edit an input field
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();
            this._deleteSelection();
            return this;
        },

        /**
         * Method: _escapePressed
         *      Event callback for handling escape key presses. Will deselect any selected nodes and edges by calling
         *      _deselectAll().
         *
         * Parameters:
         *      {jQuery::Event} event - the issued escape keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining
         */
        _escapePressed: function(event) {
            event.preventDefault();
            this._deselectAll(event);
            return this;
        },

        /**
         * Method: _selectAllPressed
         *      Event callback for handling a select all (CTRL/CMD + A) key presses. Will select all nodes and edges by
         *      calling _selectAll().
         *
         * Parameters:
         *      {jQuery::Event} event - the issued select all keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _selectAllPressed: function(event) {
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();
            this._selectAll(event);
            return this;
        },

        /**
         * Method: _copyPressed
         *      Event callback for handling a copy (CTRL/CMD + C) key press. Will copy selected nodes by serializing
         *      and saving them to HTML5 Local Storage or the _clipboard var by calling _copySelection().
         *
         * Parameters:
         *      {jQuery::Event} event - the issued select all keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _copyPressed: function(event) {
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();
            this._copySelection();
            return this;
        },

        /**
         * Method: _pastePressed
         *      Event callback for handling a paste (CTRL/CMD + V) key press. Will paste previously copied nodes from
         *      HTML% Local Storage or the _clipboard var by calling _paste().
         *
         * Parameters:
         *      {jQuery::Event} event - the issued select all keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _pastePressed: function(event) {
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();
            this._paste();
            return this;
        },

        /**
         * Method: _cutPressed
         *      Event callback for handling a cut (CTRL/CMD + X) key press. Will delete and copy selected nodes by
         *      calling _cutSelection().
         *
         * Parameters:
         *      {jQuery::Event} event - the issued select all keypress event
         *
         * Returns:
         *      This {<Editor>} instance for chaining.
         */
        _cutPressed: function(event) {
            if (jQuery(event.target).is('input, textarea')) return this;
            event.preventDefault();
            this._cutSelection();
            return this;
        },

        /**
         * Group: Print Offset Calculation
         */

        /**
         * Method: _calculateContentOffsets
         *      Calculates the minimal offsets from top and left among all elements displayed on the canvas.
         *
         * Returns:
         *      An {Object} containing the minimal top ('top') and minimal left ('left') offset to the browser borders.
         */
        _calculateContentOffsets: function() {
            var minLeftOffset = window.Infinity;
            var minTopOffset  = window.Infinity;

            jQuery('.' + Factory.getModule('Config').Classes.NODE + ', .' + Factory.getModule('Config').Classes.MIRROR).each(function(index, element) {
                var offset = jQuery(element).offset();
                minLeftOffset = Math.min(minLeftOffset, offset.left);
                minTopOffset  = Math.min(minTopOffset,  offset.top);
            });

            return {
                'top':  minTopOffset,
                'left': minLeftOffset
            };
        },

        /**
         * Method: _updatePrintOffsets
         *      Calculate the minimal offsets of elements on the canvas and updates the print stylesheet so that it will
         *      compensate these offsets while printing (using CSS transforms). This update is triggered every time a
         *      node was added, removed or moved on the canvas.
         */
        _updatePrintOffsets: function(event) {
            var minOffsets = this._calculateContentOffsets();

            if (minOffsets.top  == this._currentMinNodeOffsets.top &&
                minOffsets.left == this._currentMinNodeOffsets.left) {
                    // nothing changed
                    return;
                }

            // replace the style text with the new transformation style
            this._nodeOffsetPrintStylesheet.text(this._nodeOffsetStylesheetTemplate({
                'x': -minOffsets.left + 1, // add a tolerance pixel to avoid cut edges,
                'y': -minOffsets.top + 1
            }));
        }
    });
});
