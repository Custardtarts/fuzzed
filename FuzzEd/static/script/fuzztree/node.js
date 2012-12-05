define(['faulttree/node', 'fuzztree/config'], function(FaulttreeNode, Config) {
    /**
     *  Concrete fuzztree node implementation
     */
    return FaulttreeNode.extend({
        optionalIndicator: undefined,

        select: function() {
            // don't allow selection of disabled nodes
            if (this._disabled) return this;

            this.optionalIndicator.attr('stroke', Config.Node.STROKE_SELECTED);
            if (!this.optional) {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_SELECTED);
            }

            return this._super();
        },

        deselect: function() {
            var color = this._highlighted ? Config.Node.STROKE_HIGHLIGHTED : Config.Node.STROKE_NORMAL;
            this.optionalIndicator.attr('stroke', color);
            if (!this.optional) {
                this.optionalIndicator.attr('fill', color);
            }

            return this._super();
        },

        disable: function() {
            this.optionalIndicator.attr('stroke', Config.Node.STROKE_DISABLED);
            if (!this.optional) {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_DISABLED);
            }

            return this._super();
        },

        enable: function() {
            var color = Config.Node.STROKE_NORMAL;
            if (this._selected) {
                color = Config.Node.STROKE_SELECTED;
            } else if (this._highlighted) {
                color = Config.Node.STROKE_HIGHLIGHTED;
            }

            this.optionalIndicator.attr('stroke', color);
            if (!this.optional) {
                this.optionalIndicator.attr('fill', color);
            }

            return this._super();
        },

        highlight: function() {
            if (this._selected || this._disabled) return this;

            this.optionalIndicator.attr('stroke', Config.Node.STROKE_HIGHLIGHTED);
            if (!this.optional) {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
            }

            return this._super();
        },

        unhighlight: function() {
            if (this._selected || this._disabled) return this;

            this.optionalIndicator.attr('stroke', Config.Node.STROKE_NORMAL);
            if (!this.optional) {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
            }

            return this._super();
        },

        setOptional: function(optional) {
            this.optional = optional;

            if (optional) {
                this.optionalIndicator.attr('fill', Config.Node.OPTIONAL_INDICATOR_FILL);
            } else if (this._selected) {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_SELECTED);
            } else if (this._highlighted) {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_HIGHLIGHTED);
            } else {
                this.optionalIndicator.attr('fill', Config.Node.STROKE_NORMAL);
            }
        },

        _setupVisualRepresentation: function() {
            this._super();

            var optionalIndicatorWrapper = jQuery('<div>').svg();
            var optionalIndicator = optionalIndicatorWrapper.svg('get');
            var radius = Config.Node.OPTIONAL_INDICATOR_RADIUS;

            var optionalIndicatorCircle = optionalIndicator.circle(null, radius + 1, radius + 1, radius, {
                strokeWidth: Config.Node.OPTIONAL_INDICATOR_STROKE,
                fill: this.optional ? Config.Node.OPTIONAL_INDICATOR_FILL : Config.Node.STROKE_NORMAL,
                stroke: Config.Node.STROKE_NORMAL
            });

            // external method for changing attributes of the circle later
            optionalIndicator.attr = function(attr, value) {
                var setting = {};
                setting[attr] = value;
                optionalIndicator.change(optionalIndicatorCircle, setting);
            };

            optionalIndicatorWrapper
                .addClass(Config.Classes.NODE_OPTIONAL_INDICATOR)
                .appendTo(this.container);

            // hide the optional indicator for nodes with undefined value
            if (typeof this.optional === 'undefined' || this.optional == null) {
                optionalIndicatorWrapper.css('visibility', 'hidden');
            }

            this.optionalIndicator = optionalIndicator;
        },

        _setupPropertyMenuEntries: function(propertyMenuEntries, propertiesDisplayOrder) {
            this._super(propertyMenuEntries, propertiesDisplayOrder);

            if (_.has(this.propertyMenuEntries, 'optional')) {
                this.propertyMenuEntries.optional.change = function() {
                    this.setOptional(this.optional);
                }.bind(this)
            }
        },

        _connectorOffset: function() {
            var offsets = this._super();

            if (typeof this.optional !== 'undefined' && this.optional != null) {
                offsets.out.y = jQuery(this.optionalIndicator._container).offset().top - this.container.offset().top;
            }

            return offsets;
        }
    });
});
