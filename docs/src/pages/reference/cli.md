---
id: cli
title: CLI
---

## Orval reference

Orval provides a set of options that allow you to generate your models or the API calls of your application. This page contains a complete list of all Orval options available.

To download and install Orval, [follow the instructions here](../installation).

### Basic Usage

The `orval` command is used to generate client with appropriate type-signatures. By default search for an `orval.config.js` file.

```bash
$ orval
```

### Input

The `--input` option, shorthand `-i`, can be used to set the path or link to your OpenApi specification.

```bash
$ orval --input ./petstore.yaml
```

### Output

The `--output` option, shorthand `-o`, can be used to set the path to where you want to generate your models and HTTP calls.

```bash
$ orval --output ./api/endpoints/petstoreFromFileSpec.ts"
```

### Config

The `--config` option, shorthand `-c`, can be used to set the path to your Orval config.

```bash
$ orval --config ./api/orval.config.js
```

### Project

The `--project` option, shorthand `-p`, can be used to focus on one project of your Orval config.

```bash
$ orval --project petstore
```
