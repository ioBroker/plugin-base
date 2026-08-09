// Executed via tsx, because node cannot run TypeScript on all supported node versions (>= 20).
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

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
