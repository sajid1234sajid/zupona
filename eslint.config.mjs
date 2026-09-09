import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output. Linting it reports rule violations in minified vendor
    // bundles, which drowns out the source and fails the run for code nobody
    // in this repo wrote.
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
