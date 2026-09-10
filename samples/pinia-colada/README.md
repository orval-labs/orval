# Pinia Colada client

This sample uses Orval's built-in `pinia-colada` client with Vue 3.5.42,
Pinia 4.0.3 and Pinia Colada 1.4.4. All API data is synthetic.

From the repository root, install dependencies and build the packages using the
contribution guide, then run:

```sh
vp run -F pinia-colada-sample generate-api
vp run -F pinia-colada-sample test
vp run -F pinia-colada-sample dev
```

Open `http://127.0.0.1:5180`. Select a pet, create or update it, and delete an
entry. Mutations invalidate the affected list/detail queries. Use the name
`error` to exercise an HTTP failure, then use another name to recover.

The configuration also generates compile-checked Fetch and Axios clients in
single, split, tags and tags-split modes, named path parameter variants,
disabled/required request option variants, and plain Fetch/Axios mutators.
Generated fixtures live in `src/gen` and are recreated by `generate-api`.

`src/typecheck.ts` contains compile-only assertions for generated inputs,
results and mutation callback context. It is not imported by the application.

To run browser checks from this directory:

```sh
bun x --no-install playwright install chromium
bun run test:browser
```

The browser checks cover CRUD, reactive queries, query cancellation, failure
recovery, multipart/URL-encoded payloads and custom request functions. The
synthetic server exists only in the Vite development server; production build
assets need an API server providing the same routes.
