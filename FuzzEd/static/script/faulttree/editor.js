define(['editor', 'canvas', 'faulttree/graph', 'menus', 'faulttree/config', 'alerts', 'highcharts', 'jquery-ui', 'slickgrid'],
function(Editor, Canvas, FaulttreeGraph, Menus, FaulttreeConfig, Alerts) {
    /**
     * Package: Faulttree
     */

    /**
     * Class: CutsetsMenu
     *      A menu for displaying a list of minimal cutsets calculated for the edited graph. The nodes that belong to a
     *      cutset become highlighted when hovering over the corresponding entry in the cutsets menu.
     *
     * Extends: <Base::Menus::Menu>
     */
    var CutsetsMenu = Menus.Menu.extend({
        /**
         * Group: Members
         *      {Editor} _editor - <Faulttree::Editor> the editor that owns this menu.
         */
        _editor: undefined,

        /**
         * Group: Initialization
         */

        /**
         * Constructor: init
         *      Sets up the menu.
         *
         * Parameters:
         *      {Editor} _editor - <Faulttree::Editor> the editor that owns this menu.
         */
        init: function(editor) {
            this._super();
            this._editor = editor;
        },

        /**
         * Method: _setupContainer
         *      Sets up the DOM container element for this menu and appends it to the DOM.
         *
         * Returns:
         *      A {jQuery} set holding the container.
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
        },

        /**
         * Group: Actions
         */

        /**
         * Method: show
         *      Display the given cutsets in the menu and make the menu visible.
         *
         * Parameters:
         *      {Array[Object]} cutsets - A list of cutsets calculated by the backend.
         *
         *  Returns:
         *      This{<Menu>} instance for chaining.
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
                    return this._editor.graph.getNodeById(id);
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
                        var disable = _.difference(this._editor.graph.getNodes(), nodes);
                        _.invoke(disable, 'disable');
                        _.invoke(nodes, 'highlight');
                    }.bind(this),

                    // out
                    function() {
                        var enable = _.difference(this._editor.graph.getNodes(), nodes);
                        _.invoke(enable, 'enable');
                        _.invoke(nodes, 'unhighlight');
                    }.bind(this)
                );

                listElement.append(entry);
            }.bind(this));

            this._super();
            return this;
        }
    });

    /**
     * Abstract Class: AnalysisResultMenu
     *      Base class for menus that display the results of a analysis performed by the backend. It contains a chart
     *      (currently implemented with Highcharts) and a table area (using SlickGrid). Subclasses are responsible for
     *      providing data formatters and data conversion functions.
     */
    var AnalysisResultMenu = Menus.Menu.extend({
        /**
         * Group: Members
         *      {<Editor>}        _editor            - The <Editor> instance.
         *      {<Job>}           _job               - <Job> instance of the backend job that is responsible for
         *                                             calculating the probability.
         *      {jQuery Selector} _chartContainer    - jQuery reference to the chart's container.
         *      {jQuery Selector} _gridContainer     - jQuery reference to the table's container.
         *      {Highchart}       _chart             - The Highchart instance displaying the result.
         *      {SlickGrid}       _grid              - The SlickGrid instance displaying the result.
         *      {Object}          _configNodeMap     - A mapping of the configuration ID to its node set.
         *      {Object}          _configNodeMap     - A mapping of the configuration ID to its edge set.
         *      {Object}          _redundancyNodeMap - A mapping of the configuration ID to the nodes' N-values
         */
        _editor:            undefined,
        _job:               undefined,
        _chartContainer:    undefined,
        _gridContainer:     undefined,
        _chart:             undefined,
        _grid:              undefined,
        _configNodeMap:     {},
        _configEdgeMap:     {},
        _redundancyNodeMap: {},

        /**
         * Group: Initialization
         */

        /**
         * Constructor: init
         *      Sets up the menu.
         */
        init: function(editor) {
            this._super();
            this._editor = editor;
            this._chartContainer = this.container.find('.chart');
            this._gridContainer  = this.container.find('.grid');
        },

        /**
         * Group: Actions
         */

        /**
         * Method: show
         *      Display the given job status its results.
         *
         * Parameters:
         *      {<Job>} job - The backend job that calculates the probability of the top event.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} instance for chaining.
         */
        show: function(job) {
            // clear the content
            this._clear();

            job.successCallback  = this._evaluateResult.bind(this);
            job.updateCallback   = this._displayProgress.bind(this);
            job.errorCallback    = this._displayJobError.bind(this);
            job.notFoundCallback = this._displayJobError.bind(this);
            job.queryInterval    = 500;

            this._job = job;
            job.progressMessage = FaulttreeConfig.ProgressIndicator.CALCULATING_MESSAGE;
            job.start();

            this._super();
            return this;
        },

        /**
         * Method: hide
         *      Hide the menu and clear all its content. Also stops querying for job results.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} instance for chaining.
         */
        hide: function() {
            this._super();
            // cancel query job
            this._job.cancel();
            // clear content
            this._clear();

            return this;
        },

        /**
         * Method: _clear
         *      Clear the content of the menu and cancel any running jobs.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} instance for chaining.
         */
        _clear: function() {
            if (typeof this._job !== 'undefined') this._job.cancel();
            this._chartContainer.empty();
            this._gridContainer.empty();
            // reset height in case it was set during grid creation
            this._gridContainer.css('height', '');
            this._chart = null; this._grid = null;
            this._configNodeMap = {};
            this._redundancyNodeMap = {};

            return this;
        },

        /**
         *  Group: Setup
         */

        /**
         * Abstract Method: _setupContainer
         *      Sets up the DOM container element for this menu and appends it to the DOM.
         *
         * Returns:
         *      A jQuery object of the container.
         */
        _setupContainer: function() {
            throw new SubclassResponsibility();
        },

        /**
         * Method: setupResizing
         *      Enables this menu to be resizable and therefore to enlarge or shrink the calculated analysis results.
         *      Any subclass has to ensure that its particular outcomes adhere to this behaviour.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _setupResizing: function() {
            this.container.resizable({
                resize: function() {
                    if (this._chart != null) {
                        // fit all available space with chart
                        this._chartContainer.height(this.container.height() - this._gridContainer.outerHeight());

                        this._chart.setSize(
                            this._chartContainer.width(),
                            this._chartContainer.height(),
                            false
                        );
                    }
                    this._gridContainer.width(this._chartContainer.width());
                    this._grid.resizeCanvas();
                }.bind(this),
                minHeight: this.container.height(), // use current height as minimum
                maxHeight: this.container.height()
            });
        },

        /**
         * Group: Evaluation
         */

        /**
         * Method: _evaluateResult
         *      Evaluates the job result. Either displays the analysis results or the returned error message.
         *
         * Parameters:
         *      {String} data - Data returned from the backend containing the result of the calculation.
         */
        _evaluateResult: function(data) {
            data = jQuery.parseJSON(data);

            if (_.size(data.errors) > 0) {
                // errors is a dictionary with the node ID as key
                this._displayValidationErrors(data.errors);
            }

            if (_.size(data.warnings) > 0) {
                // warnings is a dictionary with the node ID as key
                this._displayValidationWarnings(data.warnings);
            }

            if (_.size(data.configurations) > 0) {
                var chartData = {};
                var tableData = [];
                var configID = '';

                _.each(data.configurations, function(config, index) {
                    configID = config['id'];

                    // remember the nodes and edges involved in this config for later highlighting
                    this._collectNodesAndEdgesForConfiguration(configID, config['choices']);

                    // remember the redundancy settings for this config for later highlighting
                    this._redundancyNodeMap[configID] = {};
                    _.each(config['choices'], function(choice, node) {
                        if (choice.type == 'RedundancyChoice') {
                            this._redundancyNodeMap[configID][node] = choice['n'];
                        }
                    }.bind(this));

                    // collect chart data if given
                    if (typeof config['points'] !== 'undefined') {
                        chartData[configID] = _.sortBy(config['points'], function(point){ return point[0] });
                    }

                    // collect table rows
                    // they are basically the configs without the points and choices
                    var tableEntry = config;
                    // delete keys we no longer need
                    tableEntry['points'] = undefined;
                    tableEntry['choices'] = undefined;
                    tableData.push(tableEntry);

                }.bind(this));

                // remove progress bar
                this._chartContainer.empty();
                // only display chart if points were given
                if (_.size(chartData) != 0) {
                    this._displayResultWithHighcharts(chartData, data['decompositionNumber']);
                }
                this._displayResultWithSlickGrid(tableData);

                this._setupResizing();
            } else {
                // close menu again if there are no results
                this.hide();
            }
        },

        /**
         * Group: Accessors
         */

        /**
         * Abstract Method: _getDataColumns
         *
         *  Returns:
         *      An {Array[Object]} of column descriptions (https://github.com/mleibman/SlickGrid/wiki/Column-Options).
         */
        _getDataColumns: function() {
            throw new SubclassResponsibility();
        },

        /**
         * Abstract Method: _chartTooltipFormatter
         *      This function is used to format the tooltip that appears when hovering over a data point in the chart.
         *      The scope object ('this') contains the x and y value of the corresponding point.
         *
         *  Returns:
         *      A {String} that is displayed inside the tooltip. It may HTML.
         */
        _chartTooltipFormatter: function() {
            throw new SubclassResponsibility();
        },

        /**
         *  Abstract Method: _progressMessage
         *      Should compute the message that is displayed while the backend calculation is pending.
         *
         *  Returns:
         *      A {String} with the message. May contain HTML.
         */
        _progressMessage: function() {
            throw new SubclassResponsibility();
        },

        /**
         * Group: Conversion
         */

        /**
         *  Method: _collectNodesAndEdgesForConfiguration
         *      Traverses the graph and collects all nodes and edges which are part of the configuration defined by the
         *      given set of choices. Remember those entities in the <_configNodeMap> and <_configEdgeMap> fields
         *      using the given configID.
         *
         * Parameters:
         *      {String}         configID - The id of the configuration that is used to store the nodes and edges.
         *      {Array[Object]}  choices  - A map from node IDs to choice objects (with 'type' and 'value') used to
         *                                  filter the graph entities.
         *      {<Node>}         topNode  - [optional] The top node of the graph. Used for recursion. Defaults to the
         *                                  top event.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _collectNodesAndEdgesForConfiguration: function(configID, choices, topNode) {
            // start from top event if not further
            if (typeof topNode === 'undefined') topNode = this._editor.graph.getNodeById(0);
            // get children filtered by choice
            var children = topNode.getChildren();
            var nodes = [topNode];
            var edges = topNode.incomingEdges;

            if (topNode.id in choices) {
                var choice = choices[topNode.id];

                switch (choice['type']) {
                    case 'InclusionChoice':
                        // if this node is not included (optional) ignore it and its children
                        if (!choice['included']) {
                            children = [];
                            nodes = [];
                            edges = [];
                        }
                        break;

                    case 'FeatureChoice':
                        // only pick the chosen child of a feature variation point
                        children = [_.find(children, function(node) {return node.id == choice['featureId']})];
                        break;

                    case 'RedundancyChoice':
                        // do not highlight this node and its children if no child was chosen
                        if (choice['n'] == 0) {
                            nodes = [];
                            children = [];
                            edges = [];
                        }
                        break;
                }
            }

            this._configNodeMap[configID] = nodes.concat(this._configNodeMap[configID] || []);
            this._configEdgeMap[configID] = edges.concat(this._configEdgeMap[configID] || []);

            // recursion
            _.each(children, function(child) {
                this._collectNodesAndEdgesForConfiguration(configID, choices, child);
            }.bind(this));

            return this;
        },

        /**
         * Group: Display
         */

        /**
         * Method: _displayProgress
         *      Display the job's progress in the menu's body.
         *
         * Parameters:
         *      {Object} data - Data returned from the backend with information about the job's progress.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayProgress: function(data) {
            if (this._chartContainer.find('.progress').length > 0) return this;

            var progressBar = jQuery(
                '<div style="text-align: center;">' +
                    '<p>' + this._progressMessage() + '</p>' +
                    '<div class="progress progress-striped active">' +
                        '<div class="progress-bar" role="progressbar" style="width: 100%;"></div>' +
                    '</div>' +
                '</div>');

            this._chartContainer.empty().append(progressBar);
            this._gridContainer.empty();

            return this;
        },

        /**
         * Method: _displayResultWithHighcharts
         *      Display the job's result in the menu's body using Highcharts.
         *
         * Parameters:
         *    {Array[Object]} data  - A set of one or more data series to display in the Highchart.
         *    {Number}        yTick - [optional] The tick of the y-axis (number of lines).
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayResultWithHighcharts: function(data, yTick) {
            if (data.length == 0) return this;

            yTick = yTick || 5;
            var series = [];

            _.each(data, function(cutset, name) {
                series.push({
                    name: name,
                    data: cutset
                });
            });
            // clear container
            this._chartContainer.empty();

            //TODO: This is all pretty hard-coded. Put it into config instead.
            this._chart = new Highcharts.Chart({
                chart: {
                    renderTo: this._chartContainer[0],
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
                    min: -0.05,
                    max:  1.05
                },
                yAxis: {
                    min: 0,
                    max: 1,
                    title: {
                        text: null
                    },
                    tickInterval: 1.0,
                    minorTickInterval: 1.0 / yTick
                },
                tooltip: {
                    formatter: this._chartTooltipFormatter
                },
                plotOptions: {
                    series: {
                        marker: {
                            radius: 1
                        },
                        events: {
                            // select the corresponding grid row of the hovered series
                            // this will also highlight the corresponding nodes
                            mouseOver: function() {
                                var configID = this.name;
                                _.each(this._grid.getData(), function(dataItem, index) {
                                    if (dataItem.id == configID) {
                                        this._grid.setSelectedRows([index]);
                                    }
                                }.bind(this));
                            },
                            // unselect all grid cells
                            mouseOut: function() {
                                this._grid.setSelectedRows([]);
                            }.bind(this)
                        }
                    }
                },

                series: series
            });

            return this;
        },

        /**
         * Method: _displayResultWithSlickGrid
         *      Display the job's result in the menu's body using SlickGrid.
         *
         * Parameters:
         *      {Object} data - A set of one or more data series to display in the SlickGrid.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayResultWithSlickGrid: function(data) {
            var columns = this._getDataColumns();
            var options = {
                enableCellNavigation:       true,
                enableColumnReorder:        false,
                multiColumnSort:            true,
                autoHeight:                 true,
                forceFitColumns:            true
            };
            // little workaround for constraining the height of the grid
            var maxHeight = this._editor.getConfig().Menus.PROBABILITY_MENU_MAX_GRID_HEIGHT;

            if ((data.length + 1) * 25 > maxHeight) {
                options.autoHeight = false;
                this._gridContainer.height(maxHeight);
            }

            // clear container
            this._gridContainer.empty();
            // create new grid
            this._grid = new Slick.Grid(this._gridContainer, data, columns, options);
            // make rows selectable
            this._grid.setSelectionModel(new Slick.RowSelectionModel());
            // highlight the corresponding nodes if a row of the grid is selected
            this._grid.onSelectedRowsChanged.subscribe(function(e, args) {
                this._unhighlightConfiguration();
                // only highlight the configuration if only one config is selected
                if (args.rows.length == 1) {
                    var configID = args.grid.getDataItem(args.rows[0])['id'];
                    this._highlightConfiguration(configID);
                }
            }.bind(this));

            // highlight rows on mouse over
            this._grid.onMouseEnter.subscribe(function(e, args) {
                var row = args.grid.getCellFromEvent(e)['row'];
                args.grid.setSelectedRows([row]);
            });
            // unhighlight cells on mouse out
            this._grid.onMouseLeave.subscribe(function(e, args) {
                args.grid.setSelectedRows([]);
            });

            // enable sorting of the grid
            this._grid.onSort.subscribe(function(e, args) {
                var cols = args.sortCols;
                data.sort(function (dataRow1, dataRow2) {
                    for (var i = 0, l = cols.length; i < l; i++) {
                        var field = cols[i].sortCol.field;
                        var sign = cols[i].sortAsc ? 1 : -1;
                        var value1 = dataRow1[field], value2 = dataRow2[field];
                        var result = (value1 == value2 ? 0 : (value1 > value2 ? 1 : -1)) * sign;
                        if (result != 0) {
                            return result;
                        }
                    }
                    return 0;
                });

                this._grid.invalidate();
            }.bind(this));

            return this;
        },

        /**
         *  Method: _highlightConfiguration
         *      Highlights all nodes, edges and n-values that are part of the given configuration on hover.
         *
         *  Parameters:
         *      {String} configID - The ID of the configuration that should be highlighted.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _highlightConfiguration: function(configID) {
            // prevents that node edge anchors are being displayed
            Canvas.container.addClass(FaulttreeConfig.Classes.CANVAS_NOT_EDITABLE);

            // highlight nodes
            _.invoke(this._configNodeMap[configID], 'highlight');
            // highlight edges
            _.invoke(this._configEdgeMap[configID], 'setHover', true);
            // show redundancy values
            _.each(this._redundancyNodeMap[configID], function(value, nodeID) {
                var node = this._editor.graph.getNodeById(nodeID);
                node.showBadge('N=' + value, 'info');
            }.bind(this));

            return this;
        },

        /**
         *  Method: _unhighlightConfiguration
         *      Remove all hover highlights handler currently attached.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _unhighlightConfiguration: function() {
            // make the anchors visible again
            Canvas.container.removeClass(FaulttreeConfig.Classes.CANVAS_NOT_EDITABLE);

            // unhighlight all nodes
            _.invoke(this._editor.graph.getNodes(), 'unhighlight');
            // unhighlight all edges
            _.invoke(this._editor.graph.getEdges(), 'setHover', false);
            // remove all badges
            _.invoke(this._editor.graph.getNodes(), 'hideBadge');

            return this;
        },

        /**
         * Method: _displayValidationErrors
         *      Display all errors that are thrown during graph validation.
         *
         * Parameters:
         *      {Object} errors - A mapping of error messages.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayValidationErrors: function(errors) {
            //TODO: This is a temporary solution. Errors should be displayed per node later.
            if (_.size(errors) == 1) {
                Alerts.showErrorAlert('Analysis error: ', errors[0]);
            } else {
                var errorList = '<ul>';
                _.each(errors, function(error) {
                    errorList += '<li>' + error + '</li>';
                });
                errorList += '</ul>';
                Alerts.showErrorAlert('Analysis errors: ', errorList);
            }

            return this;
        },

        /**
         * Method: _displayValidationWarnings
         *      Display all warnings that are thrown during graph validation.
         *
         * Parameters:
         *      {Object} warnings - A dictionary of warning messages.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayValidationWarnings: function(warnings) {
            //TODO: This is a temporary solution. Warnings should be displayed per node later.
            if (_.size(warnings) == 1) {
                Alerts.showWarningAlert('Warning:', warnings[0]);
            } else {
                var warningList = '<ul>';
                _.each(warnings, function(warning) {
                    warningList += '<li>' + warning + '</li>';
                });
                warningList += '</ul>';
                Alerts.showWarningAlert('Multiple warnings returned from analysis:', warningList);
            }

            return this;
        },

        /**
         * Method: _displayJobError
         *      Display an error massage resulting from a job error.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayJobError: function(xhr) {
            Alerts.showErrorAlert(
                'An error occurred!', xhr.responseText ||
                'Are you still connected to the internet? If so, please let us know, we made a mistake here!');
            this.hide();
        }
    });


    /**
     *  Class: AnalyticalProbabilityMenu
     *      The menu responsible for displaying the results of the 'analytical' analysis.
     *
     *  Extends: {<AnalyticalResultMenu>}
     */
    var AnalyticalProbabilityMenu = AnalysisResultMenu.extend({
        /**
         * Method: _setupContainer
         *      Sets up the DOM container element for this menu and appends it to the DOM.
         *
         *  Returns:
         *      A jQuery object of the container.
         */
        _setupContainer: function() {
            return jQuery(
                '<div id="' + FaulttreeConfig.IDs.ANALYTICAL_PROBABILITY_MENU + '" class="menu" header="Analysis Results">\
                    <div class="menu-controls">\
                        <span class="menu-minimize"></span>\
                        <span class="menu-close"></span>\
                    </div>\
                    <div class="chart"></div>\
                    <div class="grid" style="width: 450px; padding-top: 5px;"></div>\
                </div>'
            )
            .appendTo(jQuery('#' + FaulttreeConfig.IDs.CONTENT));
        },

        /**
         * Abstract Method: _getDataColumns
         *      Override of the abstract base method. Returns the standard FuzzTree config table schema.
         */
        _getDataColumns: function() {
            function shorten(row, cell, value) {
                return Highcharts.numberFormat(value, 5);
            }

            return [
                { id: 'id',    name: 'Config', field: 'id',     sortable: true },
                { id: 'min',   name: 'Min',    field: 'min',    sortable: true, formatter: shorten },
                { id: 'peak',  name: 'Peak',   field: 'peak',   sortable: true, formatter: shorten },
                { id: 'max',   name: 'Max',    field: 'max',    sortable: true, formatter: shorten },
                { id: 'costs', name: 'Costs',  field: 'costs',  sortable: true },
                { id: 'ratio', name: 'Risk',   field: 'ratio',  sortable: true, minWidth: 150}
            ];
        },

        /**
         * Method: _chartTooltipFormatter
         *      Function used to format the toolip that appears when hovering over a data point in the chart. The scope
         *      object ('this') contains the x and y value of the corresponding point.
         *
         * Returns:
         *      A {String} that is displayed inside the tooltip. It may HTML.
         */
        _chartTooltipFormatter: function() {
            return '<b>' + this.series.name + '</b><br/>' +
                   '<i>Probability:</i> <b>' + Highcharts.numberFormat(this.x, 5) + '</b><br/>' +
                   '<i>Membership Value:</i> <b>' + Highcharts.numberFormat(this.y, 2) + '</b>';
        },

        /**
         * Method: _progressMessage
         *      Override of the abstract base class method.
         */
        _progressMessage: function() {
            return 'Running probability analysis...';
        }
    });


    /**
     * Class: SimulatedProbabilityMenu
     *      The menu responsible for displaying the results of the 'analytical' analysis.
     *
     * Extends: AnalysisResultMenu
     */
    var SimulatedProbabilityMenu = AnalysisResultMenu.extend({
        /**
         * Method: _setupContainer
         *      Sets up the DOM container element for this menu and appends it to the DOM.
         *
         * Returns:
         *      A jQuery object of the container.
         */
        _setupContainer: function() {
            return jQuery(
                '<div id="' + FaulttreeConfig.IDs.SIMULATED_PROBABILITY_MENU + '" class="menu" header="Simulation Results">\
                    <div class="menu-controls">\
                        <span class="menu-minimize"></span>\
                        <span class="menu-close"></span>\
                    </div>\
                    <div class="chart"></div>\
                    <div class="grid" style="width: 450px; padding-top: 5px;"></div>\
                </div>'
            )
            .appendTo(jQuery('#' + FaulttreeConfig.IDs.CONTENT));
        },

        /**
         * Method: _getDataColumns
         *      Overrides the abstract base method. Show the standard FaultTree simulation table.
         */
        _getDataColumns: function() {
            function shorten(row, cell, value) {
                return Highcharts.numberFormat(value, 5);
            }

            return [
                { id: 'id',          name: 'Config',      field: 'id',          sortable: true },
                { id: 'mttf',        name: 'MTTF',        field: 'mttf',        sortable: true },
                { id: 'reliability', name: 'Reliability', field: 'reliability', sortable: true },
                { id: 'rounds',      name: 'Rounds',      field: 'rounds',      sortable: true },
                { id: 'failures',    name: 'Failures',    field: 'failures',    sortable: true },
                { id: 'costs',       name: 'Costs',       field: 'costs',       sortable: true },
                { id: 'ratio',       name: 'Risk',        field: 'ratio',       sortable: true, minWidth: 150}
            ];
        },

        /**
         * Method: _chartTooltipFormatter
         *      Function used to format the tooltip that appears when hovering over a data point in the chart.
         *      The scope object ('this') contains the x and y value of the corresponding point.
         *
         *  Returns:
         *    A {String} that is displayed inside the tooltip. It may HTML.
         */
        _chartTooltipFormatter: function() {
            //TODO: adapt to JSON format
            return '<b>' + this.series.name + '</b><br/>' +
                   '<i>Probability:</i> <b>' + Highcharts.numberFormat(this.x, 5) + '</b><br/>' +
                   '<i>Membership Value:</i> <b>' + Highcharts.numberFormat(this.y, 2) + '</b>';
        },

        /**
         * Method: _progressMessage
         *      Override of the abstract base method.
         */
        _progressMessage: function() {
            return 'Running simulation...';
        }
    });

    /**
     * Class: FaulttreeEditor
     *      Faulttree-specific <Base::Editor> class. The fault tree editor distinguishes from the 'normal' editor by
     *      their ability to calculate minimal cutsets for the displayed graph.
     *
     * Extends: <Base::Editor>
     */
    return Editor.extend({
        /**
         * Group: Members
         *      {<CutsetsMenu>}               cutsetsMenu               - The <CutsetsMenu> instance used to display the
         *                                                                calculated minimal cutsets.
         *      {<AnalyticalProbabilityMenu>} analyticalProbabilityMenu - The <AnalyticalProbabilityMenu> instance used
         *                                                                to display the probability of the top event.
         *      {<SimulatedProbabilityMenu>}  simulatedProbabilityMenu  - The <SimulatedProbabilityMenu> instance used
         *                                                                to display the probability of the top event.
         */
        cutsetsMenu:               undefined,
        analyticalProbabilityMenu: undefined,
        simulatedProbabilityMenu:  undefined,

        /**
         * Group: Accessors
         */

        /**
         * Method: getConfig
         *      Overrides the abstract base method.
         *
         * Returns:
         *      The <FaulttreeConfig> object.
         */
        getConfig: function() {
            return FaulttreeConfig;
        },

        /**
         * Method: getGraphClass
         *      Overrides the abstract base method.
         *
         * Returns:
         *      The <FaulttreeGraph> class.
         */
        getGraphClass: function() {
            return FaulttreeGraph;
        },

        /**
         * Group: Setup
         */
        _loadGraphCompleted: function(readOnly) {
            //this.cutsetsMenu     = new CutsetsMenu(this);
            this.analyticalProbabilityMenu = new AnalyticalProbabilityMenu(this);
            this.simulatedProbabilityMenu  = new SimulatedProbabilityMenu(this);

            this._setupCutsetsAction()
                ._setupAnalyticalProbabilityAction()
                ._setupSimulatedProbabilityAction()
                ._setupExportPDFAction()
                ._setupExportEPSAction();

            return this._super(readOnly);
        },

        /**
         * Method: _setupCutsetsAction
         *      Registers the click handler for the 'cut set analysis' menu entry.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _setupCutsetsAction: function() {
            jQuery("#"+this.config.IDs.ACTION_CUTSETS).click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_CALCULATE_CUTSETS,
                    this.cutsetsMenu.show.bind(this.cutsetsMenu)
                );
            }.bind(this));

            return this;
        },

        /**
         *  Method: _setupExportPDFAction
         *      Registers the click handler for the 'export PDF document' menu entry.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _setupExportPDFAction: function() {
            jQuery("#"+this.config.IDs.ACTION_EXPORT_PDF).click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_GRAPH_EXPORT_PDF,
                    function(url) {
                        this._downloadFileFromURL(url, 'pdf');
                    }.bind(this)
                )
            }.bind(this));

            return this;
        },

        /**
         * Method: _setupExportEPSAction
         *      Registers the click handler for the 'export EPS document' menu entry.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _setupExportEPSAction: function() {
            jQuery("#"+this.config.IDs.ACTION_EXPORT_EPS).click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_GRAPH_EXPORT_EPS,
                    function(url) {
                        this._downloadFileFromURL(url, 'eps');
                    }.bind(this)
                )
            }.bind(this));

            return this;
        },

        /**
         * Method: _setupAnalyticalProbabilityAction
         *      Registers the click handler for the 'analytical analysis' menu entry. Clicking will issue an
         *      asynchronous backend call which returns a <Job> object that can be queried for the final result. The
         *      job object will be used to initialize the analytical probability menu.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _setupAnalyticalProbabilityAction: function() {
            jQuery("#"+this.config.IDs.ACTION_ANALYTICAL).click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_CALCULATE_ANALYTICAL_PROBABILITY,
                    this.analyticalProbabilityMenu.show.bind(this.analyticalProbabilityMenu));
            }.bind(this));

            return this;
        },

        /**
         * Method: _setupSimulatedProbabilityAction
         *      Registers the click handler for the 'simulated analysis' menu entry. Clicking will issue an asynchronous
         *      backend call which returns a <Job> object that can be queried for the final result. The job object will
         *      be used to initialize the simulated probability menu.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _setupSimulatedProbabilityAction: function() {
            jQuery("#"+this.config.IDs.ACTION_SIMULATED).click(function() {
                jQuery(document).trigger(
                    this.config.Events.EDITOR_CALCULATE_SIMULATED_PROBABILITY,
                    this.simulatedProbabilityMenu.show.bind(this.simulatedProbabilityMenu));
            }.bind(this));

            return this;
        },

        /**
         * Method: _downloadFileFromURL
         *      Triggers a download of the given resource. At the moment, it only opens it in the current window.
         *
         * Parameters:
         *      {String} url - The URL to the file to be downloaded.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _downloadFileFromURL: function(url, format) {
            //TODO: maybe we can use more sophisticated methods here to get the file to download directly instead
            //      of opening in the same window
            window.location = url;

            return this;
        }
    });
});
