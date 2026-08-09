import { PluginHandler } from '../../../build/cjs/index.js';
import type { InternalAdapterJsonConfig, IoPackageFile, PluginHandlerSettings } from '../../../build/cjs/index.js';
import { TestDatabase } from './testDatabase.js';
import { TestLogger } from './testLogger.js';

export interface TestHandlerOptions {
    scope?: PluginHandlerSettings['scope'];
    namespace?: PluginHandlerSettings['namespace'];
    logNamespace?: string;
}

export interface TestHandler {
    handler: PluginHandler;
    db: TestDatabase;
    log: TestLogger;
    settings: PluginHandlerSettings;
}

/**
 * Create a PluginHandler with recording logger and in-memory databases
 *
 * @param options overrides for the handler settings
 */
export function createTestHandler(options: TestHandlerOptions = {}): TestHandler {
    const db = new TestDatabase();
    const log = new TestLogger();
    const settings: PluginHandlerSettings = {
        scope: options.scope ?? 'adapter',
        namespace: options.namespace ?? 'system.adapter.test.0',
        logNamespace: options.logNamespace ?? 'test.0',
        log: log.logger,
        iobrokerConfig: {} as InternalAdapterJsonConfig,
        parentPackage: { name: 'iobroker.test', version: '1.2.3' },
        controllerVersion: '7.2.2',
    };

    return { handler: new PluginHandler(settings), db, log, settings };
}

/**
 * Create the io-package contents the parent adapter would pass in
 *
 * @param common overrides for the `common` section
 */
export function createIoPackage(common: Partial<ioBroker.InstanceCommon> = {}): IoPackageFile {
    return {
        common: { name: 'test', host: 'testhost', ...common } as ioBroker.InstanceCommon,
    };
}
