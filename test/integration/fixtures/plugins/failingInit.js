const { PluginBase } = require('../../../../build/cjs/index.js');

/** Plugin whose `init()` rejects, which must deactivate but not remove the plugin */
class FailingInitPlugin extends PluginBase {
    async init() {
        throw new Error('init failed on purpose');
    }
}

module.exports = FailingInitPlugin;
