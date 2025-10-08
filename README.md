# @iobroker/plugin-base

Base package to build ioBroker plugins

This library provides the foundation for a lightweight plugin system in ioBroker. Plugins add specialized, optional functionality and can run either inside an adapter or inside the js-controller. Plugins are not full adapters and therefore intentionally offer a smaller, focused API and a mostly static configuration.

## Highlights

- Simple lifecycle: init and destroy
- Works in adapter and controller scope
- Namespaced logger with adapter/plugin prefix
- Small typed API to read/write objects and states
- Automatic handling of an "enabled" flag per plugin instance

## Getting started

- Publish plugins as `@iobroker/plugin-MySuperPlugin` (replace `MySuperPlugin` with your plugin name).
- Depend on this package and extend the `PluginBase` class.
- Export the plugin class as the module entry point of your package.
- Implement these methods:
    - constructor: pass settings to the parent via `super(settings)` (required)
    - `init(pluginConfig)`: initialize the plugin (required)
    - `destroy()`: clean up resources on shutdown; return `true` if successful (optional)
- Each plugin has an `enabled` flag that is respected by the base. If not set, plugins are enabled by default.
- Plugins can interact with objects and states in a limited, safe way via helper methods.

### TypeScript example

```ts
import { PluginBase } from '@iobroker/plugin-base';
import type { PluginSettings } from '@iobroker/plugin-base';

export default class MySuperPlugin extends PluginBase {
    constructor(settings: PluginSettings) {
        super(settings);
    }

    /**
     * Register and initialize the plugin
     * @param pluginConfig Plugin configuration from config files
     */
    async init(pluginConfig: Record<string, any>): Promise<void> {
        if (!pluginConfig.enabled) {
            this.log.info('MySuperPlugin disabled by user');
            return;
        }

        // initialize your code here
        this.log.info('MySuperPlugin initialized');
    }

    /**
     * Called on a clean shutdown to clean up used resources
     * Return true if no further action is required
     */
    async destroy(): Promise<boolean> {
        // Implement cleanup if needed
        return true;
    }
}
```

### CommonJS example

```javascript
const { PluginBase } = require('@iobroker/plugin-base');

class MySuperPlugin extends PluginBase {
    constructor(settings) {
        super(settings);
    }

    /**
     * Register and initialize Plugin
     * @param pluginConfig {object} plugin configuration from config files
     */
    async init(pluginConfig) {
        if (!pluginConfig.enabled) {
            this.log.info('MySuperPlugin disabled by user');
            return;
        }

        // initialize your code here
        this.log.info('MySuperPlugin initialized');
    }

    /**
     * Method which is called on a clean end of the process to potentially clean up used resources
     */
    async destroy() {
        // Implement in your Plugin instance if needed
        return true;
    }
}

module.exports = MySuperPlugin;
```

## Public API (selected)

Within your plugin, the following properties and methods are available:

- `this.log`: ioBroker-style logger with methods `silly`, `debug`, `info`, `warn`, `error`. Messages are automatically prefixed with adapter and plugin identifiers.
- `this.pluginScope`: the scope the plugin runs in (`this.SCOPES.ADAPTER` or `this.SCOPES.CONTROLLER`).
- `this.pluginNamespace`: the state/object namespace of the plugin instance, e.g., `system.adapter.<ADAPTER_NAME>.<INSTANCE>.plugins.MySuperPlugin` or `system.host.<HOSTNAME>.plugins.MySuperPlugin`. New objects should stay inside this namespace.
- `this.iobrokerConfig`: the full ioBroker config object (i.e., contents of `iobroker-data/iobroker.json`).
- `this.parentPackage`: the `package.json` of the adapter or controller the plugin runs in.
- `this.parentIoPackage`: the `io-package.json` when running in js-controller or the instance configuration when running in an adapter.

Helper methods to interact with DBs:

- `getState(id)` / `setState(id, state)`
- `getObject(id)` / `setObject(id, obj)` / `extendObject(id, obj)`

## Configuration

Plugins are configured in `io-package.json` under `common` or in `iobroker-data/iobroker.json` at the top level in a `plugins` key:

```json5
{
    // ...
    "common": {
        // ...
        "plugins": {
            "MySuperPlugin": {
                "enabled": true,
                "key": "value",
                // ...
            },
        },
        // ...
    },
    // ...
}
```

The configuration is passed to the `init` method. The `enabled` key can also be provided as a boolean and acts as the default value. If `enabled` is not included, the plugin will be activated by default.

## Examples

A full example is the Sentry plugin: https://github.com/ioBroker/plugin-sentry or the Docker plugin: https://github.com/ioBroker/plugin-docker

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->
### 3.0.1 (2025-10-08)

- (@GermanBluefox) The code was rewritten to TypeScript

### 2.0.1 (2024-05-27)

**Breaking Changes:**

- (foxriver76) Methods no longer work with callback, please check the methods according to the types.
- (foxriver76) All methods with `async` postfix are now working renamed to methods without the postfix
  while the callback methods have been removed
- (foxriver76) Renamed `instanciatePlugin` to `instantiatePlugin`
- (foxriver76) renamed `isPluginInstanciated` to `isPluginInstantiated`

### 1.2.1 (2021-01-24)

- (Apollon77) Add error handling in some places when setting active Status

### 1.2.0 (2020-05-09)

- (Apollon77) Add async methods for Objects and States
- (Apollon77) rework enable detection for plugins

### 1.1.1 (2020-05-01)

- (Apollon77) fix for host lookup to work for all plugins

### 1.1.0 (2020-05-01)

- (Apollon77) Check host sentry plugin status when no adapter flag exists to allow users to turn it of more easy

### 1.0.0 (2020-04-26)

- (Apollon77) Declare as 1.0.0 for release of js-controller 3.0

### 0.1.1 (2020-03-29)

- (AlCalzone) add type support and optimizations

### 0.1.0 (2020-03-28)

- (Apollon77) initial release to npm
