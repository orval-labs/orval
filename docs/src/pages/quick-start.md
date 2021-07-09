---
id: quick-start
title: Quick Start
---

## Example without config:

```bash
$ orval --input ./petstore.yaml --output ./src/petstore.ts
```

The `--input` can take a yaml or a json.

The `--output` is the file where you want to generate your models and HTTP calls.

## Example with config:

```bash
$ orval --config ./orval.config.js
# or
$ orval
```

**File orval.config.js**

```js
module.exports = {
  'petstore-file': {
    input: './petstore.yaml',
    output: './src/petstore.ts',
  },
};
```
