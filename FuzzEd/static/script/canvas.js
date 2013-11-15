define(['class', 'config', 'jquery-ui', 'jquery-classlist'], function(Class, Config) {
    /**
     * Package: Base
     */

    /**
     *  Class: {Singleton} Canvas
     *
     *  This singleton class models the canvas entity. It is mainly responsible for two things: painting the background
     *  grid and providing coordinate conversion functions (pixel to grid coordinates and vice versa). The canvas is a
     *  the drop and selectable target for <Nodes>.
     *
     *  Events:
     *      Config.Events.CANVAS_SHAPE_DROPPED - An SVG element was dropped onto the canvas.
     */
    return new (Class.extend({
        /**
         * Group: Members
         *
         * {DOMElement} container   - The canvas container element - i.e. DOM element with id <Config::IDs::CANVAS>.
         * {Number}     gridSize    - Size in pixels of one canvas grid cell (default: <Config::Grid::SIZE>.
         *
         * {DOMElement} _background - SVG DOM element where the dashed grid lines are drawn on.
         */
        container:        undefined,
        gridSize:         Config.Grid.SIZE,

        _backgroundImage: undefined,

        /**
         * Constructor: init
         *
         * Creates a new instance of the <Canvas> class. Invokes permanent side effects on the DOM and should therefore
         * only be called once.
         */
        init: function() {
            // locate predefined DOM elements and bind Editor instance to canvas
            this.container = jQuery('#' + Config.IDs.CANVAS);
            this._backgroundImage = this.container.css('background-image');
            this._setupCanvas();
        },

        /**
         * Section: Visual
         */
        enlarge: function(to, precise) {
            var canvasWidth  = this.container.width();
            var canvasHeight = this.container.height();
            var doubleGrid   = this.gridSize << 1;

            if (precise) {
                canvasWidth  = to.x;
                canvasHeight = to.y;
            } else {
                while (to.x  > canvasWidth - doubleGrid) {
                    canvasWidth *= 2;
                }
                while (to.y > canvasHeight - doubleGrid) {
                    canvasHeight *= 2;
                }
            }

            this.container.width(canvasWidth);
            this.container.height(canvasHeight);

            return this;
        },

        /**
         * Section: Visuals
         */
        toggleGrid: function() {
            this.container.toggleClass(Config.Classes.GRID_HIDDEN);
        },

        /**
         * Section: Interaction
         */
        disableInteraction: function() {
            this.container
                .droppable('disable')
                .selectable('disable');

            return this;
        },

        /**
         * Section: Coordinate conversion
         */

        /**
         * Method: toGrid
         *
         * Converts the passed pixel coordinates to their respective grid coordinates. This method will look for the
         * closest grid coordinate, if the pixel coordinates do not represent a "grid crossing".
         *
         * Parameters:
         *   {Object|Number} first  - Either an object of the form {'x': ..., 'y': ...} representing the complete pixel
         *                            coordinates or a single number standing for the pixel x coordinate.
         *   {Number}        second - If first is not an object, a number standing for the pixel y coordinate or assumed
         *                            to be undefined.
         *
         * Returns:
         *   An {Object} containing the 'x' and 'y' grid coordinates of the passed pixel coordinates.
         */
        toGrid: function(first, second) {
            var x = window.Number.NaN;
            var y = window.Number.NaN;

            // if both parameter are numbers we can take them as they are
            if (_.isNumber(first) && _.isNumber(second)) {
                x = first;
                y = second;

            // however the first parameter could also be an object
            // of the form {x: NUMBER, y: NUMBER} (convenience reasons)
            } else if (_.isObject(first)) {
                x = first.x;
                y = first.y;
            }

            return {
                x: window.Math.round(x / this.gridSize),
                y: window.Math.round(y / this.gridSize)
            }
        },

        /**
         * Method: toPixel
         *
         * Converts the passed grid coordinates to their pixel equivalent. Does NOT implement snap behaviour to the
         * closest grid crossing.
         *
         * Parameters:
         *   {Object|Number} first  - Either an object of the form {'x': ..., 'y': ...} representing the complete grid
         *                            coordinates or a single number standing for the grid's x coordinate.
         *   {Number}        second - If the parameter first is an object assumed to be undefined, otherwise a number
         *                            standing for the grid's y coordinate.
         *
         * Returns:
         *   An {Object} containing the 'x' and 'y' pixel coordinates of the passed grid coordinates.
         */
        toPixel: function(first, second) {
            var x = window.Number.NaN;
            var y = window.Number.NaN;

            if (_.isNumber(first) && _.isNumber(second)) {
                x = first;
                y = second;

            } else if (_.isObject(first)) {
                x = first.x;
                y = first.y;
            }

            return {
                x: x * this.gridSize,
                y: y * this.gridSize
            }
        },

        /**
         *  Section: Initialization
         */

        /**
         * Method: _setupCanvas
         *
         * This method sets the canvas up to be a drop and select target. The first allows that shapes from the shapes
         * menu can be dragged and dropped onto the canvas. Whereas the latter is responsible to allow the user to make
         * rectangular boxes for multi selects. While setting up the two targets, this method also registers callbacks
         * to handle un- and highlighting on selection and to re-trigger the custom events stated below.
         *
         * Returns:
         *   This {<Canvas>} instance for chaining.
         *
         * Triggers:
         *   <Config::Events::CANVAS_SHAPE_DROPPED>
         *   <Config::Events::CANVAS_EDGE_SELECTED>
         *   <Config::Events::CANVAS_EDGE_UNSELECTED>
         *   <Config::Events::CANVAS_SELECTION_STOPPED>
         */
        _setupCanvas: function() {
            // make canvas droppable for shapes from the shape menu
            this.container.droppable({
                accept: function(draggable) {
        			if (jQuery(draggable).parent().attr('class') === Config.Classes.DRAGGABLE_WRAP_DIV){
            			return true;
						}
    				},
                tolerance: 'fit',
                drop:      function(uiEvent, uiObject) {
                    var kind     = uiObject.draggable.attr('id');
                    var offset   = this.container.offset();
                    var position = {x: uiEvent.pageX - offset.left, y: uiEvent.pageY - offset.top};
                    jQuery(document).trigger(Config.Events.CANVAS_SHAPE_DROPPED, [kind, position]);
                }.bind(this)
            });

            this.container.selectable({
                filter: '.' + Config.Classes.NODE + ', .' + Config.Classes.JSPLUMB_CONNECTOR,
				unselected: function(event, ui) {
					jQuery(document).trigger(Config.Events.NODE_UNSELECTED);
				},
				selected: function(event,ui){
					jQuery(document).trigger(Config.Events.NODE_SELECTED);
				},
                stop: function() {
                    // tell other (e.g. <PropertyMenu>) that selection is done and react to the new selection
                    jQuery(document).trigger(Config.Events.CANVAS_SELECTION_STOPPED);
                }
            });

            return this;
        }
    }));
});
