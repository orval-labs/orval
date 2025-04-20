# petstore

This is a demo of the mcp server.

## Setup

### 1. Building the Dockerfile

```sh
docker build ./ -t mcp-petstore
```

### 2. Setup as mcp server in your ai agent.

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
