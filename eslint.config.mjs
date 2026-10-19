// @ts-check

import js from "@eslint/js"
import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig({
	files: ["**/*.{js,ts}"],
	extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
	rules: {
		"@typescript-eslint/no-unused-vars": [
			"error",
			{
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_",
			},
		],
		"@typescript-eslint/no-floating-promises": "error",
		"@typescript-eslint/no-misused-promises": "error",
		"@typescript-eslint/restrict-template-expressions": "off",
	},
	languageOptions: {
		parserOptions: {
			projectService: true,
		},
	},
})
