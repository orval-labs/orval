---
id: configuration-input
title: Input
---

## target

Type: `String`.

Valid values: path or link to the specification.

```js
module.exports = {
  petstore: {
    input: {
      target: './petstore.yaml',
    },
  },
};
```

## validation

Type: `Boolean` or `Object`

Default Value: `false`.

To enforce the best quality as possible of specification, we have integrated the amazing <a href="https://github.com/IBM/openapi-validator" target="_blank">OpenAPI linter from IBM</a>.

Specifying `true` will by default use the <a href="https://github.com/IBM/openapi-validator/blob/main/docs/ibm-cloud-rules.md"><em>IBM Cloud Validation Ruleset</em></a>.
Specifying an `Object` will use the provided ruleset instead. You can learn more about creating rulesets <a href="https://docs.stoplight.io/docs/spectral/aa15cdee143a1-java-script-ruleset-format">here</a>.

```js
module.exports = {
  petstore: {
    input: {
      validation: true,
    },
  },
};
```

## override

Type: `Object`.

Give you the possibility to override the specification

### transformer

Type: `String` or `Function`.

Valid values: path or implementation of the transformer function.

This function is executed when you generate and take in argument an <a href="https://github.com/metadevpro/openapi3-ts/blob/master/src/model/openapi30.ts#L12" target="_blank">OpenAPIObject</a> and should return an <a href="https://github.com/metadevpro/openapi3-ts/blob/master/src/model/openapi30.ts#L12" target="_blank">OpenAPIObject</a>.

```js
module.exports = {
  input: {
    override: {
      transformer: 'src/api/transformer/add-version.js',
    },
  },
};
```

Example of transformer <a href="https://github.com/orval-labs/orval/blob/master/samples/basic/api/transformer/add-version.js" target="_blank">here</a>

## filters

Type: `Object`.

Default Value: `{}`.

If specified, Orval only generates the endpoints after applying the filter.

### mode

Type: `String`.

Valid values: `include`, `exclude`.

Default Value: `include`.

Combined with `tags` or `schemas`, this setting determines whether to include or exclude the specified items.
For instance, the example below generates endpoints that do not contain the tag `pets`.

```js
module.exports = {
  petstore: {
    input: {
      filters: {
        mode: 'exclude',
        tags: ['pets'],
      },
    },
  },
};
```

### tags

Type: Array of `string` or `RegExp`.

Default Value: `[]`.

It is possible to filter on `tags`.
For instance the example below only generates the endpoints that contain the tag `pets` or matches the regular expression `/health/`.

```js
module.exports = {
  petstore: {
    input: {
      filters: {
        tags: ['pets', /health/],
      },
    },
  },
};
```

### schemas

Type: Array of `string` or `RegExp`.

Only schemas names match the specified `string` or `RegExp` will be automatically generated.
For instance the example below only generates the `schema` object that matches string `Error` or regular expression `/Cat/`.

```js
module.exports = {
  petstore: {
    input: {
      filters: {
        schemas: ['Error', /Cat/],
      },
    },
  },
};
```

## converterOptions

Type: `Object`.

Default Value: `{}`.

Orval convert Swagger 2.0 definitions into OpenAPI 3.0.x. You can use the converterOptions property to provide custom config for that. Check [here](https://github.com/orval-labs/orval/blob/next/src/types/swagger2openapi.d.ts#L10) available options.

```js
module.exports = {
  petstore: {
    input: {
      converterOptions: true,
    },
  },
};
```

## parserOptions

Type: `Object`.

Default Value: `{ resolve: { github: githubResolver }, validate: true }`.

Orval utilizes a parser to process multiple file specifications. You can customize its behavior using the `parserOptions` property. See the [available options](https://apidevtools.com/swagger-parser/options.html) for configuration. By default, Orval includes a GitHub parser, but you can add your own for private specifications or other specific needs.

Your specification is automatically validated by default.

```js
module.exports = {
  petstore: {
    input: {
      parserOptions: {
        resolve: { gitlab: gitlabResolver },
      },
    },
  },
};
```
