define(['config'], function(Config) {
    /**
     *  Package Faulttree
     */

    /**
     *  Structure: FaulttreeConfig
     *    Faulttree-specific config.
     *
     *  Extends: <Base::Config>
     */
    return jQuery.extend(true, Config, {
        /**
         *  Group: Events
         *    Name of global events triggered on the document with jQuery.trigger().
         *
         *  Constants:
         *    {String} EDITOR_CALCULATE_CUTSETS - Event triggered when he 'calculate cutsets' action has been chosen.
         */
        Events: {
            EDITOR_CALCULATE_CUTSETS: 'editor-calculate-cutsets'
        },

        /**
         *  Group: IDs
         *    IDs of certain DOM-elements.
         *
         *  Constants:
         *    {String} CUTSETS_MENU          - The container element of the cutsets menu.
         *    {String} NAVBAR_ACTION_CUTSETS - The navbar actions button for cutsets calculation.
         */
        IDs: {
            CUTSETS_MENU:          'FuzzEdCutsets',
            NAVBAR_ACTION_CUTSETS: 'FuzzEdNavbarActionCutsets'
        }
    });
});
