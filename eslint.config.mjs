import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Existing data-loading effects and legacy dynamic component factories
      // remain visible as warnings while new lint errors fail CI.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    files: ["tests/**/*.mjs"],
    rules: {
      "@next/next/no-assign-module-variable": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
])
