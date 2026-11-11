# Fetch shared runtime

This sample generates clients for two OpenAPI documents, `specs/petstore.yaml`
and `specs/store.yaml`, with `override.fetch.runtimeImplementationStyle: 'shared'`.
Both outputs import their request and response handling from one
`src/api/runtime.ts`.

- The petstore output calls the shared runtime directly.
- The store output sets a global `mutator` (`src/custom-fetch.ts`), which is
  wired through the generated `src/api/store/client-config.ts`. An output with
  a mutator and one without can share the same runtime.
- The tests mock requests with MSW in two ways: with the handlers that orval
  generates (`*.msw.ts`), and with handwritten handlers built from the
  generated `getXxxUrl` functions.

```sh
vp run generate-api # regenerate src/api
vp run test         # type check and run the tests
```
