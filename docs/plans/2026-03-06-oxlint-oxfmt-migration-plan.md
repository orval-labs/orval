# oxlint + tsgolint + oxfmt Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ESLint + Prettier with oxlint + tsgolint + oxfmt across the entire Orval monorepo.

**Architecture:** oxfmt replaces Prettier for formatting and import sorting. oxlint replaces ESLint for linting. tsgolint provides type-aware rules via the `--type-aware` flag. Configuration lives at root level (`.oxfmtrc.json`, `.oxlintrc.json`). Turbo orchestrates per-package linting unchanged.

**Tech Stack:** oxlint-tsgolint, oxfmt, Yarn 4.x, Turbo

**Design doc:** `docs/plans/2026-03-06-oxlint-oxfmt-migration-design.md`

---

### Task 1: Install oxfmt and create config

**Files:**

- Create: `.oxfmtrc.json`
- Create: `.oxfmtignore`
- Modify: `package.json` (root)
- Modify: `.yarnrc.yml` (catalog)

**Step 1: Add oxfmt to catalog and install**

In `.yarnrc.yml`, add to the `catalog:` section:

```yaml
oxfmt: latest
```

Run:

```bash
yarn add -D oxfmt@latest
```

**Step 2: Create `.oxfmtrc.json`**

Create file at repo root:

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

**Step 3: Create `.oxfmtignore`**

Copy content from `.prettierignore` (same glob syntax):

```
node_modules
.next
**/dist
.husky
mockServiceWorker.js
yarn.lock
.svelte-kit
**/.angular/cache
*.svg
*.ico
*.lock
.gitignore
.gitattributes
*.xml
packages/hono/src/zValidator.ts
*.mdx
.github/ISSUE_TEMPLATE
docs/public/llms.txt
**/__snapshots__/**
```

**Step 4: Update root `package.json` scripts**

Change these scripts:

```json
"format": "oxfmt",
"format:check": "oxfmt --check",
"format:samples": "oxfmt samples",
```

**Step 5: Update `.lintstagedrc.json`**

Change to:

```json
{
  "*": "oxfmt --check"
}
```

**Step 6: Verify oxfmt check works**

Run:

```bash
yarn format:check
```

Expected: Failures (formatting differences between prettier and oxfmt). This is expected.

**Step 7: Reformat the entire codebase**

Run:

```bash
yarn format
```

Expected: Many files reformatted. Review a few files to confirm sane output.

**Step 8: Verify format check passes after reformat**

Run:

```bash
yarn format:check
```

Expected: PASS — no formatting differences.

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: migrate formatting from prettier to oxfmt

Replace Prettier with oxfmt for code formatting.
oxfmt also handles import sorting (replaces eslint-plugin-simple-import-sort).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Install oxlint + tsgolint and generate config

**Files:**

- Create: `.oxlintrc.json`
- Modify: `package.json` (root)
- Modify: `.yarnrc.yml` (catalog)

**Step 1: Add oxlint-tsgolint to catalog and install**

In `.yarnrc.yml`, add to the `catalog:` section:

```yaml
oxlint-tsgolint: latest
```

Run:

```bash
yarn add -D oxlint-tsgolint@latest
```

**Step 2: Run migration tool to generate `.oxlintrc.json`**

Run:

```bash
npx @oxlint/migrate --type-aware eslint.config.ts
```

Expected: Generates `.oxlintrc.json` at repo root based on current ESLint rules.

**Step 3: Verify and adjust generated `.oxlintrc.json`**

Read the generated file. Verify it includes:

- `ignorePatterns` matching the current `globalIgnores` from `eslint.config.ts`:
  - `docs`, `tests/generated`, `tests/**/__snapshots__/**`, `samples`, `.husky`, `packages/hono/src/zValidator.ts`, `**/.yarn`, `**/.turbo`, `**/dist`, `**/__snapshots__`
- `plugins` includes `typescript` and `unicorn`
- Rule mappings from current config:
  - `no-useless-escape`: `warn`
  - `no-case-declarations`: `warn`
  - `no-prototype-builtins`: `warn`
  - `unicorn/prevent-abbreviations`: `off`
  - `unicorn/consistent-function-scoping`: `error` (checkArrowFunctions: false — verify if oxlint supports this option, otherwise just `error`)
  - `unicorn/no-null`: `warn`
  - `unicorn/prefer-at`: `off`
  - `unicorn/no-array-reduce`: `warn`
  - `typescript/no-unused-vars`: `warn`
  - `typescript/ban-ts-comment`: `warn`
  - `typescript/no-explicit-any`: `warn`
  - `typescript/no-require-imports`: `warn`
  - `typescript/no-unsafe-assignment`: `warn`
  - `typescript/no-unsafe-function-type`: `warn`
  - `typescript/consistent-type-definitions`: `off`
  - `typescript/no-unnecessary-type-assertion`: `off`
  - `typescript/no-non-null-asserted-optional-chain`: `warn`
  - `typescript/restrict-template-expressions`: `error` (check if oxlint supports the allow options)
- File-specific overrides:
  - `packages/mock/src/msw/index.test.ts`: disable `typescript/no-unsafe-assignment`, `typescript/no-unsafe-member-access`, `typescript/no-unsafe-return`
  - `packages/orval/src/utils/package-json.test.ts`: disable `typescript/ban-ts-comment`

If the migration tool doesn't handle some of these, manually add them.

Also remove any prettier/simple-import-sort rules the migrator may have added (they're no longer relevant — oxfmt handles formatting and import sorting).

**Step 4: Smoke-test oxlint on one package**

Run:

```bash
cd packages/core && npx oxlint --type-aware
```

Expected: Lint output (may have warnings matching current ESLint behavior). No crashes.

**Step 5: Commit**

```bash
git add .oxlintrc.json package.json .yarnrc.yml yarn.lock
git commit -m "chore: add oxlint + tsgolint with migrated config

Generate .oxlintrc.json from eslint.config.ts via @oxlint/migrate.
Includes type-aware rules via tsgolint.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Replace ESLint with oxlint in all package scripts

**Files:**

- Modify: `packages/angular/package.json`
- Modify: `packages/axios/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/fetch/package.json`
- Modify: `packages/hono/package.json`
- Modify: `packages/mcp/package.json`
- Modify: `packages/mock/package.json`
- Modify: `packages/orval/package.json`
- Modify: `packages/query/package.json`
- Modify: `packages/solid-start/package.json`
- Modify: `packages/swr/package.json`
- Modify: `packages/zod/package.json`

**Step 1: Update lint scripts in all 12 packages**

In each package's `package.json`, change:

```json
"lint": "eslint ."
```

to:

```json
"lint": "oxlint --type-aware"
```

Exception — `packages/hono/package.json` changes from:

```json
"lint": "tsc --noEmit src/zValidator.ts && eslint ."
```

to:

```json
"lint": "tsc --noEmit src/zValidator.ts && oxlint --type-aware"
```

**Step 2: Build packages first (lint depends on build in turbo)**

Run:

```bash
yarn build
```

Expected: All packages build successfully.

**Step 3: Run lint across all packages**

Run:

```bash
yarn lint
```

Expected: Lint passes (or produces warnings consistent with current behavior). If there are new errors from oxlint/tsgolint that weren't in ESLint, note them down — we'll address in Task 4.

**Step 4: If new errors found, adjust `.oxlintrc.json`**

For any rules producing new errors that weren't errors before:

- If false positive from tsgolint alpha: set rule to `"warn"` or `"off"` in `.oxlintrc.json`
- If legitimate new catch: keep as-is (bonus!)

**Step 5: Commit**

```bash
git add packages/*/package.json .oxlintrc.json
git commit -m "chore: replace eslint with oxlint in all package lint scripts

All 12 packages now use 'oxlint --type-aware' for linting.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Remove ESLint and Prettier dependencies

**Files:**

- Delete: `eslint.config.ts`
- Delete: `.prettierrc.json`
- Delete: `.prettierignore`
- Modify: `package.json` (root)
- Modify: `.yarnrc.yml` (catalog)

**Step 1: Delete old config files**

Remove:

- `eslint.config.ts`
- `.prettierrc.json`
- `.prettierignore`

**Step 2: Remove ESLint/Prettier devDependencies from root `package.json`**

Remove these from `devDependencies`:

- `eslint` (catalog reference)
- `eslint-config-prettier`
- `eslint-config-turbo`
- `eslint-plugin-prettier`
- `eslint-plugin-simple-import-sort`
- `eslint-plugin-unicorn`
- `globals` (catalog reference)
- `typescript-eslint` (catalog reference)
- `prettier` (catalog reference)

Keep `lint-staged` and `husky` (still used for oxfmt pre-commit).

**Step 3: Clean up `.yarnrc.yml` catalog**

Remove from `catalog:`:

- `eslint: 10.0.2`
- `globals: 17.4.0`
- `prettier: 3.8.1`
- `typescript-eslint: 8.56.1`

**Step 4: Reinstall dependencies**

Run:

```bash
yarn install
```

Expected: lockfile updated, old deps removed.

**Step 5: Verify everything still works**

Run:

```bash
yarn format:check && yarn build && yarn lint
```

Expected: All three pass without ESLint/Prettier installed.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove eslint and prettier dependencies

Removed: eslint, eslint-config-prettier, eslint-config-turbo,
eslint-plugin-prettier, eslint-plugin-simple-import-sort,
eslint-plugin-unicorn, globals, typescript-eslint, prettier.

Deleted: eslint.config.ts, .prettierrc.json, .prettierignore.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Full CI verification

**Files:** None (verification only)

**Step 1: Run format check**

Run:

```bash
yarn format:check
```

Expected: PASS

**Step 2: Run build**

Run:

```bash
yarn build
```

Expected: PASS

**Step 3: Run lint**

Run:

```bash
yarn lint
```

Expected: PASS

**Step 4: Run tests**

Run:

```bash
yarn test
```

Expected: PASS

**Step 5: Run snapshot tests**

Run:

```bash
yarn test:snapshots
```

Expected: PASS (snapshots may need updating if formatting changed in generated code)

**Step 6: If snapshots need updating**

Run:

```bash
yarn test:snapshots:update
```

Then re-run:

```bash
yarn test:snapshots
```

Expected: PASS

**Step 7: Run CLI tests**

Run:

```bash
yarn test:cli
```

Expected: PASS

**Step 8: Commit snapshot updates if any**

```bash
git add -A
git commit -m "chore: update snapshots after oxfmt formatting

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description                                                      | Commit                                                          |
| ---- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Install oxfmt, create config, reformat codebase                  | `chore: migrate formatting from prettier to oxfmt`              |
| 2    | Install oxlint + tsgolint, generate config from ESLint           | `chore: add oxlint + tsgolint with migrated config`             |
| 3    | Replace `eslint .` with `oxlint --type-aware` in all 12 packages | `chore: replace eslint with oxlint in all package lint scripts` |
| 4    | Remove all ESLint/Prettier deps and config files                 | `chore: remove eslint and prettier dependencies`                |
| 5    | Full CI verification, update snapshots if needed                 | `chore: update snapshots after oxfmt formatting` (if needed)    |
