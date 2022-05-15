---
id: configuration
title: Configuration
---

import { Tab, Tabs } from 'components/Tabs';

This page is a reference to the different ways of configuring your Orval projects.

Using an `orval.config.(js|mjs|ts)}` configuration file, placed at the root of a project, you can provide a list of options that changes the default behaviour of the Orval generated files.

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
      <td className="border px-4 py-2">Directly the path to the specification or the configuration of the imported specification and also what you want to override on it.
      </td>
    </tr>
    <tr className="bg-gray-100">
      <td className="border px-4 py-2">Output</td>
      <td className="border px-4 py-2">Directly the path to where you want to generate your models and HTTP calls or the configuration of what and where you want to write the generated code.</td>
    </tr>
  </tbody>
</table>
</div>

### `orval.config.(js|mjs|ts)}`

<Tabs>
    <Tab label="js">
    ```js
    module.exports = {
        petstore: {
            input: './petstore.yaml',
            output: './petstore.ts',
        },
    };
    ```
    <Tab label="ts">
    ```ts
    import { defineConfig } from 'orval';
    
    export default defineConfig({
        petstore: {
            input: './petstore.yaml',
            output: './petstore.ts',
        },
    });
    ```
    </Tab>
</Tabs>
