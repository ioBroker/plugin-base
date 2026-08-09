// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';

export default [
    ...config,

    {
        // specify files to exclude from linting here
        ignores: [
            '*.test.js',
            'test/**/*.js',
            '*.config.mjs',
            'build/**/*',
            // plugin fixtures are loaded through require() on purpose and are not part of a tsconfig
            'test/integration/fixtures/**',
            'admin/build',
            'admin/words.js',
            'admin/admin.d.ts',
            '**/adapter-config.d.ts',

            // these files need to be adapted in the future
            'admin/blockly.js',
        ],
    },

    {
        // tasks.ts is a build script and therefore not part of tsconfig.json
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
                projectService: {
                    allowDefaultProject: ['tasks.ts'],
                },
            },
        },
    },

    {
        // `describe()` and `it()` of node:test return promises that are handled by the test runner
        files: ['test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },

    {
        // disable temporary the rule 'jsdoc/require-param' and enable 'jsdoc/require-jsdoc'
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',

            '@typescript-eslint/no-require-imports': 'off',
        },
    },
];
