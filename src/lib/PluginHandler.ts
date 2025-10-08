import type { IoPackageFile, PluginHandlerSettings, PluginSettings } from '../types';
import NamespaceLogger from './NamespaceLogger';
import type PluginBase from './PluginBase';
import type { Client as StatesInRedisClient } from '@iobroker/db-states-redis';
import type { Client as ObjectsInRedisClient } from '@iobroker/db-objects-redis';

type PluginInstance = PluginBase | null;

interface PluginEntry {
    config: Record<string, any>;
    instance?: PluginInstance;
}

/** Base handler for ioBroker Plugins */
export default class PluginHandler {
    #settings: PluginHandlerSettings;
    #log: NamespaceLogger;
    #plugins: Record<string, PluginEntry> = {};

    constructor(settings: PluginHandlerSettings) {
        this.#settings = settings;
        this.#log = new NamespaceLogger(this.#settings.logNamespace, settings.log);
    }

    /**
     * Add plugins to the handler, resolve and require the plugin code and create instance
     *
     * @param configs object with keys for plugin names and their configuration
     * @param resolveDirs Resolve directories for plugins. Controller directory in 'controller' context or adapter directory and controller directory in 'adapter' context
     */
    addPlugins(
        configs: { [pluginName: string]: Record<string, any> } = {},
        resolveDirs: string | [adapterDir: string, jsControllerDir: string],
    ): void {
        if (!configs) {
            return;
        }
        Object.keys(configs).forEach(plugin => {
            this.instantiatePlugin(plugin, configs[plugin], resolveDirs);
        });
    }

    /**
     * Resolve, Require and instantiate Plugins
     *
     * @param name name of the plugin
     * @param config plugin configuration
     * @param resolveDirsOrDir Resolve directories
     */
    instantiatePlugin(name: string, config: Record<string, any>, resolveDirsOrDir: string | string[]): void {
        if (this.#plugins[name]?.instance) {
            this.#log.info(`Ignore duplicate plugin ${name}`);
            return;
        }

        const resolveDirs = typeof resolveDirsOrDir === 'string' ? [resolveDirsOrDir] : resolveDirsOrDir;

        let pluginPath: string;
        try {
            pluginPath = require.resolve(`@iobroker/plugin-${name}`, {
                paths: resolveDirs,
            });
        } catch {
            this.#log.error(`Plugin ${name} could not be resolved`);
            return;
        }
        if (!pluginPath) {
            this.#log.error(`Plugin ${name} could not be resolved`);
            return;
        }

        let ResolvedPlugin: typeof PluginBase;
        try {
            ResolvedPlugin = require(pluginPath);
            // @ts-expect-error Some plugins export like this
            if (ResolvedPlugin.default) {
                // @ts-expect-error Some plugins export like this
                ResolvedPlugin = ResolvedPlugin.default;
            }
        } catch (e: unknown) {
            this.#log.error(`Plugin ${name} could not be required: ${(e as Error).message}`);
            return;
        }

        const pluginSettings: PluginSettings = {
            pluginScope: this.#settings.scope,
            parentNamespace: this.#settings.namespace,
            pluginNamespace: `${this.#settings.namespace}.plugins.${name}`,
            pluginLogNamespace: `${this.#settings.logNamespace} Plugin ${name}`,
            log: this.#settings.log,
            iobrokerConfig: this.#settings.iobrokerConfig,
            parentPackage: this.#settings.parentPackage, // package.json from "parent" which uses the plugin (adapter/controller)
            controllerVersion: this.#settings.controllerVersion,
            adapterDir: resolveDirs.length > 1 ? resolveDirs[0] : undefined,
            jsControllerDir: resolveDirs.length > 1 ? resolveDirs[1] : resolveDirs[0],
        };

        this.#plugins[name] = {
            config,
        };

        try {
            this.#plugins[name].instance = new ResolvedPlugin(pluginSettings);
        } catch (e: unknown) {
            this.#log.error(`Plugin ${name} could not be initialized: ${(e as Error).message}`);
            this.#plugins[name].instance = null;
        }
    }

    /**
     * Set Objects and States databases for all isActive plugins
     *
     * @param name name of the plugin
     * @param objectsDb objects DB instance
     * @param statesDb states DB instance
     */
    setDatabaseForPlugin(name: string, objectsDb: ObjectsInRedisClient, statesDb: StatesInRedisClient): void {
        const plugin = this.#plugins[name];
        if (plugin?.instance) {
            plugin.instance.setDatabase(objectsDb, statesDb);
        }
    }

    /**
     * Set Objects and States databases for all isActive plugins
     *
     * @param objectsDb objects DB instance
     * @param statesDb states DB instance
     */
    setDatabaseForPlugins(objectsDb: ObjectsInRedisClient, statesDb: StatesInRedisClient): void {
        Object.keys(this.#plugins).forEach(plugin => this.setDatabaseForPlugin(plugin, objectsDb, statesDb));
    }

    /**
     * Initialize one Plugin
     *
     * @param name name of the plugin
     * @param parentConfig io-package of the parent module that uses the plugins (adapter/controller)
     */
    async initPlugin(name: string, parentConfig: IoPackageFile): Promise<void> {
        const instance = this.#plugins[name]?.instance;
        if (!instance) {
            throw new Error('Please instantiate plugin first!');
        }

        try {
            await instance.initPlugin(this.#plugins[name].config, parentConfig);
        } catch (err) {
            this.#log.warn(
                `Plugin ${name} destroyed because not initialized correctly: ${err instanceof Error ? err.message : String(err)}`,
            );
            if (err instanceof Error && err.stack) {
                this.#log.debug(err.stack);
            }
            try {
                await instance.destroy();
            } catch (err) {
                this.#log.warn(`Cannot destroy plugin ${name}: ${err instanceof Error ? err.message : String(err)}`);
                if (err instanceof Error && err.stack) {
                    this.#log.warn(err.stack);
                }
            }
            delete this.#plugins[name].instance;
        }
    }

    /**
     * Initialize all Plugins that are registered
     *
     * @param parentConfig io-package of the parent module that uses the plugins (adapter/controller)
     */
    async initPlugins(parentConfig: IoPackageFile): Promise<void> {
        for (const [pluginName, plugin] of Object.entries(this.#plugins)) {
            if (!plugin.instance) {
                continue;
            }
            await this.initPlugin(pluginName, parentConfig);
        }
    }

    /**
     * Destroy one plugin instance
     *
     * @param name name of the plugin to destroy
     * @param force true to consider plugin as destroyed also if false is returned from plugin
     */
    async destroy(name: string, force?: boolean): Promise<boolean> {
        const instance = this.#plugins[name]?.instance;
        if (instance) {
            let destroyed = false;
            try {
                destroyed = await instance.destroy();
            } catch (err: unknown) {
                this.#log.warn(`Plugin ${name} could not be destroyed: ${(err as Error).message}`);
                if (err instanceof Error && err.stack) {
                    this.#log.warn(err.stack);
                }
            }
            if (destroyed || force) {
                this.#log.debug(`Plugin ${name} destroyed`);
                if (!force) {
                    await instance.setActive(false);
                }
                delete this.#plugins[name].instance;
                return true;
            }
            this.#log.warn(`Plugin ${name} could not be destroyed`);
            return false;
        }
        return true;
    }

    /** Destroy all plugin instances */
    async destroyAll(): Promise<void> {
        const names = Object.keys(this.#plugins);
        for (const pluginName of names) {
            try {
                await this.destroy(pluginName, true);
            } catch (err) {
                this.#log.warn(`Plugin "${pluginName}" could not be destroyed: ${(err as Error).message}`);
            }
        }
    }

    /**
     * Return plugin instance
     *
     * @param name name of the plugin to return
     * @returns plugin instance or null if not existent or not isActive
     */
    getPluginInstance(name: string): PluginInstance {
        const plugin = this.#plugins[name];
        if (!plugin?.instance) {
            return null;
        }
        return plugin.instance;
    }

    /**
     * Return plugin configuration
     *
     * @param name name of the plugin to return
     * @returns plugin configuration or null if not existent or not isActive
     */
    getPluginConfig(name: string): Record<string, any> | null {
        const plugin = this.#plugins[name];
        if (!plugin?.config) {
            return null;
        }
        return plugin.config;
    }

    /**
     * Return if plugin exists
     *
     * @param name name of the plugin to check
     * @returns true/false if plugin was configured somewhere
     */
    pluginExists(name: string): boolean {
        return !!this.#plugins[name];
    }

    /**
     * Return if plugin is isActive
     *
     * @param name name of the plugin to check
     * @returns true/false if plugin is successfully isActive
     */
    isPluginInstantiated(name: string): boolean {
        return !!this.#plugins[name]?.instance;
    }

    /**
     * Return if plugin is active
     *
     * @param name name of the plugin to check
     * @returns true/false if plugin is successfully isActive
     */
    isPluginActive(name: string): boolean {
        return !!this.#plugins[name]?.instance?.isActive;
    }
}
