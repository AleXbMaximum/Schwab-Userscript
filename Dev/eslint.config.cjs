const pluginImport = require('eslint-plugin-import');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
    {
        ignores: ['.dist/**', 'node_modules/**']
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                crypto: 'readonly',
                setInterval: 'readonly',
                ResizeObserver: 'readonly',
                HTMLElement: 'readonly'
            }
        },
        plugins: { import: pluginImport },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json']
                },
                typescript: {
                    project: './tsconfig.json'
                }
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'off',
            'import/no-unresolved': ['error', { commonjs: true, caseSensitive: true }]
        }
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                crypto: 'readonly',
                setInterval: 'readonly',
                ResizeObserver: 'readonly',
                HTMLElement: 'readonly'
            }
        },
        plugins: { import: pluginImport, '@typescript-eslint': tsPlugin },
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json']
                },
                typescript: {
                    project: './tsconfig.json'
                }
            }
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-console': 'off',
            'import/no-unresolved': ['error', { commonjs: true, caseSensitive: true }]
        }
    },
    {
        files: ['webpack.config.js'],
        languageOptions: {
            sourceType: 'script',
            globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly', process: 'readonly' }
        }
    }
];
