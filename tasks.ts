// This package has no "type" field, so this file is executed as CommonJS.
// It must stay require-based, otherwise node has to reparse it as an ES module.
import type * as fs from 'node:fs';
import type * as path from 'node:path';

const { copyFileSync } = require('node:fs') as typeof fs;
const { join } = require('node:path') as typeof path;

/** Build outputs the static files have to be copied into */
const targets: readonly string[] = ['esm', 'cjs'];

/** Files that are not emitted by the compiler and must be copied manually */
const files: readonly { source: string; name: string }[] = [
    { source: join(__dirname, 'src', 'types.d.ts'), name: 'types.d.ts' },
    { source: join(__dirname, 'package.json'), name: 'package.json' },
];

for (const target of targets) {
    for (const file of files) {
        copyFileSync(file.source, join(__dirname, 'build', target, file.name));
    }
}
