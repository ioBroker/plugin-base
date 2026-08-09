import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { PluginBase } from '../../build/cjs/index.js';
import { installPluginFixtures, type PluginFixtures } from './lib/pluginFixtures.js';
import { TestDatabase } from './lib/testDatabase.js';
import type { TestLogger } from './lib/testLogger.js';
import { createIoPackage, createTestHandler } from './lib/testHandler.js';

const PLUGIN_NAMESPACE = 'system.adapter.test.0.plugins.simple';

/** The fixture plugins record what happened to them on the instance itself */
interface RecordingPlugin extends PluginBase {
    initCalls?: Record<string, any>[];
}

let fixtures: PluginFixtures;

/**
 * Bring a plugin up through the handler, which is the only way it ever gets initialized in production
 *
 * @param config plugin configuration
 * @param options overrides for the test setup
 * @param options.db database to use instead of an empty one
 * @param options.scope scope the handler runs in
 * @param options.ioPackage io-package of the parent that is passed to the plugin
 */
async function initPlugin(
    config: Record<string, any>,
    options: {
        db?: TestDatabase;
        scope?: 'adapter' | 'controller';
        ioPackage?: ReturnType<typeof createIoPackage>;
    } = {},
): Promise<{ instance: RecordingPlugin; db: TestDatabase; log: TestLogger; active: boolean }> {
    const context = createTestHandler({ scope: options.scope ?? 'adapter' });
    const db = options.db ?? context.db;

    context.handler.addPlugins({ simple: config }, fixtures.dir);
    context.handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);
    const instance = context.handler.getPluginInstance('simple') as RecordingPlugin;

    await context.handler.initPlugins(options.ioPackage ?? createIoPackage());

    return { instance, db, log: context.log, active: context.handler.isPluginActive('simple') };
}

describe('PluginBase', () => {
    before(() => {
        fixtures = installPluginFixtures({ simple: 'simple.js', failinginit: 'failingInit.js' });
    });

    after(() => fixtures.cleanup());

    describe('initialization', () => {
        it('creates the folder and the enabled state and activates the plugin', async () => {
            const { instance, db, active } = await initPlugin({});

            assert.equal(active, true);
            assert.equal(instance.isActive, true);

            const folder = db.objects.get(PLUGIN_NAMESPACE);
            assert.equal(folder?.type, 'folder');
            assert.equal(folder?.common.name, 'Plugin States');

            const state = db.objects.get(`${PLUGIN_NAMESPACE}.enabled`);
            assert.equal(state?.type, 'state');
            assert.deepEqual(state.common, {
                name: 'Plugin - enabled',
                type: 'boolean',
                read: true,
                write: true,
                role: 'value',
            });
        });

        it('writes the enabled state acknowledged and with the plugin as source', async () => {
            const { db } = await initPlugin({});

            assert.deepEqual(db.states.get(`${PLUGIN_NAMESPACE}.enabled`)?.val, true);
            assert.equal(db.states.get(`${PLUGIN_NAMESPACE}.enabled`)?.ack, true);
            assert.equal(db.states.get(`${PLUGIN_NAMESPACE}.enabled`)?.from, PLUGIN_NAMESPACE);
        });

        it('does not initialize a plugin that is disabled by configuration', async () => {
            const { instance, active, log } = await initPlugin({ enabled: false });

            assert.equal(active, false);
            assert.deepEqual(instance.initCalls, [], 'init() was never called');
            assert.ok(log.has('debug', 'Do not initialize Plugin (enabled=false)'));
        });

        it('prefers an existing enabled state over the configuration', async () => {
            const db = new TestDatabase();
            db.seedState(`${PLUGIN_NAMESPACE}.enabled`, false);

            const { active, instance } = await initPlugin({ enabled: true }, { db });

            assert.equal(active, false, 'the state from the database wins');
            assert.deepEqual(instance.initCalls, []);
        });

        it('falls back to the host enabled state in adapter scope', async () => {
            const db = new TestDatabase();
            db.seedState('system.host.testhost.plugins.simple.enabled', false);

            const { active, db: used } = await initPlugin({ enabled: true }, { db });

            assert.equal(active, false, 'the host state is used as long as the plugin has no own state');
            assert.ok(used.idsFor('getState').includes('system.host.testhost.plugins.simple.enabled'));
        });

        it('ignores the host enabled state in controller scope', async () => {
            const db = new TestDatabase();
            db.seedState('system.host.testhost.plugins.simple.enabled', false);

            const { active, db: used } = await initPlugin({}, { db, scope: 'controller' });

            assert.equal(active, true);
            assert.equal(used.idsFor('getState').includes('system.host.testhost.plugins.simple.enabled'), false);
        });

        it('does not look for a host state when the io-package has no host', async () => {
            const db = new TestDatabase();
            db.seedState('system.host.testhost.plugins.simple.enabled', false);

            const { active } = await initPlugin({}, { db, ioPackage: createIoPackage({ host: undefined }) });

            assert.equal(active, true);
        });

        it('deactivates the plugin when init() rejects', async () => {
            const context = createTestHandler();
            context.handler.addPlugins({ failinginit: {} }, fixtures.dir);
            context.handler.setDatabaseForPlugins(context.db.objectsDb, context.db.statesDb);

            await context.handler.initPlugins(createIoPackage());

            assert.equal(context.handler.isPluginActive('failinginit'), false);
            assert.equal(
                context.handler.isPluginInstantiated('failinginit'),
                true,
                'a failing init() does not remove the plugin',
            );
            assert.equal(
                context.db.states.get('system.adapter.test.0.plugins.failinginit.enabled')?.val,
                false,
                'the plugin is marked as disabled',
            );
            assert.ok(context.log.has('error', 'Failed to initialize plugin: init failed on purpose'));
        });

        it('destroys the plugin when it is initialized without database', async () => {
            const context = createTestHandler();
            context.handler.addPlugins({ simple: {} }, fixtures.dir);

            await context.handler.initPlugins(createIoPackage());

            assert.equal(context.handler.isPluginInstantiated('simple'), false);
            assert.ok(context.log.has('warn', 'States Database not initialized.'));
        });
    });

    describe('database access', () => {
        it('reads and writes states and objects', async () => {
            const { instance, db } = await initPlugin({});

            assert.equal(
                await instance.setState(`${PLUGIN_NAMESPACE}.value`, { val: 42, ack: true }),
                `${PLUGIN_NAMESPACE}.value`,
            );
            assert.equal((await instance.getState(`${PLUGIN_NAMESPACE}.value`))?.val, 42);
            assert.equal(await instance.getState('does.not.exist'), null);

            const object = {
                type: 'state',
                common: { name: 'Value', type: 'number', role: 'value', read: true, write: false },
                native: {},
            } as ioBroker.StateObject;
            assert.deepEqual(await instance.setObject(`${PLUGIN_NAMESPACE}.value`, object), {
                id: `${PLUGIN_NAMESPACE}.value`,
            });
            assert.equal((await instance.getObject(`${PLUGIN_NAMESPACE}.value`))?.common.name, 'Value');
            assert.equal(db.objects.get(`${PLUGIN_NAMESPACE}.value`)?._id, `${PLUGIN_NAMESPACE}.value`);
        });

        it('merges into an existing object on extendObject', async () => {
            const { instance } = await initPlugin({});

            await instance.extendObject(PLUGIN_NAMESPACE, { common: { desc: 'added later' } });

            const folder = await instance.getObject(PLUGIN_NAMESPACE);
            assert.equal(folder?.common.name, 'Plugin States', 'the existing property survives');
            assert.equal((folder?.common as Record<string, any>).desc, 'added later');
        });

        it('rejects every database access while no database is set', async () => {
            const { settings } = createTestHandler();
            const plugin = new PluginBase({
                pluginScope: settings.scope,
                parentNamespace: settings.namespace,
                pluginNamespace:
                    `${settings.namespace}.plugins.simple` as `system.adapter.${string}.${number}.plugins.${string}`,
                pluginLogNamespace: settings.logNamespace,
                log: settings.log,
                iobrokerConfig: settings.iobrokerConfig,
                parentPackage: settings.parentPackage,
                controllerVersion: settings.controllerVersion,
                jsControllerDir: '/js-controller/dir',
            });

            await assert.rejects(() => plugin.getState('any.id'), { message: 'States Database not initialized.' });
            await assert.rejects(() => plugin.setState('any.id', { val: 1 }), {
                message: 'States Database not initialized.',
            });
            await assert.rejects(() => plugin.getObject('any.id'), { message: 'Objects Database not initialized.' });
            await assert.rejects(() => plugin.setObject('any.id', {} as ioBroker.Object), {
                message: 'Objects Database not initialized.',
            });
            await assert.rejects(() => plugin.extendObject('any.id', {}), {
                message: 'Objects Database not initialized.',
            });
            await assert.rejects(() => plugin.init({}), { message: 'Not implemented' });
            assert.equal(await plugin.destroy(), true);
        });
    });

    describe('logging', () => {
        it('prefixes the plugin log with handler namespace and plugin name', async () => {
            const { log } = await initPlugin({});

            assert.ok(log.messages('info').includes('test.0 Plugin simple initialized'));
        });
    });
});
