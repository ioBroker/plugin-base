import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'plugins');

export interface PluginFixtures {
    /** Directory to hand to `addPlugins()`, it contains a `node_modules` folder with the plugins */
    dir: string;
    /** Remove the whole temporary tree again */
    cleanup: () => void;
}

/**
 * Install the checked-in fixture plugins into a throwaway `node_modules` tree.
 *
 * PluginHandler resolves plugins with `require.resolve('@iobroker/plugin-<name>', { paths })` and
 * loads them with `require()`, so the plugins have to exist on disk under their real package name
 * for the test to exercise that code path.
 *
 * @param plugins map of plugin name (without the `@iobroker/plugin-` prefix) to fixture file name
 */
export function installPluginFixtures(plugins: Record<string, string>): PluginFixtures {
    const root = mkdtempSync(join(tmpdir(), 'iobroker-plugin-base-'));
    const dir = join(root, 'parent');

    for (const [name, fixture] of Object.entries(plugins)) {
        const packageDir = join(dir, 'node_modules', '@iobroker', `plugin-${name}`);
        mkdirSync(packageDir, { recursive: true });
        writeFileSync(
            join(packageDir, 'package.json'),
            `${JSON.stringify({ name: `@iobroker/plugin-${name}`, version: '1.0.0', main: 'index.js' }, null, 4)}\n`,
        );
        // Re-export the fixture instead of copying it, so it keeps resolving plugin-base relatively
        writeFileSync(
            join(packageDir, 'index.js'),
            `module.exports = require(${JSON.stringify(join(FIXTURE_DIR, fixture))});\n`,
        );
    }

    return {
        dir,
        cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
}
