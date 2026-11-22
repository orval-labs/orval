# Fetch with Valibot

This sample generates a `fetch` client from `petstore.yaml` twice, with
`schemas.type: 'valibot'` and `override.fetch.runtimeValidation: true`.

- `src/api/validated` validates responses in the generated client.
- `src/api/mutator` sends requests through `src/mutator/standard-schema-fetch.ts`.
  The mutator gets the schema as `schema` (`includeSchemaInArguments`) and
  validates the response through `~standard`, which also works with Effect
  schemas. It returns `{ data, status, headers }`.

The outputs differ for an error status. The validated output throws for any
JSON body that does not match the success schema, an error body included. The
mutator checks `response.ok` first and returns an error status as is.

```sh
vp run generate-api # regenerate src/api
vp run test         # type check and run the tests
```
