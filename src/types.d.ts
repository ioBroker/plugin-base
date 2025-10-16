export interface IoPackageFile {
    common: ioBroker.InstanceCommon;
    protectedNative?: string[];
    encryptedNative?: string[];
    notifications?: ioBroker.Notification[];
    instanceObjects: (
        | ioBroker.StateObject
        | ioBroker.DeviceObject
        | ioBroker.ChannelObject
        | ioBroker.FolderObject
        | ioBroker.MetaObject
    )[];
    objects: ioBroker.AnyObject[];
}

/**
 * Contents of iobroker.json plus some internal variables
 */
export interface InternalAdapterJsonConfig extends ioBroker.IoBrokerJson {
    /** Is instance started with the `--install` flag */
    isInstall?: boolean;
    /** If logs must be printed to stdout */
    consoleOutput?: boolean;
    /** Start instance even if it disabled in config */
    forceIfDisabled?: boolean;
    /** Instance number */
    instance?: number;
}

export interface PluginHandlerSettings {
    /** The scope in which the plugin will be executed */
    scope: 'adapter' | 'controller';
    /** The object namespace for the plugin, e.g. `system.adapter.<adaptername>.0.plugins.name`, or `system.host.<hostname>.plugins.name` */
    namespace: `system.adapter.${string}.${number}` | `system.host.${string}`;
    /** The namespace which will be used for logging */
    logNamespace: `${`system.adapter.${string}.${number}` | `system.host.${string}`} Plugin ${string}`;
    /** The logger object to use for logging */
    log: ioBroker.Logger;
    /** The complete ioBroker configuration object */
    iobrokerConfig: InternalAdapterJsonConfig;
    /** The package.json contents from the "parent" (adapter/controller) which uses this plugin */
    parentPackage: Record<string, any>;
    /** The version of the installed JS-Controller */
    controllerVersion: string;
}

export interface PluginSettings {
    /** The scope in which the plugin will be executed */
    pluginScope: 'adapter' | 'controller';
    /** The object namespace for the parent of the plugin, e.g. `system.adapter.<adaptername>.0`, or `system.host.<hostname>.` */
    parentNamespace: `system.adapter.${string}.${number}` | `system.host.${string}`;
    /** The object namespace for the plugin, e.g. `system.adapter.<adaptername>.0.plugins.name`, or `system.host.<hostname>.plugins.name` */
    pluginNamespace: `system.adapter.${string}.${number}.plugins.${string}` | `system.host.${string}.plugins.${string}`;
    /** The namespace which will be used for logging */
    pluginLogNamespace: `${`system.adapter.${string}.${number}` | `system.host.${string}`} Plugin ${string}`;
    /** The logger object to use for logging */
    log: ioBroker.Logger;
    /** The complete ioBroker configuration object */
    iobrokerConfig: InternalAdapterJsonConfig;
    /** The package.json contents from the "parent" (adapter/controller) which uses this plugin */
    parentPackage: Record<string, any>;
    /** The version of the installed JS-Controller */
    controllerVersion: string;
    /** The directory of the adapter, only available if scope is "adapter" */
    adapterDir?: string;
    /** The directory of the js-controller */
    jsControllerDir: string;
}
