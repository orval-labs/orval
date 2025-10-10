---
id: mcp
title: MCP
---

## Introduction

`Orval` generates `MCP server` from `OpenAPI`.
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server create great value by simply relaying `API` clients.
This eliminates the need to wait for someone to develop it or publish it on the marketplace. You can create an `MCP server` with various services that you have `OpenAPI` for yourself and use them with AI agents.
And from a single `OpenAPI` specification, various `API` ecosystem components can be generated. The same specification can be used to support both traditional client-server applications and AI agent integration.

## How to use

If you want to generate a server of [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction), define the `client` property to `mcp` and a server of `MCP` will be generated in the target file and directory. You can check <a href="https://github.com/modelcontextprotocol/typescript-sdk" target="_blank">typescript-sdk</a>.

### Example with orval.config.js

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'single',
      client: 'mcp',
      baseUrl: 'https://petstore3.swagger.io/api/v3',
      target: 'src/handlers.ts',
      schemas: 'src/http-schemas',
    },
  },
});
```

Currently, Please note that the `mcp` client only works in `single` mode.

### Generated Template Structure

`orval` generates files in the following structure:

```
src/
├── http-schemas
│   ├── createPetsBodyItem.ts
│   ├── error.ts
│   ├── index.ts
│   ├── listPetsParams.ts
│   ├── pet.ts
│   ├── pets.ts
│   └── updatePetByParamsParams.ts
├── handlers.ts
├── http-client.ts
├── server.ts
└── tool-schemas.zod.ts
```

Each generated file serves a specific purpose:

- `http-schemas/`: Directory containing `TypeScript` type definitions for `request`/`response` data
- `handlers.ts`: Contains handler functions that use the `fetch` client to make `API` calls and return results in `MCP` format
- `http-client.ts`: Contains generated `fetch` client functions for `API` communication
- `server.ts`: Defines `MCP tools` and server configurations
- `tool-schemas.zod.ts`: Defines `Zod` schemas for `MCP tool` inputs

### Using the generated MCP Server

To use the generated code as an `MCP server`, follow these steps:

1. Build the Docker image:

```sh
docker build ./ -t mcp-petstore
```

2. Configure the MCP server in your AI agent's configuration:

Here we will introduce the settings using the `cline` for the ai agent. It will work with other ai agents, so please adjust the detailed settings accordingly.
For `clile`, specify as follows:

```
{
  "mcpServers": {
    "petstore": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mcp-petstore"
      ],
      "disabled": false,
      "alwaysAllow": []
    },
  }
}
```

This setup allows your AI agent to interact with the petstore API through the MCP protocol, using the generated handlers and tools.

Checkout <a href="https://github.com/orval-labs/orval/tree/master/samples/mcp/petstore" target="_blank">here</a> for the full example.
