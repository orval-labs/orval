# fix(angular): generate filterParams for tags case-insensitively (#2998)

## Fixes

Fixes #2998.

## Description

When generating an Angular client using `mode: 'tags-split'`, Orval's generator extracts query parameters directly into function parameters, but filtering the query parameters relies on a generated `filterParams` helper function in the same module.

Prior to this PR, the `filterParams` function was missing if the OpenAPI tag casing (e.g., "Requests") did not exactly match the internally formatted tag (e.g., "requests"). This resulted in compilation errors when calling the missing function within the service methods.

This PR fixes the exact-case string matching bug by using Orval's core `camel` utility function to perform case-insensitive tag matching in the `relevantVerbs` filter before generating the Angular service file headers.

## Changes

1. **Angular Client Generator (`packages/angular/src/index.ts`)**
   - Implemented `camel` case normalization when matching `verbOptions.tags` against the formatted `tag` string, ensuring that query parameter relevance is identified robustly.

2. **Dedicated Test Configuration (`tests/specifications/issue-2998.yaml`)**
   - In order to prevent this from silently slipping by in the future, a dedicated automated integration test case has been created, capturing the minimal reproducible example from issue 2998.
   - Connected `issue-2998.yaml` into the default test matrix targeting the `angular` client with `tags-split` and `mock: true`.
   - Committed the generated API service logic snapshot (`tests/__snapshots__/default/issue-2998`), fully verifying the output of `filterParams`.
