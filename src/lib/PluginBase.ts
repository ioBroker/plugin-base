import NamespaceLogger from './NamespaceLogger';
import type { InternalAdapterJsonConfig, IoPackageFile, PluginSettings } from '../types';
import type { Client as StatesInRedisClient } from '@iobroker/db-states-redis';
import type { Client as ObjectsInRedisClient } from '@iobroker/db-objects-redis';
/**
 * Base class for ioBroker Plugins
 */
export default class PluginBase {
    public pluginScope: 'adapter' | 'controller';
    /** The object namespace for the parent of the plugin, e.g. `system.adapter.<adaptername>.0`, or `system.host.<hostname>.` */
    public parentNamespace: string;
    /** The object namespace for the plugin, e.g. `system.adapter.<adaptername>.0.plugins.name`, or `system.host.<hostname>.plugins.name` */
    public pluginNamespace: string;
    /** The logger object to use for logging */
    public log: NamespaceLogger;
    /** The complete ioBroker configuration object */
    public iobrokerConfig: InternalAdapterJsonConfig;
    /** package.json of adapter */
    public parentPackage: Record<string, any>;
    public settings: PluginSettings;
    public objectsDb: ObjectsInRedisClient | null = null;
    public statesDb: StatesInRedisClient | null = null;
    public isActive: boolean = false;
    public SCOPES = {
        ADAPTER: 'adapter',
        CONTROLLER: 'controller',
    };
    public parentIoPackage?: IoPackageFile;

    /**
     * Constructor for Plugin class
     * This method is called by js-controller/adapter process internally when initializing the plugin.
     */
    constructor(settings: PluginSettings) {
        this.pluginScope = settings.pluginScope;
        this.parentNamespace = settings.parentNamespace;
        this.pluginNamespace = settings.pluginNamespace;
        this.log = new NamespaceLogger(settings.pluginLogNamespace, settings.log);
        this.iobrokerConfig = settings.iobrokerConfig;
        this.parentPackage = settings.parentPackage || {};
        this.settings = settings;
    }

    /**
     * Method for Plugin developer to initialize his Plugin
     *
     * @param _pluginConfig plugin configuration from config files
     * @returns resolves if init was successful else rejects
     */
    init(_pluginConfig: Record<string, any>): Promise<void> {
        // Implement in your Plugin instance if needed
        return Promise.reject(new Error('Not implemented'));
    }

    /**
     * Method which is called on a clean end of the process to potentially clean up the used resources
     *
     * @returns The return value indicates if the exit was successful. If no action needs to be taken, you should return true.
     */
    destroy(): Promise<boolean> {
        // Implement in your Plugin instance if needed
        return Promise.resolve(true);
    }

    /**
     * Get a State from State DB
     *
     * @param id id of the state to retrieve
     * @returns Promise with error or result
     */
    getState(id: string): Promise<void | ioBroker.State | null | undefined> {
        if (!this.statesDb) {
            return Promise.reject(new Error('States Database not initialized.'));
        }
        return this.statesDb.getStateAsync(id);
    }

    /**
     * Set a State in State DB
     *
     * @param id id of the state to set
     * @param state state value to set
     * @returns Promise with error or result
     */
    setState(id: string, state: ioBroker.SettableState): Promise<string> {
        if (!this.statesDb) {
            return Promise.reject(new Error('States Database not initialized.'));
        }
        return this.statesDb.setStateAsync(id, state);
    }

    /**
     * Get an Object from Objects DB
     *
     * @param id id of the object to retrieve
     * @returns Promise with result or error
     */
    getObject(id: string): Promise<ioBroker.Object | null | undefined> {
        if (!this.objectsDb) {
            return Promise.reject(new Error('Objects Database not initialized.'));
        }
        return this.objectsDb.getObjectAsync(id);
    }

    /**
     * Set an Object in Objects DB
     *
     * @param id id of the object to set
     * @param obj object to set
     * @returns Promise with error or result
     */
    setObject(id: string, obj: ioBroker.Object): Promise<{ id: string } | undefined> {
        if (!this.objectsDb) {
            return Promise.reject(new Error('Objects Database not initialized.'));
        }
        return this.objectsDb.setObjectAsync(id, obj);
    }

    /**
     * Set/Extend an Object in Objects DB
     *
     * @param id id of the object to set/extend
     * @param obj object to set
     * @returns Promise with result or error
     */
    extendObject(id: string, obj: object): Promise<{ id: string; value: ioBroker.Object } | undefined> {
        if (!this.objectsDb) {
            return Promise.reject(new Error('Objects Database not initialized.'));
        }
        return this.objectsDb.extendObjectAsync(id, obj);
    }

    /****************************************
     * Internal methods!!
     ****************************************/

    /**
     * @internal
     *
     * Set the Active flag for the plugin
     * @param active true/false if active
     */
    async setActive(active: boolean): Promise<void> {
        this.isActive = !!active;
        await this.setState(`${this.pluginNamespace}.enabled`, {
            val: !!active,
            ack: true,
            from: this.pluginNamespace,
        });
    }

    /**
     * @internal
     * Set the objects and states database to be used internally
     * This method is called by js-controller/adapter process internally when initializing the plugin.
     * @param objectsDb objects DB instance
     * @param statesDb states DB instance
     */
    setDatabase(objectsDb: ObjectsInRedisClient, statesDb: StatesInRedisClient): void {
        this.objectsDb = objectsDb;
        this.statesDb = statesDb;
    }

    /**
     * Initialize plugin, internal method
     *
     * @param pluginConfig plugin configuration from config files
     * @param parentConfig io-package from parent module where plugin is used in
     */
    async initPlugin(pluginConfig: Record<string, any>, parentConfig: IoPackageFile): Promise<void> {
        if (!pluginConfig) {
            throw new Error('No configuration for plugin');
        }
        this.parentIoPackage = parentConfig;

        let pluginEnabledState: ioBroker.State | null | undefined | void;
        try {
            await this.extendObject(this.pluginNamespace, {
                type: 'folder',
                common: {
                    name: 'Plugin States',
                },
                native: {},
            });
            await this.extendObject(`${this.pluginNamespace}.enabled`, {
                type: 'state',
                common: {
                    name: 'Plugin - enabled',
                    type: 'boolean',
                    read: true,
                    write: true,
                    role: 'value',
                },
                native: {},
            });

            pluginEnabledState = await this.getState(`${this.pluginNamespace}.enabled`);
        } catch {
            // ignore
        }
        if (pluginEnabledState && typeof pluginEnabledState.val !== 'object' && pluginEnabledState.val !== undefined) {
            // We already have an enabled flag state, use it
            await this.#initialize(pluginConfig, !!pluginEnabledState.val);
            return;
        }

        // We have first start and no enabled flag is set
        if (this.pluginScope === this.SCOPES.ADAPTER && parentConfig?.common?.host) {
            // We check if the host has a sentry enabled flag
            const hostNamespace = this.pluginNamespace.replace(
                new RegExp(`system\\.adapter\\.${parentConfig.common.name}\\.\\d+\\.`),
                `system.host.${parentConfig.common.host}.`,
            );

            let hostState: ioBroker.State | null | undefined | void;
            try {
                hostState = await this.getState(`${hostNamespace}.enabled`);
            } catch {
                // ignore
            }
            if (hostState && typeof hostState.val !== 'object' && hostState.val !== undefined) {
                // We simply use the host enabled flag state
                await this.#initialize(pluginConfig, !!hostState.val);
                return;
            }
        }

        await this.#initialize(pluginConfig, pluginConfig.enabled === undefined ? true : !!pluginConfig.enabled);
    }

    /**
     * @internal
     */
    async #initialize(pluginConfig: Record<string, any>, activate: string | boolean): Promise<void> {
        if (activate) {
            this.log.debug(`Initialize Plugin (enabled=${activate})`);
            pluginConfig.enabled = activate;
            try {
                await this.init(pluginConfig);
                await this.setActive(true);
            } catch (err) {
                this.log.error(`Failed to initialize plugin: ${err instanceof Error ? err.message : String(err)}`);
                await this.setActive(false);
            }
        } else {
            this.log.debug(`Do not initialize Plugin (enabled=${activate})`);
            await this.setActive(false);
        }
    }
}
