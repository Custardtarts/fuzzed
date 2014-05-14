define(['class', 'config', 'decimal', 'property_menu_entry', 'mirror', 'label', 'alerts', 'jquery', 'underscore'],
function(Class, Config, Decimal, PropertyMenuEntry, Mirror, Label, Alerts) {

    var isNumber = function(number) {
        return _.isNumber(number) && !_.isNaN(number);
    };
	
    var Property = Class.extend({
        owner:          undefined,
        value:          undefined,
        displayName:    '',
        mirror:         undefined,
        label:          undefined,
        menuEntry:      undefined,
        hidden:         false,
        readonly:       false,
        partInCompound: undefined,

        init: function(owner, definition) {
            jQuery.extend(this, definition);
            this.owner = owner;
            this._sanitize()
                ._setupMirror()
                ._setupLabel()
                ._setupMenuEntry();

            this._triggerChange(this.value, this);
        },

        menuEntryClass: function() {
            throw new SubclassResponsibility();
        },

        validate: function(value, validationResult) {
            throw new SubclassResponsibility();
        },

        setValue: function(newValue, issuer, propagate) {
            // we can't optimize for compound parts because their value does not always reflect the
            // value stored in the backend
            if ((typeof this.partInCompound === 'undefined' && _.isEqual(this.value, newValue)) || this.readonly) {
                return this;
            }

            if (typeof propagate === 'undefined') propagate = true;

            var validationResult = {};
            if (!this.validate(newValue, validationResult)) {
                var ErrorClass = validationResult.kind || Error;
                throw new ErrorClass(validationResult.message);
            }

            this.value = newValue;
            this._triggerChange(newValue, issuer);

            if (propagate) {
                var properties = {};
                // compound parts need another format for backend propagation
                var value = typeof this.partInCompound === 'undefined' ? newValue : [this.partInCompound, newValue];
                properties[this.name] = value;

                //TODO: IS THIS REALLY THE RIGHT WAY TO DO IT?
                // (we cannot put the require as dependency of this module, as there is some kind of cyclic dependency
                // stopping Node.js to work properly

                var Edge =      require("edge");
                var Node =      require("node");
                var NodeGroup = require("node_group");

                if (this.owner instanceof Edge) {
                    jQuery(document).trigger(Config.Events.EDGE_PROPERTY_CHANGED, [this.owner.id, properties]);
                } else if (this.owner instanceof Node) {
                    jQuery(document).trigger(Config.Events.NODE_PROPERTY_CHANGED, [this.owner.id, properties]);
                } else if (this.owner instanceof NodeGroup) {
                    jQuery(document).trigger(Config.Events.NODEGROUP_PROPERTY_CHANGED, [this.owner.id, properties]);
                } else {
                    throw new TypeError ("unknown owner class")
                }

            }

            return this;
        },

        toDict: function() {
            var obj = {};
            obj[this.name] = { 'value': this.value };
            return obj;
        },

        setHidden: function(newHidden) {
            this.hidden = newHidden;

             jQuery(this).trigger(Config.Events.PROPERTY_HIDDEN_CHANGED, [newHidden]);

            return this;
        },

        setReadonly: function(newReadonly) {
            this.readonly = newReadonly;

             jQuery(this).trigger(Config.Events.PROPERTY_READONLY_CHANGED, [newReadonly]);

            return this;
        },

        _sanitize: function() {
            //var validationResult = {};
            //if (!this.validate(this.value, validationResult)) {
            //    var ErrorClass = validationResult.kind || Error;
            //    throw new ErrorClass(validationResult.message);
            //}

            return this;
        },

        _setupMirror: function() {
            if (typeof this.mirror === 'undefined' || this.mirror === null) return this;

            this.mirror = new Mirror(this, this.owner.container, this.mirror);

            return this;
        },

        _setupLabel: function() {
            if (typeof this.label === 'undefined' || this.label === null) return this;
            this.label = new Label(this, this.owner.jsPlumbEdge, this.label);

            return this;
        },

        _setupMenuEntry: function() {
            this.menuEntry = new (this.menuEntryClass())(this);

            return this;
        },

        _triggerChange: function(value, issuer) {
            //TODO: IS THIS REALLY THE RIGHT WAY TO DO IT?
            // (we cannot put the following required modules as dependency of this module, as there is some kind of
            // cyclic dependency stopping Node.js to work properly

            var Edge =      require("edge");
            var Node =      require("node");
            var NodeGroup = require("node_group");

            if (this.owner instanceof Node) {
                jQuery(this).trigger(Config.Events.NODE_PROPERTY_CHANGED, [value, value, issuer]);
            } else if (this.owner instanceof Edge) {
                jQuery(this).trigger(Config.Events.EDGE_PROPERTY_CHANGED, [value, value, issuer]);
            } else if (this.owner instanceof NodeGroup) {
                jQuery(this).trigger(Config.Events.NODEGROUP_PROPERTY_CHANGED, [value, value, issuer]);
            }
        }
    });

    var Bool = Property.extend({
        menuEntryClass: function() {
            return PropertyMenuEntry.BoolEntry;
        },

        validate: function(value, validationResult) {
            if (typeof value !== 'boolean') {
                validationResult.kind    = TypeError;
                validationResult.message = 'value must be boolean';
                return false;
            }
            return true;
        },

        _sanitize: function() {
            this.value = typeof this.value === 'undefined' ? this.default : this.value;
            return this._super();
        }
    });

    var Choice = Property.extend({
        choices: undefined,
        values:  undefined,

        menuEntryClass: function(){
            return PropertyMenuEntry.ChoiceEntry;
        },

        init: function(owner, definition) {
            definition.values = typeof definition.values === 'undefined' ? definition.choices : definition.values;
            this._super(owner, definition);
        },

        validate: function(value, validationResult) {
            if (!_.find(this.values, function(val){ return _.isEqual(val, value); }, this)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'no such value ' + value;
                return false;
            }
            return true;
        },

        _sanitize: function() {
            this.value = typeof this.value === 'undefined' ? this.default : this.value;

            if (typeof this.choices === 'undefined' || this.choices.length === 0) {
                throw new ValueError('there must be at least one choice');
            } else if (this.choices.length != this.values.length) {
                throw new ValueError('there must be a value for each choice');
            } else if (!_.find(this.values, function(value){ return _.isEqual(value, this.value); }, this)) {
                throw new ValueError('unknown value ' + this.value);
            }
            return this._super();
        },

        _triggerChange: function(value, issuer) {
            var index = -1;
            for (var i = this.values.length - 1; i >=0; i--) {
                if (_.isEqual(this.values[i], value)) {
                    index = i;
                    break;
                }
            }

            jQuery(this).trigger(Config.Events.NODE_PROPERTY_CHANGED, [value, this.choices[i], issuer]);
        }
    });

    var Compound = Property.extend({
        parts: undefined,

        menuEntryClass: function(){
            return PropertyMenuEntry.CompoundEntry;
        },

        setHidden: function(newHidden) {
            this._super();
            this.parts[this.value].setHidden(newHidden);

            return this;
        },

        setReadonly: function(newReadonly) {
            this._super();
            _.invoke(this.parts, 'setReadonly', newReadonly);

            return this;
        },

        setValue: function(newValue, propagate) {
            if (typeof propagate === 'undefined') propagate = true;

            var validationResult = {};
            if (!this.validate(newValue, validationResult)) {
                var ErrorClass = validationResult.kind || Error;
                throw new ErrorClass(validationResult.message);
            }
            // trigger a change in the newly selected part to propagate the new index (stored in the part)
            // to the backend
            this.parts[newValue].setValue(this.parts[newValue].value, propagate);
            this.value = newValue;

            // also trigger change on this property (index changed)
            this._triggerChange(newValue, this);

            return this;
        },

        toDict: function() {
            var obj = {};
            obj[this.name] = { 'value': [this.value, this.parts[this.value].value] };
            return obj;
        },

        validate: function(value, validationResult) {
            if (!isNumber(value) || value % 1 !== 0) {
                validationResult.message = 'value must be an integer';
                return false;
            }
            if (value < 0 || value > this.parts.length) {
                validationResult.kind    = ValueError;
                validationResult.message = 'out of bounds';
                return false;
            }

            return true;
        },

        _sanitize: function() {
            var value = typeof this.value === 'undefined' ? this.default : this.value;

            if (!_.isArray(value) && value.length === 2) {
                throw new TypeError('expected tuple');
            }
            this.value = value[0];

            if (!_.isArray(this.parts) || this.parts.length < 1) {
                throw new ValueError('there must be at least one part');
            }
            this._super();

            return this._setupParts(value[1]);
        },

        _setupParts: function(value) {
            var parsedParts = new Array(this.parts.length);

            this.parts = _.each(this.parts, function(part, index) {
                var partDef = jQuery.extend({}, part, {
                    name: this.name,
                    partInCompound: index,
                    value: index === this.value ? value : undefined
                });
                parsedParts[index] = from(this.owner, partDef);
            }.bind(this));

            this.parts = parsedParts;

            return this;
        }
    });

    var Epsilon = Property.extend({
        min:        -Decimal.MAX_VALUE,
        max:         Decimal.MAX_VALUE,
        step:        undefined,
        epsilonStep: undefined,

        menuEntryClass: function() {
            return PropertyMenuEntry.EpsilonEntry;
        },

        validate: function(value, validationResult) {
            if (!_.isArray(value) || value.length != 2) {
                validationResult.kind    = TypeError;
                validationResult.message = 'value must be a tuple';
                return false;
            }

            var center  = value[0];
            var epsilon = value[1];

            // doing a big decimal conversion here due to JavaScripts awesome floating point handling xoxo
            var decimalCenter  = new Decimal(center);
            var decimalEpsilon = new Decimal(epsilon);

            if (typeof center  !== 'number' || window.isNaN(center)) {
                validationResult.kind    = TypeError;
                validationResult.message = 'center must be numeric';
                return false;
            } else if (typeof epsilon !== 'number' || window.isNaN(epsilon)) {
                validationResult.kind    = TypeError;
                validationResult.message = 'epsilon must be numeric';
                return false;
            } else if (epsilon < 0) {
                validationResult.kind    = ValueError;
                validationResult.message = 'epsilon must not be negative';
                return false;
            } else if (this.min.gt(decimalCenter.minus(decimalEpsilon)) || this.max.lt(decimalCenter.minus(decimalEpsilon))) {
                validationResult.kind    = ValueError;
                validationResult.message = 'value out of bounds';
                return false;
            } else if (typeof this.step !== 'undefined' && !this.default[0].minus(center).mod(this.step).eq(0)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'center not in value range (step)';
                return false;
            } else if (typeof this.epsilonStep !== 'undefined' &&
                       !this.default[1].minus(epsilon).mod(this.epsilonStep).eq(0)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'epsilon not in value range (step)';
                return false;
            }
            return true;
        },

        _sanitize: function() {
            if (!_.isArray(this.default) || this.default.length != 2) {
                throw new TypeError('tuple', typeof this.default);
            }

            this.value = typeof this.value === 'undefined' ? this.default.slice(0) : this.value;

            if (!(this.default[0] instanceof Decimal) && isNumber(this.default[0])) {
                this.default[0] = new Decimal(this.default[0]);
            } else {
                throw new TypeError('numeric lower bound', typeof this.default[0]);
            }
            if (!(this.default[1] instanceof Decimal) && isNumber(this.default[1])) {
                this.default[1] = new Decimal(this.default[1]);
            } else {
                throw new TypeError('numeric upper bound', typeof this.default[1]);
            }

            if (!(this.min instanceof Decimal) && isNumber(this.min)) {
                this.min = new Decimal(this.min);
            } else {
                throw new TypeError('numeric minimum', typeof this.min);
            }
            if (!(this.max instanceof Decimal) && isNumber(this.max)) {
                this.max = new Decimal(this.max);
            } else {
                throw new TypeError('numeric maximum', typeof this.max);
            }
            if (typeof this.step !== 'undefined' && !isNumber(this.step)) {
                throw new TypeError('numeric step', typeof this.step);
            }
            if (typeof this.epsilonStep !== 'undefined' && !isNumber(this.epsilonStep)) {
                throw new TypeError('numeric epsilon step', typeof this.epsilonStep);
            }

            if (this.min.gt(this.max)) {
                throw new ValueError('bounds violation min/max: ' + this.min + '/' + this.max);
            } else if (typeof this.step !== 'undefined' && this.step < 0) {
                throw new ValueError('step must be positive, got: ' + this.step);
            }

            return this._super();
        }
    });

    var Numeric = Property.extend({
        min: -Decimal.MAX_VALUE,
        max:  Decimal.MAX_VALUE,
        step: undefined,

        menuEntryClass: function() {
            return PropertyMenuEntry.NumericEntry;
        },

        validate: function(value, validationResult) {
            if (!isNumber(value)) {
                validationResult.kind    = TypeError;
                validationResult.message = 'value must be numeric';
                return false;
            } else if (this.min.gt(value) || this.max.lt(value)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'value out of bounds';
                return false;
            } else if (typeof this.step !== 'undefined' && !this.default.minus(value).mod(this.step).eq(0)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'value not in value range (step)';
                return false;
            }
            return true;
        },

        _sanitize: function() {
            this.value = typeof this.value === 'undefined' ? this.default : this.value;

            if (isNumber(this.default)) {
                this.default = new Decimal(this.default);
            } else {
                throw new TypeError('numeric default', this.default);
            }
            if (isNumber(this.min)) {
                this.min = new Decimal(this.min);
            } else {
                throw new TypeError('numeric min', this.min);
            }
            if (isNumber(this.max)) {
                this.max = new Decimal(this.max);
            } else {
                throw new TypeError('numeric max', this.max);
            }
            if (typeof this.step !== 'undefined' && !isNumber(this.step)) {
                throw new TypeError('numeric step', this.step);
            }

            if (this.min.gt(this.max)) {
                throw new ValueError('bounds violation min/max: ' + this.min + '/' + this.max);
            } else if (typeof this.step !== 'undefined'  && this.step < 0) {
                throw new ValueError('step must be positive, got: ' + this.step);
            }

            return this._super();
        }
    });

    var Range = Property.extend({
        min: -Decimal.MAX_VALUE,
        max:  Decimal.MAX_VALUE,
        step: undefined,

        menuEntryClass: function() {
            return PropertyMenuEntry.RangeEntry;
        },

        validate: function(value, validationResult) {
            if (!_.isArray(this.value) || this.value.length != 2) {
                validationResult.kind    = TypeError;
                validationResult.message = 'value must be a tuple';
                return false;
            }

            var lower = value[0];
            var upper = value[1];
            if (!isNumber(lower) || !isNumber(upper)) {
                validationResult.kind    = TypeError;
                validationResult.message = 'lower and upper bound must be numeric';
                return false;
            } else if (lower > upper) {
                validationResult.kind    = ValueError;
                validationResult.message = 'lower bound must be less or equal upper bound';
                return false;
            } else if (typeof this.step !== 'undefined' && !this.default[0].minus(lower).mod(this.step).eq(0) ||
                                                           !this.default[1].minus(upper).mod(this.step).eq(0)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'value not in value range (step)';
                return false;
            }
            return true;
        },

        _sanitize: function() {

            if (!_.isArray(this.default) || this.default.length != 2) {
                throw new TypeError('tuple', this.default);
            }

            this.value = typeof this.value === 'undefined' ? this.default.slice(0) : this.value;

            if (!(this.default[0] instanceof Decimal) && isNumber(this.default[0])) {
                this.default[0] = new Decimal(this.default[0]);
            } else {
                throw new TypeError('numeric default lower bound', this.default[0]);
            }
            if (!(this.default[1] instanceof Decimal) && isNumber(this.default[1])) {
                this.default[1] = new Decimal(this.default[1]);
            } else {
                throw new TypeError('numeric default upper bound', this.default[1]);
            }

            if (!(this.min instanceof Decimal) && isNumber(this.min)) {
                this.min = new Decimal(this.min);
            } else {
                throw new TypeError('numeric min', this.min);
            }
            if (!(this.max instanceof Decimal) && isNumber(this.max)) {
                this.max = new Decimal(this.max);
            } else {
                throw new TypeError('numeric max', this.max);
            }
            if (typeof this.step !== 'undefined' && !isNumber(this.step)) {
                throw new ValueError('numeric step', this.step);
            }

            if (this.min.gt(this.max)) {
                throw new ValueError('bounds violation min/max: ' + this.min + '/' + this.max);
            } else if (typeof this.step !== 'undefined' && this.step < 0) {
                throw new ValueError('step must be positive: ' + this.step);
            }

            return this._super();
        }
    });

    var Text = Property.extend({
        notEmpty: false,

        menuEntryClass: function() {
            return PropertyMenuEntry.TextEntry;
        },

        validate: function(value, validationResult) {
            if (typeof value !== 'string') {
                validationResult.kind    = TypeError;
                validationResult.message = 'value must be string';
                return false;
            } else if (this.notEmpty && value === '') {
                validationResult.kind    = ValueError;
                validationResult.message = 'value must not be empty';
                return false;
            }
            return true;
        },

        _sanitize: function() {
            this.value = typeof this.value === 'undefined' ? this.default : this.value;
            return this._super();
        }
    });
	
	var InlineTextField = Text.extend({		
        menuEntryClass: function() {
            return PropertyMenuEntry.InlineTextArea;
        },
		
		validate :	function(value, validationResult) {
			return true;
		}    
	});

    var Transfer = Property.extend({
        UNLINK_VALUE: -1,
        UNLINK_TEXT:  'unlinked',
        GRAPHS_URL:   Config.Backend.BASE_URL + Config.Backend.GRAPHS_URL + '/',

        transferGraphs: undefined,

        init: function(owner, definition) {
            jQuery.extend(this, definition);
            this.owner = owner;
            this._sanitize()
                ._setupMirror()
                ._setupMenuEntry()
                .fetchTransferGraphs();
        },

        menuEntryClass: function() {
            return PropertyMenuEntry.TransferEntry;
        },

        validate: function(value, validationResult) {
            if (value === this.UNLINK_VALUE) {
                validationResult.kind    = Warning;
                validationResult.message = 'no link set';
            } else if (!_.has(this.transferGraphs, value)) {
                validationResult.kind    = ValueError;
                validationResult.message = 'specified graph unknown';
                return false;
            }

            return true;
        },

        _sanitize: function() {
            // do not validate
            this.value = typeof this.value === 'undefined' ? this.default : this.value;
            return this;
        },

        _triggerChange: function(value, issuer) {
            var unlinked = value === this.UNLINK_VALUE;

            if (!unlinked) this.owner.hideBadge();
            jQuery(this).trigger(Config.Events.NODE_PROPERTY_CHANGED, [
                value,
                unlinked ? this.UNLINK_TEXT : this.transferGraphs[value],
                issuer]
            );
        },

        fetchTransferGraphs: function() {
            jQuery.ajax({
                url:      this.GRAPHS_URL + '?kind=' + this.owner.graph.kind,
                type:     'GET',
                dataType: 'json',
                // don't show progress
                global:   false,

                success:  this._setTransferGraphs.bind(this),
                error:    this._throwError
            });
        },

        _setTransferGraphs: function(json) {
            this.transferGraphs = _.reduce(json.graphs, function(all, current) {
                var id = window.parseInt(_.last(current.url.split('/')));
                all[id] = current.name;
                return all;
            }, {});
            delete this.transferGraphs[this.owner.graph.id];

            if (this.value === this.UNLINK_VALUE)
                this.owner.showBadge('!', 'important');

            jQuery(this).trigger(Config.Events.PROPERTY_SYNCHRONIZED);
            this._triggerChange(this.value, this);

            return this;
        },

        _throwError: function(xhr, textStatus, errorThrown) {
            Alerts.showWarningAlert('Could not fetch graph for transfer:', errorThrown, Config.Alerts.TIMEOUT);

            this.value = this.UNLINK_VALUE;
            this.transferGraphs = undefined;

            jQuery(this).trigger(Config.Events.PROPERTY_SYNCHRONIZED);
        }
    });

    var from = function(owner, definition) {
        switch (definition.kind) {
            case 'bool':     return new Bool(owner, definition);
            case 'choice':   return new Choice(owner, definition);
            case 'compound': return new Compound(owner, definition);
            case 'epsilon':  return new Epsilon(owner, definition);
            case 'numeric':  return new Numeric(owner, definition);
            case 'range':    return new Range(owner, definition);
            case 'text':     return new Text(owner, definition);
			case 'textfield':return new InlineTextField(owner, definition);
            case 'transfer': return new Transfer(owner, definition);

            default: throw ValueError('unknown property kind ' + definition.kind);
        }
    };

    return {
        Bool:      			Bool,
        Choice:    			Choice,
        Compound:  			Compound,
        Epsilon:   			Epsilon,
        Numeric:   			Numeric,
        Property:  			Property,
        Range:     			Range,
        Text:      			Text,
		InlineTextField: 	InlineTextField,
        Transfer:  			Transfer,

        from: 				from
    };
});
