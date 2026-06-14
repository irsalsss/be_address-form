import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "dist/",
      "node_modules/",
      "drizzle/",
      "drizzle.config.ts",
      "vitest.config.ts",
      "eslint.config.mjs",
    ],
  },
  {
    files: ["**/*.ts", "**/*.mjs"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-console": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Use src/shared/config/env.ts instead of process.env directly.",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/shared/config/env.ts"],
    rules: {
      "no-restricted-properties": "off",
      "no-console": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  },
];
