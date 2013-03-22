define(['editor', 'faulttree/graph', 'menus', 'faulttree/config', 'highcharts', 'jquery.ui/jquery.ui.resizable'],
function(Editor, FaulttreeGraph, Menus, FaulttreeConfig) {
    /**
     *  Package: Faulttree
     */

    /**
     *  Class: CutsetsMenu
     *    A menu for displaying a list of minimal cutsets calculated for the edited graph. The nodes that belong to
     *    a cutset become highlighted when hovering over the corresponding entry in the cutsets menu.
     *
     *  Extends: <Base::Menus::Menu>
     */
    var CutsetsMenu = Menus.Menu.extend({
        /**
         *  Group: Members
         *
         *  Properties:
         *    {Graph} _graph - <Base::Graph> instance for which the cutsets are calculated.
         */
        _graph: undefined,

        /**
         *  Group: Initialization
         */

        /**
         *  Constructor: init
         *    Sets up the menu.
         *
         *  Parameters:
         *    {Graph} graph - The <Base::Graph> instance for which the cutsets are calculated.
         */
        init: function(graph) {
            this._super();
            this._graph = graph;
        },

        /**
         *  Group: Actions
         */

        /**
         *  Method: show
         *    Display the given cutsets in the menu and make the menu visible.
         *
         *  Parameters:
         *    {Array} cutsets - A list of cutsets calculated by the backend.
         *
         *  Returns:
         *    This menu instance for chaining.
         */
        show: function(cutsets) {
            if (typeof cutsets === 'undefined') {
                this.container.show();
                return this;
            }

            var listElement = this.container.find('ul').empty();

            _.each(cutsets, function(cutset) {
                var nodeIDs = cutset['nodes'];
                var nodes = _.map(nodeIDs, function(id) {
                    return this._graph.getNodeById(id);
                }.bind(this));
                var nodeNames = _.map(nodes, function(node) {
                    return node.name;
                });

                // create list entry for the menu
                var entry = jQuery('<li><a href="#">' + nodeNames.join(', ') + '</a></li>');

                // highlight the corresponding nodes on hover
                entry.hover(
                    // in
                    function() {
                        var allNodes = this._graph.getNodes();
                        _.invoke(allNodes, 'disable');
                        _.invoke(nodes, 'highlight');
                    }.bind(this),

                    // out
                    function() {
                        var allNodes = this._graph.getNodes();
                        _.invoke(allNodes, 'enable');
                        _.invoke(nodes, 'unhighlight');
                    }.bind(this)
                );

                listElement.append(entry);
            }.bind(this));

            this._super();
            return this;
        },

        /**
         *  Group: Setup
         */

        /**
         *  Method: _setupContainer
         *    Sets up the DOM container element for this menu and appends it to the DOM.
         *
         *  Returns:
         *    A jQuery object of the container.
         */
        _setupContainer: function() {
            return jQuery(
                '<div id="' + FaulttreeConfig.IDs.CUTSETS_MENU + '" class="menu" header="Cutsets">\
                    <div class="menu-controls">\
                        <span class="menu-minimize"></span>\
                        <span class="menu-close"></span>\
                    </div>\
                    <ul class="nav-list unstyled"></ul>\
                </div>'
            ).appendTo(jQuery('#' + FaulttreeConfig.IDs.CONTENT));
        }
    });

    var ProbabilityMenu = Menus.Menu.extend({
        /**
         *  Group: Members
         *
         *  Properties:
         *    {<Job>}           _job              - <Job> instance of the backend job that is responsible for
         *                                          calculating the probability.
         *    {jQuery Selector} _contentContainer - jQuery reference to the content div inside the container.
         */
        _job:              undefined,
        _contentContainer: undefined,

        /**
         *  Group: Initialization
         */

        /**
         *  Constructor: init
         *    Sets up the menu.
         */
        init: function() {
            this._super();
            this._contentContainer = this.container.find('.content');
        },

        /**
         *  Group: Actions
         */

        /**
         *  Method: show
         *    Display the given job status (and finally its result).
         *
         *  Parameters:
         *    {<Job>} job - The backend job that calculates the probability of the top event.
         *
         *  Returns:
         *    This menu instance for chaining.
         */
        show: function(job) {
            job.successCallback = this._evaluateResult.bind(this);
            job.updateCallback  = this._displayProgress.bind(this);
            job.errorCallback   = this._displayNetworkError.bind(this);
            job.updateCallback  = 5000;
            job.start();

            this._super();
            return this;
        },

        /**
         *  Group: Setup
         */

        /**
         *  Method: _setupContainer
         *    Sets up the DOM container element for this menu and appends it to the DOM.
         *
         *  Returns:
         *    A jQuery object of the container.
         */
        _setupContainer: function() {
            return jQuery(
                '<div id="' + FaulttreeConfig.IDs.PROBABILITY_MENU + '" class="menu" header="Probability of Top Event">\
                    <div class="menu-controls">\
                        <span class="menu-minimize"></span>\
                        <span class="menu-close"></span>\
                    </div>\
                    <div class="content"></div>\
                </div>'
            )
            .resizable()
            .appendTo(jQuery('#' + FaulttreeConfig.IDs.CONTENT));
        },

        /**
         *  Group: Evaluation
         */

        /**
         *  Method: _evaluateResult
         *    Evaluates the job result. Either displays the analysis results or the returned error message.
         *
         *  Parameters:
         *    {JSON} data - Data returned from the backend containing the result of the calculation.
         */
        _evaluateResult: function(data) {
            if (typeof data.errors !== 'undefined' && _.size(data.errors) != 0) {
                // errors is a dictionary with the node ID as key
                //TODO: display validation result at the node
                this._displayValidationErrors(_.values(data.errors));
            } else {
                var alphacuts = [];
                _.each(data['alphacutresults'], function(alphacut) {
                    alphacuts.push(this._convertToHighchartsFormat(alphacut));
                }.bind(this));

                this._displayResultWithHighcharts(alphacuts, data['decompositionNumber']);
            }
        },

        /**
         *  Group: Conversion
         */

        /**
         *  Methods: _convertToHighchartsFormat
         *    Converts a data series of a configuration from API JSON to the Highcharts format.
         *
         *  Parameters:
         *    {JSON} configuration - The data series in JSON format (e.g. "{"0.0": [0.2, 0.5], "1.0": [0.4, 0.4]}").
         *
         *  Returns:
         *    An array-of-arrays representation of the input that can be used by Highcharts to plot the data.
         */
        _convertToHighchartsFormat: function(configuration) {
            var dataPoints = [];
            _.each(configuration, function(values, key) {
                var y = parseFloat(key);
                _.each(values, function(x) {
                    dataPoints.push([x, y]);
                });
            });

            return _.sortBy(dataPoints, function(point) {
                return point[0];
            });
        },

        /**
         *  Group: Display
         */

        /**
         *  Method: _displayProgress
         *    Display the job's progress in the menu's body.
         *
         *  Parameters:
         *    {JSON} data - Data returned from the backend with information about the job's progress.
         */
        _displayProgress: function(data) {
            //TODO
            this._contentContainer.text(JSON.stringify(data));
        },

        /**
         *  Method: _displayResultWithHighcharts
         *    Display the job's result in the menu's body using Highcharts.
         *
         *  Parameters:
         *    {Array} data                - A set of one or more data series to display in the Highchart.
         *    {int}   decompositionNumber - [optional] Number of decompositions of the result. Used for calculating
         *                                  the tick of the y-axis.
         */
        _displayResultWithHighcharts: function(data, decompositionNumber) {
            if (data.length == 0) return;

            decompositionNumber = decompositionNumber || 5;

            var series = [];

            _.each(data, function(cutset, index) {
                series.push({
                    name: 'Configuration ' + (index + 1),
                    data: cutset
                });
            });

            //TODO: This is all pretty hard-coded. Put it into config instead.
            var chart = new Highcharts.Chart({
                chart: {
                    renderTo: this._contentContainer[0],
                    type:     'line',
                    height:   180
                },

                title: {
                    text: null
                },

                credits: {
                    style: {
                        fontSize: '8px'
                    }
                },

                xAxis: {
                    min: 0,
                    max: 1
                },
                yAxis: {
                    min: 0,
                    max: 1,
                    title: {
                        text: null
                    },
                    tickInterval: 1.0,
                    minorTickInterval: 1.0 / decompositionNumber
                },

                plotOptions: {
                    series: {
                        marker: {
                            radius: 1
                        }
                    }
                },

                series: series
            });

            // update the chart's size when resizing the menu
            this.container.on("resize", function(event, ui) {
                chart.setSize(
                    this._contentContainer.width(),
                    this._contentContainer.height(),
                    false
                );
            }.bind(this));
        },

        /**
         *  Method: _displayValidationErrors
         *    Display all errors that are thrown during graph validation.
         *
         *  Parameters:
         *    {Array} errors - A list of error messages.
         */
        _displayValidationErrors: function(errors) {
            //TODO: This is a temporary solution. Should be replaced by error messages later.

            var list = jQuery('<ul></ul>');
            _.each(errors, function(error) {
                jQuery('<li></li>').text(error).appendTo(list);
            });
            this._contentContainer.html(list);
        },

        /**
         *  Method: _displayNetworkError
         *    Display an error massage resulting from a network error (e.g. 404) in the menu's body.
         */
        _displayNetworkError: function() {
            //TODO: This is a temporary solution. Should be replaced by error messages later.
            this._contentContainer.text("Not found");
        }


    });

    /**
     *  Class: FaultTreeEditor
     *    Faulttree-specific <Base::Editor> class. The fault tree editor distinguishes from the 'normal' editor by
     *    their ability to calculate minimal cutsets for the displayed graph.
     *
     *  Extends: <Base::Editor>
     */
    return Editor.extend({
        /**
         *  Group: Members
         *
         *  Properties:
         *    {<CutsetsMenu>}     cutsetsMenu     - The <CutsetsMenu> instance used to display the calculated minimal cutsets.
         *    {<ProbabilityMenu>} probabilityMenu - The <ProbabilityMenu> instance used to display the probability of the top event.
         */
        cutsetsMenu: undefined,
        probabilityMenu: undefined,

        /**
         *  Group: Initialization
         */

        /**
         *  Constructor: init
         *    Sets up the cutset and probability menus in addition to <Base::Editor::init>.
         *
         *  Parameters:
         *    {int} graphId - The ID of the graph that is going to be edited by this editor.
         */
        init: function(graphId) {
            this._super(graphId);

            this.cutsetsMenu = new CutsetsMenu();
            this.probabilityMenu = new ProbabilityMenu()

            this._setupCutsetsActionEntry()
                ._setupTobEventProbabilityActionEntry();
        },

        /**
         *  Group: Accessors
         */

        /**
         *  Method: getConfig
         *
         *  Returns:
         *    The <FaulttreeConfig> object.
         *
         *  See also:
         *    <Base::Editor::getConfig>
         */
        getConfig: function() {
            return FaulttreeConfig;
        },

        /**
         *  Method: getGraphClass
         *
         *  Returns:
         *    The <FaulttreeGraph> class.
         *
         *  See also:
         *    <Base::Editor::getGraphClass>
         */
        getGraphClass: function() {
            return FaulttreeGraph;
        },

        /**
         *  Group: Setup
         */

        /**
         *  Method: _setupCutsetsActionEntry
         *    Adds an entry to the actions navbar group for calculating the minimal cutsets for the edited graph.
         *
         *  Returns:
         *    This editor instance for chaining.
         */
        _setupCutsetsActionEntry: function() {
            var navbarActionsEntry = jQuery(
                '<li>' +
                    '<a id="' + this.config.IDs.NAVBAR_ACTION_CUTSETS + '" href="#">Calculate cutsets</a>' +
                '</li>');
            this._navbarActionsGroup.append(navbarActionsEntry);

            // register for clicks on the corresponding nav action
            navbarActionsEntry.click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_CALCULATE_CUTSETS,
                    this.cutsetsMenu.show.bind(this.cutsetsMenu)
                );
            }.bind(this));

            return this;
        },

        /**
         *  Method: _setupTobEventProbabilityActionEntry
         *    Adds an entry to the actions navbar group for calculating the probability of the top event.
         *    Clicking will issue an asynchronous backend call which returns a <Job> object that can be queried for
         *    the final result. The job object will be used to initialize the probability menu.
         *
         *  Returns:
         *    This editor instance for chaining.
         */
        _setupTobEventProbabilityActionEntry: function() {
            var navbarActionsEntry = jQuery(
                '<li>' +
                    '<a href="#">Calculate top event probability</a>' +
                '</li>');
            this._navbarActionsGroup.append(navbarActionsEntry);

            // register for clicks on the corresponding nav action
            navbarActionsEntry.click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_CALCULATE_TOPEVENT_PROBABILITY,
                    this.probabilityMenu.show.bind(this.probabilityMenu)
                );
            }.bind(this));

            return this;
        }
    });
});
