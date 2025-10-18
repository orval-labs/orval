---
id: configuration
title: Configuration
---

This page is a reference to the different ways of configuring Orval projects.

Using an `orval.config.(js|mjs|ts)` configuration file, placed at the root of a project, you can provide a list of options that changes the default behaviour of the Orval generated files.

Configuration options for the following are described on this page:

<div>
<table className="table-auto">
  <thead>
    <tr>
      <th className="px-4 py-2">Category</th>
      <th className="px-4 py-2">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="border px-4 py-2">Input</td>
      <td className="border px-4 py-2">The path to the specification, or a configuration object specifying how to transform the specification before generation.
      </td>
    </tr>
    <tr className="bg-gray-100">
      <td className="border px-4 py-2">Output</td>
      <td className="border px-4 py-2">The output path for Orval's auto-generated files, or a configuration object specifying what is generated and how, as well as where to save the generated files.</td>
    </tr>
    <tr>
      <td className="border px-4 py-2">Hooks</td>
      <td className="border px-4 py-2">Allows running scripts on certain events.
      </td>
    </tr>
  </tbody>
</table>
</div>

## orval.config.js

```js
module.exports = {
  petstore: {
    input: './petstore.yaml',
    output: './petstore.ts',
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
};
```

## orval.config.ts

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: './petstore.yaml',
    output: './petstore.ts',
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
});
```
