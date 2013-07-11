define(['faulttree/config', 'jquery'], function(FaulttreeConfig) {
    /**
     *  Package Fuzztree
     */

    /**
     *  Structure: FuzztreeConfig
     *    Fuzztree-specific config.
     *
     *  Extends: <Faulttree::FaulttreeConfig>
     */
    return jQuery.extend(true, FaulttreeConfig, {
        /**
         *  Group: Classes
         *    Names of certain CSS classes.
         *
         *  Constants:
         *    {String} NODE_OPTIONAL           - Class assigned to optional nodes.
         *    {String} NODE_OPTIONAL_INDICATOR - Class of the optional indicator above a node's image.
         */
        Classes: {
            NODE_OPTIONAL:           'fuzzed-node-optional',
            NODE_OPTIONAL_INDICATOR: 'fuzzed-node-optional-indicator'
        },

        /**
         *  Group: Node
         *    Configuration of node (visual) properties.
         *
         *  Constants:
         *    {String} OPTIONAL_STROKE-STYLE - SVG dash-array value that optional nodes receive
         */
        Node: {
            OPTIONAL_STROKE_STYLE: '4.8 2' // svg dash-array value
        }
    });
});
