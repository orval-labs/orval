# petstore

This is a demo of the mcp server.

## Setup

### 1. Building the Dockerfile

```sh
docker build ./ -t mcp-petstore
```

### 2. Setup as mcp server in your ai agent.

For clients, specify as follows:

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

That's it.
```
