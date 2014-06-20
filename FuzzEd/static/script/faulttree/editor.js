define(['editor', 'canvas', 'faulttree/graph', 'menus', 'faulttree/config', 'alerts', 'datatables', 'highcharts', 'jquery-ui', 'slickgrid'],
function(Editor, Canvas, FaulttreeGraph, Menus, FaulttreeConfig, Alerts, DataTables) {
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
                       <i class="menu-minimize"></i>\
                       <i class="menu-close">   </i>\
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
     *      (implemented with Highcharts) and a table area (using DataTables). Subclasses are responsible for
     *      providing data formatters and data conversion functions.
     */
    var AnalysisResultMenu = Menus.Menu.extend({
        /**
         * Group: Members
         *      {<Editor>}        _editor              - The <Editor> instance.
         *      {<Job>}           _job                 - <Job> instance of the backend job that is responsible for
         *                                               calculating the probability.
         *      {jQuery Selector} _graphIssuesContainer - Display
         *      {jQuery Selector} _chartContainer      - jQuery reference to the chart's container.
         *      {jQuery Selector} _gridContainer       - jQuery reference to the table's container.
         *      {Highchart}       _chart               - The Highchart instance displaying the result.
         *      {DataTables}      _grid                - The DataTables instance displaying the result.
         *      {Object}          _configNodeMap       - A mapping of the configuration ID to its node set.
         *      {Object}          _configNodeMap       - A mapping of the configuration ID to its edge set.
         *      {Object}          _redundancyNodeMap   - A mapping of the configuration ID to the nodes' N-values
         */
        _editor:              undefined,
        _job:                 undefined,
        _graphIssuesContainer: undefined,
        _chartContainer:      undefined,
        _gridContainer:       undefined,
        _chart:               undefined,
        _grid:                undefined,
        _configNodeMap:       {},
        _configEdgeMap:       {},
        _redundancyNodeMap:   {},

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
            this._graphIssuesContainer = this.container.find('.graph_issues');
            this._chartContainer       = this.container.find('.chart');
            this._gridContainer        = this.container.find('.table_container');
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
            
            this._graphIssuesContainer.empty();
            this._chartContainer.empty();
            this._gridContainer.empty();
            // reset height in case it was set during grid creation
            this._gridContainer.css('min-height', '');
            // reset container width (which is set after initalisation of DataTables)
            this.container.css('width','');
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
            return jQuery(
                '<div id="' + FaulttreeConfig.IDs.ANALYTICAL_PROBABILITY_MENU + '" class="menu" header="Top Event Probability (analytical)">\
                    <div class="menu-controls">\
                        <i class="menu-minimize"></i>\
                        <i class="menu-close"></i>\
                    </div>\
                    <div class="graph_issues"></div>\
                    <div class="chart"></div>\
                    <div class="table_container content"></div>\
                </div>'
            ).appendTo(jQuery('#' + FaulttreeConfig.IDs.CONTENT));
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
                minHeight: this.container.outerHeight(), // use current height as minimum
                minWidth : this.container.outerWidth(),
                resize: function(event, ui) {

                    if (this._chart != null) {
                        
                        // fit all available space with chart    
                        var margin_offset = 30;
                        
                        this._chartContainer.height(this.container.height() - this._graphIssuesContainer.height() - this._gridContainer.height() - margin_offset);
                        
                        this._chart.setSize(
                            this._chartContainer.width(),
                            this._chartContainer.height(),
                            false
                        );
                    }   
                }.bind(this),
                stop: function(event, ui) {
                    // set container height to auto after resizing (because of collapsing elements)
                    this.container.css('height', 'auto');
                    
                }.bind(this)

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
        _evaluateResult: function(data, job_result_url) {
            
            data   = jQuery.parseJSON(data);
            var issues = data.issues;
            
            if (issues){
                this._displayGraphIssues(issues.errors, issues.warnings);
            }
                
            // remove progress bar
            this._chartContainer.empty();
           
            // display results within a table
            var columns = data.columns;
            this._displayResultWithDataTables(columns, job_result_url);
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
                        events: {}
                    }
                },

                series: series
            });

            return this;
        },
                
        /**
         * Method: _displayResultWithDataTables
         *      Display the job's result with DataTables Plugin. Configuration Issues are printed inside the table as collapsed row. 
         *
         * Parameters:
         *     {Array[Object]}  columns        - A set of columns that shall be displayed within the table.
         *     {String}         job_result_url - URL under which the server delivers configurations for a specific analysis result (using ajax and pagingation)
         *    
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayResultWithDataTables: function(columns, job_result_url) {
            
            // clear container
            this._gridContainer.html('<table id="results_table" class="results_table table table-hover content"></table>');            
            
            var collapse_column = {
                                    "class":          'details-control',
                                    "orderable":      false,
                                    "data":           null,
                                    "defaultContent": '',
                                    "bSortable":      false
                                  };
                                  
            columns.unshift(collapse_column);
            
            //formating function for displaying configuration warnings/errors
            var format = function (d) {
                if ('issues' in d){
                    var issues = d['issues'];
                    
                    var errors   = issues['errors'] || [];
                    var warnings = issues['warnings'] || [];
                    
                    return this._displayIsussuesList(errors, warnings);
                }
                
                return '';
            }.bind(this);
              
            this._grid = jQuery('#results_table').dataTable({
                            "bProcessing":   true,
                            "bFilter":       false,
                            "bServerSide":   true,
                            "sAjaxSource":   job_result_url,
                            "aoColumns":     columns,
                            "bLengthChange": false,
                            "iDisplayLength": 10,
                            "fnDrawCallback": function(oSettings) {
                                // display points with highchart after table was rendered
                                var serverData = oSettings['json'];
                                var configurations = serverData['aaData'];
                                var chartData = {};
                                 
                                 _.each(configurations, function(config) {
                                     var configID = config['id'] || '';
                                     
                                     // collect chart data if given
                                     if (typeof config['points'] !== 'undefined') {
                                         chartData[configID] = _.sortBy(config['points'], function(point){ return point[0] });
                                     }
                                     
                                     if (_.size(chartData) != 0) {
                                         this._displayResultWithHighcharts(chartData, 10); //data['decompositionNumber']);
                                     }
                                     
                                     
                                 }.bind(this)); 
                                
                                }.bind(this),
                            "fnRowCallback": function( nRow, aData, iDisplayIndex, iDisplayIndexFull) {
                                
                                // Callback is executed for each row (each row is one configuration)
                                                
                                var current_config = aData;
                                var configID = current_config['id'];
                                                    
                                if ('choices' in current_config ){
                                    var choices  = aData['choices'];
                                    
                                    // remember the nodes and edges involved in this config for later highlighting
                                    
                                    // clear configNodeMap and configEdgeMap for specific configuration id
                                    this._configNodeMap[configID] = [];
                                    this._configEdgeMap[configID] = [];
                                    
                                    this._collectNodesAndEdgesForConfiguration(configID, choices);
                                    
                                    // remember the redundancy settings for this config for later highlighting
                                    this._redundancyNodeMap[configID] = {};
                                    _.each(choices, function(choice, node) {
                                        if (choice.type == 'RedundancyChoice') {
                                            this._redundancyNodeMap[configID][node] = choice['n'];
                                        }
                                    }.bind(this));
                                    
                                    jQuery(nRow).on("mouseover", function(){    
                                            this._highlightConfiguration(configID);                                                
                                     }.bind(this));
                                }
                                
                                /* Sample Configuration issues
                                if (iDisplayIndex == 0){
                                    current_config["issues"] = { "errors": [{"message": "map::at", "issueId": 0, "elementId": ""}]};
                                } else if (iDisplayIndex == 1){
                                    current_config["issues"] = { "warnings": [{"message": "Ignoring invalid redundancy configuration with k=-2 N=0", "issueId": 0, "elementId": "3"}]};
                                } else if (iDisplayIndex == 2){
                                     current_config["issues"] = { "errors": [{"message": "map::at", "issueId": 0, "elementId": ""},{"message": "error error error", "issueId": 0, "elementId": ""}, {"message": "another error", "issueId": 0, "elementId": ""}], "warnings": [{"message": "Ignoring invalid redundancy configuration with k=-2 N=0", "issueId": 0, "elementId": "3"}, {"message": "another warning", "issueId": 0, "elementId": "3"}] };
                                }*/
                                
                                if ('issues' in current_config){
                                    jQuery(nRow).find('td.details-control').append('<i class="fa fa-exclamation-triangle"></i>');
                                    
                                    // Add event listener for opening and closing details
                                    jQuery(nRow).on('click', function () {
                                        var tr  = jQuery(nRow);
                                        var row = this._grid.api().row(tr);
 
                                        if ( row.child.isShown() ) {
                                            // This row is already open - close it
                                            row.child.hide();
                                            tr.removeClass('shown');
                                        }
                                        else {
                                            // Open this row
                                            row.child(format(row.data())).show();
                                            tr.addClass('shown');
                                        }
                                    }.bind(this));
            
                                    var issues = current_config['issues'];
                                    
                                    if ('errors' in issues){
                                        jQuery(nRow).addClass('danger');
                                    }
                                    else if ('warnings' in issues){
                                        jQuery(nRow).addClass('warning');
                                    }
                                    
                                }
                                else{
                                    // if row is not collapsable show default pointer
                                    jQuery(nRow).css('cursor', 'default');
                                } 
                            }.bind(this),
                                             
                            "fnInitComplete": function(oSettings, json) {  
                                    this._setupResizing();
                                    
                                    // set minumum height of grid as the height of the first draw of the grid
                                    this._gridContainer.css('min-height', this._gridContainer.height());
                                    // keep container width when switching the page (-> otherwise jumping width when switching)
                                    this.container.css('width', this.container.width());
                                    
                                }.bind(this)    
                            });
                             
            this._grid.on('mouseleave', 'tr', function () {
                this._unhighlightConfiguration();
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
            _.invoke(this._configEdgeMap[configID], 'highlight');
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
            _.invoke(this._editor.graph.getEdges(), 'unhighlight');
            // remove all badges
            _.invoke(this._editor.graph.getNodes(), 'hideBadge');

            return this;
        },
        
        /**
         * Method: _displayGraphIssues
         *      Display all warnings/errors that are thrown during graph validation.
         *
         * Parameters:
         *      {Object} warnings - An array of warning objects.
         *      {Object} errors   - An array of error objects.
         *
         * Returns:
         *      This {<AnalysisResultMenu>} for chaining.
         */
        _displayGraphIssues: function(errors, warnings) {

            var num_errors   = _.size(errors);
            var num_warnings = _.size(warnings);
            
            var alert_container = jQuery('<div class="alert"><i class="fa fa-exclamation-triangle"></i></div>')
            
            if (num_errors > 0){
                alert_container.addClass('alert-error');                
            } else if(num_warnings >0){
                alert_container.addClass('alert-warning');  
            } else{
                alert_container.addClass('alert-success');  
            }
            
            var issues_heading   = jQuery('<a class="alert-link">\
                                            Errors: ' + num_errors + '&nbsp;&nbsp;&nbsp;\
                                            Warnings: ' + num_warnings +
                                          '</a>');
                                            
            var issues_details   = jQuery('<div class="collapse">' + this._displayIsussuesList(errors, warnings) + '</div>');
            
            alert_container.append(issues_heading).append(issues_details);
            
            // collapse error/warning messages details after clicking on the heading
            issues_heading.click(function(){
                issues_details.collapse('toggle');
            });
            
           this._graphIssuesContainer.append(alert_container);

           return this;
        },
        
        
        /**
         * Method: _displayIsussuesList
         *      Display all errors/warnings in a HTML unordered list.
         *
         * Parameters:
         *      {Object} warnings - An array of warning objects.
         *      {Object} errors   - An array of error objects.
         *
         * Returns:
         *     {String} contains HTML with error/warning messages.
         */
        _displayIsussuesList: function(errors, warnings){
            var html_errors   = '';
            var html_warnings = '';
                   
            
            if(_.size(errors) > 0){
                _.each(errors, function(error){
                    html_errors += '<li>' + error['message'] + '</li>';
                });
                html_errors = '<li><strong>Errors:</strong></li><ul>' + html_errors + '</ul>';  
            }
            
             if(_.size(warnings) > 0){        
                _.each(warnings, function(warning){
                    html_warnings += '<li>' + warning['message'] + '</li>';
                });
                html_warnings = '<li><strong>Warnings:</strong></li><ul>' + html_warnings + '</ul>';
            }
                            
            return '<ul>' + 
                        html_errors + 
                        html_warnings + 
                   '</ul>';
                      
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
         *  Method: _chartTooltipFormatter
         *    Function used to format the toolip that appears when hovering over a data point in the chart.
         *    The scope object ('this') contains the x and y value of the corresponding point.
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
                        <i class="menu-minimize"></i>\
                        <i class="menu-close">   </i>\
                    </div>\
                    <div class="chart"></div>\
                    <div class="grid" style="width: 450px; padding-top: 5px;"></div>\
                </div>'
            )
            .appendTo(jQuery('#' + FaulttreeConfig.IDs.CONTENT));
        },

        /**
         *  Method: _chartTooltipFormatter
         *    Function used to format the tooltip that appears when hovering over a data point in the chart.
         *    The scope object ('this') contains the x and y value of the corresponding point.
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
                    function(issues, job_result_url) {
                        this._downloadFileFromURL(job_result_url, 'pdf');

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
                    function(issues, job_result_url) {
                        this._downloadFileFromURL(job_result_url, 'eps');

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
         *      Triggers a download of the given resource.
         *
         * Parameters:
         *      {String} url - The URL to the file to be downloaded.
         *
         * Returns:
         *      This {<FaulttreeEditor>} instance for chaining.
         */
        _downloadFileFromURL: function(url, format) {
            //TODO: File is already downloaded in the _query method (job class), maybe first or second download should be prevented if possible.
            window.location = url;

            return this;
        }
    });
});
