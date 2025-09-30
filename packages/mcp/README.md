[![npm version](https://badge.fury.io/js/orval.svg)](https://badge.fury.io/js/orval)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![tests](https://github.com/orval-labs/orval/actions/workflows/tests.yaml/badge.svg)](https://github.com/orval-labs/orval/actions/workflows/tests.yaml)

<p align="center">
  <img src="./logo/orval-logo-horizontal.svg?raw=true" width="500" height="160" alt="orval - Restfull Client Generator" />
</p>
<h1 align="center">
  Visit <a href="https://orval.dev" target="_blank">orval.dev</a> for docs, guides, API and beer!
</h1>

### Code Generation

`orval` is able to generate client with appropriate type-signatures (TypeScript) from any valid OpenAPI v3 or Swagger v2 specification, either in `yaml` or `json` formats.

`Generate`, `valid`, `cache` and `mock` in your React, Vue, Svelte and Angular applications all with your OpenAPI specification.

### How to use the generated mcp server

Add a setting to the mcp client to launch the generated `server.ts`.
For example, like this:

```
"pet-store-server": {
  "command": "docker",
  "args": [
    "run",
    "-i",
    "--rm",
    "pet-store-mcp",
    "bash",
    "-c",
    "ts-node",
    "src/gen/server.ts"
  ],
  "disabled": false,
  "alwaysAllow": []
}
```

Here, `src/gen/server.ts` is started using `Docker`.

### Samples

You can find below some samples

- [react app](https://github.com/orval-labs/orval/tree/master/samples/react-app)
- [react query](https://github.com/orval-labs/orval/tree/master/samples/react-query)
- [svelte query](https://github.com/orval-labs/orval/tree/master/samples/svelte-query)
- [vue query](https://github.com/orval-labs/orval/tree/master/samples/vue-query)
- [react app with swr](https://github.com/orval-labs/orval/tree/master/samples/react-app-with-swr)
- [angular app](https://github.com/orval-labs/orval/tree/master/samples/angular-app)
- [hono](https://github.com/orval-labs/orval/tree/master/samples/hono)
- [next app with fetch](https://github.com/orval-labs/orval/tree/master/samples/next-app-with-fetch)
