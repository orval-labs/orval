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

The `--input` option, shorthand `-i`, can be used to set the path or link to your OpenAPI specification.

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

### Watch

The `--watch` option, shorthand `-w`, can be used to watch some files and execute orval when they change. if path is not specified, it watches the specification files. Repeat "--watch" for more than one path

```bash
$ orval --watch
```

```bash
$ orval --watch ./src
```

### Clean

The `--clean`, can be used to clean generated files. Be careful clean all output target and schemas folder.

```bash
$ orval --clean
```

```bash
$ orval --clean ./src
```

### Prettier

The `--prettier`, can be used to prettier generated files. You need to have prettier installed globally.

```bash
$ orval --prettier
```

### biome

The `--biome`, can be used to [`Biome`](https://biomejs.dev/) generated files. You need to have `Biome` in your global dependencies.

```bash
$ orval --biome
```

### tsconfig

The `--tsconfig`, can be used to specify the path to your `tsconfig`.

```bash
$ orval --tsconfig ./src/tsconfig.json
```
