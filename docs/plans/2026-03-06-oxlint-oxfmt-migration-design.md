# Migration: ESLint + Prettier -> oxlint + tsgolint + oxfmt

## Summary

Replace ESLint, typescript-eslint, and Prettier with the VoidZero toolchain: oxlint (stable) + tsgolint (alpha, type-aware) for linting, oxfmt (beta) for formatting + import sorting.

## Mapping

| Current                                                      | Replacement                                | Status                            |
| ------------------------------------------------------------ | ------------------------------------------ | --------------------------------- |
| ESLint + typescript-eslint (strict type-checked + stylistic) | oxlint + tsgolint                          | oxlint 1.0 stable, tsgolint alpha |
| eslint-plugin-unicorn                                        | oxlint built-in unicorn plugin             | Stable                            |
| eslint-plugin-simple-import-sort                             | oxfmt built-in import sorting              | Beta                              |
| eslint-config-turbo                                          | Dropped (env var hashing check, low value) | N/A                               |
| Prettier                                                     | oxfmt                                      | Beta                              |
| eslint-plugin-prettier + eslint-config-prettier              | Dropped                                    | N/A                               |

## Config files

### `.oxlintrc.json`

Generated via `@oxlint/migrate --type-aware` from `eslint.config.ts`, then manually verified. Key settings:

- Enable `typescript` plugin (type-aware via tsgolint)
- Enable `unicorn` plugin
- Map current rule overrides (warn/off)
- Ignores match current ESLint globalIgnores

### `.oxfmtrc.json`

Maps current `.prettierrc.json`:

```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "endOfLine": "lf",
  "arrowParens": "always",
  "sortImports": {
    "groups": [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown"
    ]
  }
}
```

Ignore patterns from `.prettierignore` carry over.

## Dependencies

### Remove

- `eslint`
- `eslint-config-prettier`
- `eslint-config-turbo`
- `eslint-plugin-prettier`
- `eslint-plugin-simple-import-sort`
- `eslint-plugin-unicorn`
- `globals`
- `typescript-eslint`
- `prettier`

### Add

- `oxlint-tsgolint` (bundles oxlint + tsgolint)
- `oxfmt`

## Script changes

### Root `package.json`

- `"format": "oxfmt"` (was `prettier --write .`)
- `"format:check": "oxfmt --check"` (was `prettier --check .`)
- `"format:samples": "oxfmt samples"` (was `prettier --write samples`)

### Each package `package.json` (12 packages)

- `"lint": "oxlint --type-aware"` (was `eslint .`)
- Hono: `"lint": "tsc --noEmit src/zValidator.ts && oxlint --type-aware"`

### `.lintstagedrc.json`

- `"*": "oxfmt --check"` (was `prettier --check`)

### CI (`pr-checks.yaml`)

No structural changes. Same steps: `yarn format:check`, `yarn build`, `yarn lint`, `yarn test`.

## Files to delete

- `eslint.config.ts`
- `.prettierrc.json`
- `.prettierignore`

## Migration order

1. Add `.oxfmtrc.json`, replace prettier scripts, reformat entire codebase (one commit)
2. Run `@oxlint/migrate --type-aware` to generate `.oxlintrc.json` from `eslint.config.ts`
3. Replace `eslint .` with `oxlint --type-aware` in all 12 package scripts
4. Remove ESLint/prettier deps and config files
5. Verify full CI pipeline passes (`format:check`, `build`, `lint`, `test`, `test:snapshots`)

## Risk mitigation

- tsgolint alpha false positives: disable per-rule in `.oxlintrc.json`
- oxfmt beta: 95% prettier test compat, `printWidth: 80` explicitly set
- One big reformat commit establishes new baseline
