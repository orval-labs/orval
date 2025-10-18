---
id: quick-start
title: Quick Start
---

## Example without a configuration file

```bash
$ orval --input ./petstore.yaml --output ./src/petstore.ts
```

`--input` accepts any YAML- or JSON-formatted specification.

`--output` specifies the target path for the generated files.

## Example with a configuration file

You may also provide a configuration file through the `--config` option.

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
