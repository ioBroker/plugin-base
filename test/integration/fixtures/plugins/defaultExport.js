const { PluginBase } = require('../../../../build/cjs/index.js');

/** Plugin that is exported as `default` property, as transpiled plugins do */
class DefaultExportPlugin extends PluginBase {
    async init() {
        // nothing to do
    }
}

module.exports = { default: DefaultExportPlugin };
