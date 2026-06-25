import tsparser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	...obsidianmd.configs.recommended,
	globalIgnores([
		'node_modules',
		'dist',
		'shims',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-deprecated': [
				'error',
				{
					allow: [
						{
							from: 'package',
							package: '@protontech/drive-sdk',
							name: ['ProtonDrivePhotosClient', 'getNodeUid'],
						},
					],
				},
			],
			'obsidianmd/ui/sentence-case': [
				'error',
				{
					acronyms: ['UID'],
					enforceCamelCaseLower: true,
				},
			],
		},
	},
	eslintConfigPrettier,
]);
