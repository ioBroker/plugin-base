const { PluginBase } = require('../../../../build/cjs/index.js');

/** Plugin that initializes successfully and records how it was called */
class SimplePlugin extends PluginBase {
    initCalls = [];
    destroyCalls = 0;

    async init(pluginConfig) {
        this.initCalls.push(pluginConfig);
        this.log.info('initialized');
    }

    async destroy() {
        this.destroyCalls++;
        return true;
    }
}

module.exports = SimplePlugin;
