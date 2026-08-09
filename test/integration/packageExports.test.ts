import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const ROOT_DIR = join(__dirname, '..', '..');

/**
 * Read a JSON file relative to the package root
 *
 * @param relativePath path relative to the package root
 */
function readJson(relativePath: string): Record<string, any> {
    return JSON.parse(readFileSync(join(ROOT_DIR, relativePath), 'utf8'));
}

const packageJson = readJson('package.json');

describe('published package', () => {
    it('ships the files that package.json points to', () => {
        for (const entry of [packageJson.main, packageJson.module, packageJson.types]) {
            assert.ok(existsSync(join(ROOT_DIR, entry)), `${entry} is missing`);
        }
        for (const [condition, target] of Object.entries(packageJson.exports['.'] as Record<string, string>)) {
            assert.ok(existsSync(join(ROOT_DIR, target)), `exports["."].${condition} -> ${target} is missing`);
        }
    });

    it('copies types.d.ts and package.json into both builds', () => {
        const types = readFileSync(join(ROOT_DIR, 'src', 'types.d.ts'), 'utf8');

        for (const build of ['esm', 'cjs']) {
            assert.equal(readFileSync(join(ROOT_DIR, 'build', build, 'types.d.ts'), 'utf8'), types);
            assert.equal(readJson(join('build', build, 'package.json')).version, packageJson.version);
        }
    });

    it('exposes the API through the CommonJS entry point', () => {
        const required = require(join(ROOT_DIR, packageJson.main));

        assert.equal(typeof required.PluginBase, 'function');
        assert.equal(typeof required.PluginHandler, 'function');
    });

    it('exposes the API through the module entry point', async () => {
        const imported = await import(pathToFileURL(join(ROOT_DIR, packageJson.module)).href);

        assert.equal(typeof imported.PluginBase, 'function');
        assert.equal(typeof imported.PluginHandler, 'function');
    });

    it('keeps the documented instance methods on the exported classes', () => {
        const { PluginBase, PluginHandler } = require(join(ROOT_DIR, packageJson.main));

        for (const method of ['init', 'destroy', 'getState', 'setState', 'getObject', 'setObject', 'extendObject']) {
            assert.equal(typeof PluginBase.prototype[method], 'function', `PluginBase.${method} is missing`);
        }
        for (const method of [
            'addPlugins',
            'instantiatePlugin',
            'setDatabaseForPlugin',
            'setDatabaseForPlugins',
            'initPlugin',
            'initPlugins',
            'destroy',
            'destroyAll',
            'getPluginInstance',
            'getPluginConfig',
            'pluginExists',
            'isPluginInstantiated',
            'isPluginActive',
        ]) {
            assert.equal(typeof PluginHandler.prototype[method], 'function', `PluginHandler.${method} is missing`);
        }
    });
});
