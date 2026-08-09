const { PluginBase } = require('../../../../build/cjs/index.js');

/** Plugin that cannot even be constructed */
class FailingConstructorPlugin extends PluginBase {
    constructor(settings) {
        super(settings);
        throw new Error('constructor failed on purpose');
    }
}

module.exports = FailingConstructorPlugin;
