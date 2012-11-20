define(function() {
    var GRID_SIZE         = 53;
    
    var STROKE_COLOR      = '#000';
    var HIGHLIGHTED_COLOR = '#409FFF';
    var SELECTED_COLOR    = '#FF9640';
    var DISABLED_COLOR    = '#CCC';

    return {
        Attributes: {
            HEADER: 'header'
        },

        Backend: {
            BASE_URL:       '/api',
            GRAPHS_URL:     '/graphs',
            NODES_URL:      '/nodes',
            EDGES_URL:      '/edges',
            CUTSETS_URL:    '/cutsets'
        },

        Classes: {
            JSPLUMB_ENDPOINT:        'jsplumb-endpoint',
            JSPLUMB_ENDPOINT_HOVER:  'jsplumb-endpoint-hover',
            JSPLUMB_CONNECTOR:       '_jsPlumb_connector',

            MENU_CONTROLS:           'menu-controls',
            MENU_CLOSE:              'menu-close',
            MENU_MINIMIZE:           'menu-minimize',

            MIRROR:                  'fuzzed-mirror',
            MIRROR_BOLD:             'fuzzed-mirror-bold',
            MIRROR_ITALIC:           'fuzzed-mirror-italic',
            MIRROR_LARGE:            'fuzzed-mirror-large',

            NODE:                    'fuzzed-node',
            NODE_SELECTED:           'fuzzed-node-selected',
            NODE_IMAGE:              'fuzzed-node-image',
            NODE_DROP_ACTIVE:        'fuzzed-node-drop-active',
            NODE_HALO_CONNECT:       'fuzzed-node-halo-connect',
            NODE_OPTIONAL_INDICATOR: 'fuzzed-node-optional-indicator'
        },

        Dragging: {
            OPACITY:        0.5,
            CURSOR:         'move',
            SNAP_TOLERANCE: 0
        },

        Events: {
            CANVAS_SHAPE_DROPPED:     'canvas-shape-dropped',

            NODE_PROPERTY_CHANGED:    'node-property-changed',

            GRAPH_NODE_ADDED:         'graph-node-added',
            GRAPH_NODE_DELETED:       'graph-node-deleted',
            GRAPH_EDGE_ADDED:         'graph-edge-added',
            GRAPH_EDGE_DELETED:       'graph-edge-deleted',

            EDITOR_CALCULATE_CUTSETS: 'editor-calculate-cutsets'
        },

        Grid: {
            SIZE:         GRID_SIZE,
            HALF_SIZE:    GRID_SIZE >> 1,
            DOUBLE_SIZE:  GRID_SIZE << 1,
            STROKE:       DISABLED_COLOR,
            STROKE_WIDTH: 1,
            STROKE_STYLE: '7 3' // svg dash-array value
        },

        IDs: {
            CANVAS:                'FuzzEdCanvas',
            CONTENT:               'FuzzEdContent',
            PROPERTIES_MENU:       'FuzzEdProperties',
            SHAPES_MENU:           'FuzzEdShapes',
            CUTSETS_MENU:          'FuzzEdCutsets',
            SPLASH:                'FuzzEdSplash',
            NAVBAR_ACTIONS:        'FuzzEdNavbarActions',
            NAVBAR_ACTION_CUTSETS: 'FuzzEdNavbarActionCutsets'
        },

        JSPlumb: {
            STROKE:             STROKE_COLOR,
            STROKE_HIGHLIGHTED: HIGHLIGHTED_COLOR,
            STROKE_SELECTED:    SELECTED_COLOR,
            STROKE_DISABLED:    DISABLED_COLOR,
            STROKE_WIDTH:       2,

            CONNECTOR_STYLE:    'Flowchart',
            CONNECTOR_STUB:     10, // min. distance in px before connector bends

            ENDPOINT_RADIUS:    7,
            ENDPOINT_FILL:      HIGHLIGHTED_COLOR,
            ENDPOINT_STYLE:     'Blank'
        },

        Keys: {
            CONSTRUCTOR: 'constructor',
            NODE:        'node'
        },

        Menus: {
            ANIMATION_DURATION:     200,
            PROPERTIES_MENU_OFFSET: 20
        },

        Node: {
            STROKE_NORMAL:             STROKE_COLOR,
            STROKE_HIGHLIGHTED:        HIGHLIGHTED_COLOR,
            STROKE_SELECTED:           SELECTED_COLOR,
            STROKE_DISABLED:           DISABLED_COLOR,

            OPTIONAL_INDICATOR_FILL:   '#FFF',
            OPTIONAL_INDICATOR_RADIUS: Math.round(GRID_SIZE / 10)
        },

        Properties: {
            Events: [
                'blur',
                'change',
                'click',
                'focus',
                'keydown',
                'keyup',
                'select'
            ]
        },

        Splash: {
            FADE_TIME: 1000
        }
    };
});