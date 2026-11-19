import eslintConfigNext from "eslint-config-next";
import tseslint from "typescript-eslint";

export default [
  ...eslintConfigNext,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
