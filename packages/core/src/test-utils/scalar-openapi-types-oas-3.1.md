# `@scalar/openapi-types` 3.1 `SchemaObject` rejects valid OAS 3.1 schemas

Paste into [scalar/scalar issues](https://github.com/scalar/scalar/issues). Suggested labels: `bug`, `package: @scalar/openapi-types`.

Related: [#6617](https://github.com/scalar/scalar/issues/6617) (closed; parser / workspace-store types). This report is about the published **`@scalar/openapi-types` 0.9.5** `3.1` `SchemaObject` union.

---

### What happens?

`SchemaObject` from `@scalar/openapi-types/3.1` is a `type`-discriminated union plus `boolean`. Valid OAS 3.1 Schema Objects therefore fail `satisfies SchemaObject`.

OAS 3.1 Schema Object is a [superset of JSON Schema Draft 2020-12](https://spec.openapis.org/oas/v3.1.1.html#schema-object), not an OAS 3.0 exclusive `$ref` / schema split. Scalar still models `$ref` only on `ReferenceObject`, omits JSON Schema core keywords from `SchemaObject`, closes `format` to a string/number union, and puts object/array keywords only on the matching `type` variant.

Package: `@scalar/openapi-types@0.9.5`  
File: [`3.1/schema.d.ts`](https://github.com/scalar/scalar/blob/main/packages/openapi-types/3.1/schema.d.ts)

```ts
import type {
  ComponentsObject,
  MediaTypeObject,
  ParameterObject,
  SchemaObject,
} from '@scalar/openapi-types/3.1';
```

Each snippet below is valid OAS 3.1. TypeScript rejects `satisfies SchemaObject` (or the listed type).

#### 1. JSON Schema core keywords are missing

`SharedProperties` has `$defs` but not `$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$dynamicRef`, `$ref`, or `$comment`.

Spec: [Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object) (“keyword definitions follow those of JSON Schema … including `$schema`, `$id`, `$ref`, and `$dynamicRef`”), [Specifying Schema Dialects](https://spec.openapis.org/oas/v3.1.1.html#specifying-schema-dialects), [Relative References in URIs](https://spec.openapis.org/oas/v3.1.1.html#relative-references-in-uris), [Generic (Template) Data Structures](https://spec.openapis.org/oas/v3.1.1.html#generic-template-data-structures). JSON Schema 2020-12: [`$id`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-id-keyword), [`$anchor`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-anchor-keyword), [`$dynamicAnchor` / `$dynamicRef`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-dynamic-references-with-dyn), [`$ref`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-direct-references-with-ref), [`$comment`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-comments-with-comment), [`$schema`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-the-schema-keyword).

```ts
({
  $id: 'https://example.com/schemas/pet',
  $anchor: 'Pet',
  $comment: 'reusable pet schema',
  $schema: 'https://spec.openapis.org/oas/3.1/dialect/base',
  type: 'object',
}) satisfies SchemaObject;

({ $dynamicAnchor: 'T', type: 'object' }) satisfies SchemaObject;

({ $dynamicRef: '#T' }) satisfies SchemaObject;
```

#### 2. `$ref` is a Schema Object keyword, not only `ReferenceObject`

In 3.1, `{ $ref: '…' }` is a Schema Object. Scalar keeps an OAS 3.0-style `ReferenceObject`. `MediaTypeObject.schema`, `ParameterWithSchemaObject.schema`, and `ComponentsObject.schemas` are typed as `SchemaObject` (no `$ref`), so even a `$ref`-only schema fails.

Spec: [Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object), [JSON Schema `$ref`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-direct-references-with-ref), [Media Type Object](https://spec.openapis.org/oas/v3.1.1.html#media-type-object) (spec example `schema: { $ref: '#/components/schemas/Address' }` in [Working With Examples](https://spec.openapis.org/oas/v3.1.1.html#working-with-examples)), [Parameter Object](https://spec.openapis.org/oas/v3.1.1.html#parameter-object), [Components Object](https://spec.openapis.org/oas/v3.1.1.html#components-object).

```ts
({ $ref: '#/components/schemas/Pet' }) satisfies SchemaObject;

({
  schema: { $ref: '#/components/schemas/Address' },
}) satisfies MediaTypeObject;

({
  name: 'petId',
  in: 'path',
  required: true,
  schema: { $ref: '#/components/schemas/PetId' },
}) satisfies ParameterObject;

({
  schemas: {
    Pet: { $ref: '#/components/schemas/Animal' },
  },
}) satisfies ComponentsObject;
```

#### 3. `$ref` may have sibling keywords

JSON Schema 2019-09+ evaluates `$ref` as an applicator; siblings are allowed. OAS 3.1 inherits that. The object matches neither `ReferenceObject` (only `$ref` / `summary` / `description`) nor `SchemaObject` (no `$ref`).

Spec: [Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object), [JSON Schema `$ref`](https://json-schema.org/draft/2020-12/json-schema-core.html#name-direct-references-with-ref).

```ts
({
  $ref: '#/components/schemas/Pet',
  description: 'A pet',
  readOnly: true,
}) satisfies SchemaObject;

({
  $ref: '#/components/schemas/Pet',
  type: ['object', 'null'],
}) satisfies SchemaObject;
```

#### 4. `format` is an open annotation

`format` is restricted to `StringFormat` / `NumericFormat`. Custom values such as `slug` or the spec’s own `zip-code` example are rejected.

Spec: [Data Type Format](https://spec.openapis.org/oas/v3.1.1.html#data-type-format) (“Tools that do not recognize a specific `format` MAY default back to the `type` alone”), [Format Registry](https://spec.openapis.org/registry/format/), [JSON Schema `format`](https://json-schema.org/draft/2020-12/json-schema-validation.html#name-defined-formats), [Working With Examples](https://spec.openapis.org/oas/v3.1.1.html#working-with-examples) (`format: zip-code`).

```ts
({ type: 'string', format: 'slug' }) satisfies SchemaObject;

({ type: 'string', format: 'zip-code' }) satisfies SchemaObject;
```

#### 5. Keywords for another instance type may still be present

`properties` exists only on `type: 'object'` (and the multi-type array form); array keywords only on `type: 'array'`. A string schema with `properties` does not type-check.

JSON Schema keywords constrain instances of a given type; they are not forbidden on other schemas. OAS: keywords “do NOT implicitly require the expected type”, and the Schema Object “supports keywords from any other vocabularies, or entirely arbitrary properties.”

Spec: [Data Types](https://spec.openapis.org/oas/v3.1.1.html#data-types), [Schema Object](https://spec.openapis.org/oas/v3.1.1.html#schema-object).

```ts
({
  type: 'string',
  properties: { ignored: { type: 'string' } },
}) satisfies SchemaObject;

({
  type: 'array',
  items: { type: 'string' },
  additionalProperties: false,
}) satisfies SchemaObject;
```

Boolean schemas (`true` / `false`) are modeled correctly and are not part of this report.

<details>
<summary>Copy/paste TypeScript reproduction</summary>

Save as `repro.ts` next to `@scalar/openapi-types@0.9.5` and run `tsc --noEmit --strict repro.ts`. Every `satisfies` below is valid OAS 3.1 and should type-check; each currently fails.

```ts
import type {
  ComponentsObject,
  MediaTypeObject,
  ParameterObject,
  SchemaObject,
} from '@scalar/openapi-types/3.1';

// 1. JSON Schema core keywords are missing from SchemaObject
export const coreKeywords = {
  $id: 'https://example.com/schemas/pet',
  $anchor: 'Pet',
  $comment: 'reusable pet schema',
  $schema: 'https://spec.openapis.org/oas/3.1/dialect/base',
  type: 'object',
} satisfies SchemaObject;

export const dynamicAnchor = {
  $dynamicAnchor: 'T',
  type: 'object',
} satisfies SchemaObject;

export const dynamicRef = {
  $dynamicRef: '#T',
} satisfies SchemaObject;

// 2. $ref is a Schema Object keyword, not only ReferenceObject
export const schemaRef = {
  $ref: '#/components/schemas/Pet',
} satisfies SchemaObject;

export const mediaTypeSchemaRef = {
  schema: { $ref: '#/components/schemas/Address' },
} satisfies MediaTypeObject;

export const parameterSchemaRef = {
  name: 'petId',
  in: 'path',
  required: true,
  schema: { $ref: '#/components/schemas/PetId' },
} satisfies ParameterObject;

export const componentsSchemaRef = {
  schemas: {
    Pet: { $ref: '#/components/schemas/Animal' },
  },
} satisfies ComponentsObject;

// 3. $ref may have sibling keywords
export const refWithSiblings = {
  $ref: '#/components/schemas/Pet',
  description: 'A pet',
  readOnly: true,
} satisfies SchemaObject;

export const refWithNullableType = {
  $ref: '#/components/schemas/Pet',
  type: ['object', 'null'],
} satisfies SchemaObject;

// 4. format is an open annotation
export const customFormat = {
  type: 'string',
  format: 'slug',
} satisfies SchemaObject;

export const specExampleFormat = {
  type: 'string',
  format: 'zip-code',
} satisfies SchemaObject;

// 5. Keywords for another instance type may still be present
export const stringWithProperties = {
  type: 'string',
  properties: { ignored: { type: 'string' } },
} satisfies SchemaObject;

export const arrayWithAdditionalProperties = {
  type: 'array',
  items: { type: 'string' },
  additionalProperties: false,
} satisfies SchemaObject;
```

</details>

---

### What did you expect to happen?

`SchemaObject` should accept any OAS 3.1 Schema Object, including JSON Schema 2020-12 core keywords (`$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$dynamicRef`, `$ref`, `$comment`), `$ref` with siblings, open `format` strings, and keywords that do not apply to the declared `type`.

Fields whose spec type is Schema Object (`MediaTypeObject.schema`, parameter `schema`, `components.schemas`, …) should not require a `ReferenceObject` union and should accept `{ $ref: '…' }` as a schema.

---

### OpenAPI Document

Not applicable — TypeScript types, not a rendered document. Use the collapsible reproduction above.
