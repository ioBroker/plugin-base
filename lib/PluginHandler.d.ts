/// <reference path="types.d.ts" />
export = PluginHandler;
/**
 * Base handler for ioBroker Plugins
 */
declare class PluginHandler {
    /**
     * Constructor for PluginHandler
     *
     * @param {import("@iobroker/plugin-base/types").PluginHandlerSettings} settings
     */
    constructor(settings: import("@iobroker/plugin-base/types").PluginHandlerSettings);
    settings: import("@iobroker/plugin-base/types").PluginHandlerSettings;
    log: NamespaceLogger;
    /** @type {Record<string, {config: Record<string, any>, instance?: import("./PluginBase") | null}>} */
    plugins: Record<string, {
        config: Record<string, any>;
        instance?: import("./PluginBase") | null;
    }>;
    /**
     * Add plugins to the handler, resolve and require the plugin code and create instance
     *
     * @param {Record<string, any>} configs object with keys for plugin names and their configuration
     * @param {string | string[]} resolveDirs Resolve directories for plugins
     */
    addPlugins(configs: Record<string, any>, resolveDirs: string | string[]): void;
    /**
     * Resole, Require and instantiate Plugins
     *
     * @param {string} name name of the plugin
     * @param {Record<string, any>} config plugin configuration
     * @param {string | string[]} resolveDirsOrDir Resolve directories
     */
    instantiatePlugin(name: string, config: Record<string, any>, resolveDirsOrDir: string | string[]): void;
    /**
     * Set Objects and States databases for all isActive plugins
     *
     * @param {string} name name of the plugin
     * @param {any} objectsDb objects DB instance
     * @param {any} statesDb states DB instance
     */
    setDatabaseForPlugin(name: string, objectsDb: any, statesDb: any): void;
    /**
     * Set Objects and States databases for all isActive plugins
     *
     * @param {any} objectsDb objects DB instance
     * @param {any} statesDb states DB instance
     */
    setDatabaseForPlugins(objectsDb: any, statesDb: any): void;
    /**
     * Initialize one Plugins
     *
     * @param {string} name name of the plugin
     * @param {Record<string, any>} parentConfig io-package of the parent module that uses the plugins (adapter/controller)
     */
    initPlugin(name: string, parentConfig: Record<string, any>): Promise<void>;
    /**
     * Initialize all Plugins that are registered
     *
     * @param {Record<string, any>} parentConfig io-package of the parent module that uses the plugins (adapter/controller)
     */
    initPlugins(parentConfig: Record<string, any>): Promise<void>;
    /**
     * Destroy one plugin instance
     *
     * @param {string} name name of the plugin to destroy
     * @param {boolean} [force] true to consider plugin as destroyed also if false is returned from plugin
     */
    destroy(name: string, force?: boolean): boolean;
    /**
     * Destroy all plugin instances
     */
    destroyAll(): void;
    /**
     * Return plugin instance
     *
     * @param {string} name name of the plugin to return
     * @returns {import("./PluginBase") | null} plugin instance or null if not existent or not isActive
     */
    getPluginInstance(name: string): import("./PluginBase") | null;
    /**
     * Return plugin configuration
     *
     * @param {string} name name of the plugin to return
     * @returns {Record<string, any> | null} plugin configuration or null if not existent or not isActive
     */
    getPluginConfig(name: string): Record<string, any> | null;
    /**
     * Return if plugin exists
     *
     * @param {string} name name of the plugin to check
     * @returns {boolean} true/false if plugin was configured somewhere
     */
    pluginExists(name: string): boolean;
    /**
     * Return if plugin is isActive
     *
     * @param {string} name name of the plugin to check
     * @returns {boolean} true/false if plugin is successfully isActive
     */
    isPluginInstantiated(name: string): boolean;
    /**
     * Return if plugin is active
     *
     * @param {string} name name of the plugin to check
     * @returns {boolean} true/false if plugin is successfully isActive
     */
    isPluginActive(name: string): boolean;
}
import NamespaceLogger = require("./NamespaceLogger");
