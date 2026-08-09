import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { PluginBase } from '../../build/cjs/index.js';
import { installPluginFixtures, type PluginFixtures } from './lib/pluginFixtures.js';
import { createIoPackage, createTestHandler } from './lib/testHandler.js';

/** The fixture plugins record what happened to them on the instance itself */
interface RecordingPlugin extends PluginBase {
    initCalls?: Record<string, any>[];
    destroyCalls?: number;
}

describe('PluginHandler', () => {
    let fixtures: PluginFixtures;

    before(() => {
        fixtures = installPluginFixtures({
            simple: 'simple.js',
            noconfig: 'simple.js',
            second: 'simple.js',
            defaultexport: 'defaultExport.js',
            failinginit: 'failingInit.js',
            failingconstructor: 'failingConstructor.js',
            undestroyable: 'undestroyable.js',
            throwing: 'throwingModule.js',
        });
    });

    after(() => fixtures.cleanup());

    it('resolves, requires and instantiates a plugin from disk', () => {
        const { handler } = createTestHandler();

        handler.addPlugins({ simple: { custom: 'value' } }, fixtures.dir);

        assert.equal(handler.pluginExists('simple'), true);
        assert.equal(handler.isPluginInstantiated('simple'), true);
        assert.equal(handler.isPluginActive('simple'), false, 'plugin is not active before it was initialized');
        assert.deepEqual(handler.getPluginConfig('simple'), { custom: 'value' });
        assert.ok(handler.getPluginInstance('simple') instanceof PluginBase);
    });

    it('derives the plugin settings from the handler settings', () => {
        const { handler, settings } = createTestHandler({
            scope: 'controller',
            namespace: 'system.host.testhost',
        });

        // the plugin is only installed below the first directory, the second one stays unused
        handler.addPlugins({ simple: {} }, [fixtures.dir, '/js-controller/dir']);

        const instance = handler.getPluginInstance('simple')!;
        assert.equal(instance.pluginScope, settings.scope);
        assert.equal(instance.parentNamespace, 'system.host.testhost');
        assert.equal(instance.pluginNamespace, 'system.host.testhost.plugins.simple');
        assert.equal(instance.settings.adapterDir, fixtures.dir);
        assert.equal(instance.settings.jsControllerDir, '/js-controller/dir');
        assert.equal(instance.settings.controllerVersion, '7.2.2');
        assert.deepEqual(instance.parentPackage, { name: 'iobroker.test', version: '1.2.3' });
    });

    it('uses a single resolve directory as js-controller directory', () => {
        const { handler } = createTestHandler();

        handler.addPlugins({ simple: {} }, fixtures.dir);

        const instance = handler.getPluginInstance('simple')!;
        assert.equal(instance.settings.adapterDir, undefined);
        assert.equal(instance.settings.jsControllerDir, fixtures.dir);
    });

    it('accepts plugins that are exported as default property', () => {
        const { handler } = createTestHandler();

        handler.addPlugins({ defaultexport: {} }, fixtures.dir);

        assert.equal(handler.isPluginInstantiated('defaultexport'), true);
    });

    it('registers several plugins at once', () => {
        const { handler } = createTestHandler();

        handler.addPlugins({ simple: {}, second: {} }, fixtures.dir);

        assert.equal(handler.isPluginInstantiated('simple'), true);
        assert.equal(handler.isPluginInstantiated('second'), true);
    });

    it('ignores a duplicate registration of the same plugin', () => {
        const { handler, log } = createTestHandler();

        handler.addPlugins({ simple: { first: true } }, fixtures.dir);
        handler.addPlugins({ simple: { second: true } }, fixtures.dir);

        assert.deepEqual(handler.getPluginConfig('simple'), { first: true }, 'the first config is kept');
        assert.ok(log.has('info', 'Ignore duplicate plugin simple'));
    });

    it('prefixes log messages with the configured log namespace', () => {
        const { handler, log } = createTestHandler({ logNamespace: 'my.namespace' });

        handler.addPlugins({ simple: {} }, fixtures.dir);
        handler.addPlugins({ simple: {} }, fixtures.dir);

        assert.ok(log.messages('info').includes('my.namespace Ignore duplicate plugin simple'));
    });

    it('logs an error when the plugin cannot be resolved', () => {
        const { handler, log } = createTestHandler();

        handler.addPlugins({ doesnotexist: {} }, fixtures.dir);

        assert.equal(handler.pluginExists('doesnotexist'), false);
        assert.ok(log.has('error', 'Plugin doesnotexist could not be resolved'));
    });

    it('logs an error when the plugin module throws while being required', () => {
        const { handler, log } = createTestHandler();

        handler.addPlugins({ throwing: {} }, fixtures.dir);

        assert.equal(handler.pluginExists('throwing'), false);
        assert.ok(log.has('error', 'Plugin throwing could not be required: this plugin cannot be required'));
    });

    it('keeps the plugin without instance when the constructor throws', () => {
        const { handler, log } = createTestHandler();

        handler.addPlugins({ failingconstructor: { some: 'config' } }, fixtures.dir);

        assert.equal(handler.pluginExists('failingconstructor'), true, 'the configuration is still known');
        assert.equal(handler.isPluginInstantiated('failingconstructor'), false);
        assert.equal(handler.getPluginInstance('failingconstructor'), null);
        assert.deepEqual(handler.getPluginConfig('failingconstructor'), { some: 'config' });
        assert.ok(
            log.has('error', 'Plugin failingconstructor could not be initialized: constructor failed on purpose'),
        );
    });

    it('returns null and no config for unknown plugins', () => {
        const { handler } = createTestHandler();

        assert.equal(handler.getPluginInstance('unknown'), null);
        assert.equal(handler.getPluginConfig('unknown'), null);
        assert.equal(handler.pluginExists('unknown'), false);
        assert.equal(handler.isPluginActive('unknown'), false);
    });

    it('runs the complete lifecycle of a plugin', async () => {
        const { handler, db } = createTestHandler();

        handler.addPlugins({ simple: { custom: 'value' } }, fixtures.dir);
        handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);
        const instance = handler.getPluginInstance('simple') as RecordingPlugin;

        await handler.initPlugins(createIoPackage());

        assert.equal(handler.isPluginActive('simple'), true);
        assert.deepEqual(instance.initCalls, [{ custom: 'value', enabled: true }]);
        assert.equal(db.states.get('system.adapter.test.0.plugins.simple.enabled')?.val, true);

        assert.equal(await handler.destroy('simple'), true);
        assert.equal(instance.destroyCalls, 1);
        assert.equal(handler.isPluginInstantiated('simple'), false);
        assert.equal(handler.pluginExists('simple'), true, 'the configuration survives the destruction');
        assert.equal(db.states.get('system.adapter.test.0.plugins.simple.enabled')?.val, false);
    });

    it('sets the database for a single plugin only', () => {
        const { handler, db } = createTestHandler();

        handler.addPlugins({ simple: {}, second: {} }, fixtures.dir);
        handler.setDatabaseForPlugin('simple', db.objectsDb, db.statesDb);

        assert.equal(handler.getPluginInstance('simple')!.statesDb, db.statesDb);
        assert.equal(handler.getPluginInstance('second')!.statesDb, null);
    });

    it('destroys a plugin that could not be initialized', async () => {
        const { handler, db, log } = createTestHandler();

        // a plugin without configuration makes `PluginBase.initPlugin()` reject
        handler.addPlugins({ noconfig: undefined as any }, fixtures.dir);
        handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);

        await handler.initPlugin('noconfig', createIoPackage());

        assert.equal(handler.isPluginInstantiated('noconfig'), false);
        assert.ok(
            log.has('warn', 'Plugin noconfig destroyed because not initialized correctly: No configuration for plugin'),
        );
    });

    it('rejects initializing a plugin that was never instantiated', async () => {
        const { handler } = createTestHandler();

        await assert.rejects(() => handler.initPlugin('simple', createIoPackage()), {
            message: 'Please instantiate plugin first!',
        });
    });

    it('skips plugins without instance when initializing all of them', async () => {
        const { handler, db } = createTestHandler();

        handler.addPlugins({ failingconstructor: {}, simple: {} }, fixtures.dir);
        handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);

        await handler.initPlugins(createIoPackage());

        assert.equal(handler.isPluginActive('simple'), true);
        assert.equal(handler.isPluginActive('failingconstructor'), false);
    });

    it('keeps a plugin that refuses to be destroyed', async () => {
        const { handler, db, log } = createTestHandler();

        handler.addPlugins({ undestroyable: {} }, fixtures.dir);
        handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);
        await handler.initPlugins(createIoPackage());
        const instance = handler.getPluginInstance('undestroyable') as RecordingPlugin;

        assert.equal(await handler.destroy('undestroyable'), false);
        assert.equal(instance.destroyCalls, 1);
        assert.equal(handler.isPluginInstantiated('undestroyable'), true);
        assert.ok(log.has('warn', 'Plugin undestroyable could not be destroyed'));

        assert.equal(await handler.destroy('undestroyable', true), true, 'force removes it anyway');
        assert.equal(handler.isPluginInstantiated('undestroyable'), false);
        assert.equal(
            db.states.get('system.adapter.test.0.plugins.undestroyable.enabled')?.val,
            true,
            'a forced destruction does not deactivate the plugin',
        );
    });

    it('destroys all plugins with force', async () => {
        const { handler, db } = createTestHandler();

        handler.addPlugins({ simple: {}, undestroyable: {} }, fixtures.dir);
        handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);
        await handler.initPlugins(createIoPackage());

        await handler.destroyAll();

        assert.equal(handler.isPluginInstantiated('simple'), false);
        assert.equal(handler.isPluginInstantiated('undestroyable'), false);
    });

    it('reports success when destroying an unknown plugin', async () => {
        const { handler } = createTestHandler();

        assert.equal(await handler.destroy('unknown'), true);
    });

    it('does nothing when no plugins are configured', async () => {
        const { handler, db } = createTestHandler();

        // the implementation guards against this, the generated declaration does not allow it
        handler.addPlugins(undefined as never, fixtures.dir);
        handler.setDatabaseForPlugins(db.objectsDb, db.statesDb);
        await handler.initPlugins(createIoPackage());
        await handler.destroyAll();

        assert.deepEqual(db.calls, []);
    });
});
