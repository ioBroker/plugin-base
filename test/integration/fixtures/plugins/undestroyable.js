const { PluginBase } = require('../../../../build/cjs/index.js');

/** Plugin that refuses to be destroyed unless it is forced */
class UndestroyablePlugin extends PluginBase {
    destroyCalls = 0;

    async init() {
        // nothing to do
    }

    async destroy() {
        this.destroyCalls++;
        return false;
    }
}

module.exports = UndestroyablePlugin;
