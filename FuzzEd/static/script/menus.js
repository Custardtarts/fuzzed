define(['config', 'class'], function(Config, Class) {

    /**
     * Class: Menu
     */
    var Menu = Class.extend({
        container:    undefined,

        _controls:     undefined,
        _disabled:     undefined,
        _navbar:       undefined,
        _navbarButton: undefined,

        init: function() {
            this.container = this._setupContainer();
            this._controls = this._setupControls();
            this._disabled = false;
            this._navbar   = this._setupNavbar();

            this._setupDragging();
        },

        /* Section: Visibility */
        disable: function() {
            this._disabled = true;
            this.hide();
        },

        enable: function() {
            this._disabled = false;
        },

        hide: function() {
            this.container.hide();
            return this;
        },

        minimize: function() {
            if (this._isMinimized()) return this;

            // create a button in the toolbar
            this._navbarButton = jQuery('<li><a href="#">' + this.container.attr(Config.Attributes.HEADER) + '</a></li>')
                .css('visibility', 'hidden')
                .prependTo(this._navbar)
                // .offset() here will closure the position where the window was minimized
                .click(this.container.offset(), this.maximize.bind(this));

            // animate the window minimizing towards the navigation button
            var navButtonPosition = this._navbarButton.offset();
            this.container.animate({
                top:    navButtonPosition.top,
                left:   navButtonPosition.left,
                width:  0,
                height: 0
            }, {
                duration: Config.Menus.ANIMATION_DURATION,
                complete: function() {
                    this._navbarButton.css('visibility', '');
                    this.container.hide();
                    // width and height have to be remove here so that the css will fall back to auto
                    // so that changes to the bounding box of the menu will be reflected when maximizing
                    this.container.css('width', '');
                    this.container.css('height', '');
                }.bind(this)
            });
            return this;
        },

        maximize: function(eventObject) {
            this._navbarButton.remove();
            this._navbarButton = undefined;

            var destinationTransformation = _.extend({
                // those lines might seem weird but they are very necessary
                // if the window changed its bounding box while being minimized (e.g. properties menu)
                // we need to capture this change here first...
                width:  this.container.width(),
                height: this.container.height()
            }, eventObject.data);

            // ... then we resize the window to zero...
            this.container.width(0);
            this.container.height(0);
            this.container.show();

            // ... so that this animation can finally resize it back to the captured value :O
            this.container.animate(destinationTransformation, {
                duration: Config.Menus.ANIMATION_DURATION
            });
            return this;
        },

        show: function() {
            // prevent that the menu is shown again as long it is minimized
            if (this._isMinimized() || this._disabled) return this;

            this.container.show();
            return this;
        },

        /* Section: Internal */
        _isMinimized: function() {
            return typeof this._navbarButton !== 'undefined';
        },

        _setupContainer: function() {
            throw '[ABSTRACT] Override in subclass';
        },

        _setupControls: function() {
            var controls = this.container.find('.' + Config.Classes.MENU_CONTROLS);

            controls.find('.' + Config.Classes.MENU_MINIMIZE)
                .addClass('icon-white icon-minus-sign')
                .click(this.minimize.bind(this));

            controls.find('.' + Config.Classes.MENU_CLOSE)
                .addClass('icon-white icon-remove-sign')
                .click(this.hide.bind(this));

            return controls;
        },

        _setupDragging: function() {
            this.container.draggable({
                containment:   'body',
                stack:         'svg',
                cursor:        Config.Dragging.CURSOR,
                scroll:        false,
                snap:          'body',
                snapMode:      'inner',
                snapTolerance: Config.Dragging.SNAP_TOLERANCE
            });
        },

        _setupNavbar: function() {
            return jQuery('ul.nav');
        }
    });

    /**
     * Class: ShapeMenu
     */
    var ShapeMenu = Menu.extend({
        init: function() {
            this._super();
            this._setupThumbnails();
        },

        /* Section: Internal */
        _setupContainer: function() {
            return jQuery('#' + Config.IDs.SHAPES_MENU);
        },

        _setupThumbnails: function() {
            var svgs = this.container.find('svg');

            // make shapes in the menu draggable
            svgs.draggable({
                helper:   'clone',
                opacity:  Config.Dragging.OPACITY,
                cursor:   Config.Dragging.CURSOR,
                appendTo: 'body',
                revert:   'invalid',
                zIndex:   200
            });
        }

    });

    /**
     * Class: PropertiesMenu
     */
    var PropertiesMenu = Menu.extend({
        _displayedEntries: 0,
        _displayOrder:     undefined,
        _form:             undefined,
        _node:             undefined,

        init: function(displayOrder) {
            this._super();
            this._displayOrder = displayOrder;
            this._form = this.container.find('.form-horizontal');

            this._setupSelection();
        },

        maximize: function(eventObject) {
            this._navbarButton.remove();
            this._navbarButton = undefined;

            this.show(this._nodes);
            this.container.animate(eventObject.data, {
                duration: Config.Menus.ANIMATION_DURATION
            });
            return this;
        },

        /* Section: Visibility */

        show: function() {
            var selected = jQuery('.' + Config.Classes.JQUERY_UI_SELECTED + '.' + Config.Classes.NODE);
            this._removeEntries();

            // display the properties menu only if there is exactly one node selected
            // and the menu is not minimized; otherwise hide the menu
            if (selected.length === 1 && !this._isMinimized() && !this._disabled) {
                return this._show(selected);
            }

            return this.hide();
        },

        _removeEntries: function() {
            if (!this._node) return this;

            _.each(this._node.properties, function(property) {
                property.menuEntry.remove();
            }.bind(this));

            return this;
        },

        _setupContainer: function() {
            return jQuery('#' + Config.IDs.PROPERTIES_MENU);
        },

        _setupSelection: function() {
            jQuery(document).on(Config.Events.CANVAS_SELECTION_STOPPED, this.show.bind(this));

            return this;
        },

        _show: function(selected) {
            this._node = selected.data(Config.Keys.NODE);

            // this node does not have any properties to display, go home!
            if (_.isEmpty(this._node.properties)) {
                this.hide();
                return this;
            }

            this._displayedEntries = 0;
            _.each(this._displayOrder, function(propertyName) {
                var property = this._node.properties[propertyName];
                // has the node such a property? display it!
                if (typeof property !== 'undefined') {
                    property.menuEntry.appendTo(this._form);
                    this._displayedEntries += (property.hidden ? 0 : 1);

                    jQuery(property).on(Config.Events.PROPERTY_HIDDEN_CHANGED, function(event, hidden) {
                        this._displayedEntries += hidden ? -1 : 1;
                        this.container.toggle(this._displayedEntries > 0);
                    }.bind(this));
                }
            }.bind(this));

            // fix the left offset (jQueryUI bug with draggable menus and CSS right property)
            if (this.container.css('left') === 'auto') {
                var offset =  - this.container.outerWidth(true) - Config.Menus.PROPERTIES_MENU_OFFSET;
                this.container.css('left', jQuery('body').outerWidth(true) + offset);
            }
            this.container.toggle(this._displayedEntries > 0);

            return this;
        }
    });

    return {
        Menu:           Menu,
        ShapeMenu:      ShapeMenu,
        PropertiesMenu: PropertiesMenu
    }
});