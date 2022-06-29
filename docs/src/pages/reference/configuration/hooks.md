---
id: configuration-hooks
title: Hooks
---

### beforeWrite

Type: `String` or `String[]` or `Function`.

Runs after orval generates client and before files are written to the file system.

```js
module.exports = {
  petstore: {
    hooks: {
      postWrite: './petstore.yaml',
    },
  },
};
```
