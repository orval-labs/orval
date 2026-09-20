import {
  dynamicImport,
  isObject,
  isString,
  isUrl,
  type ExternalRefNamingStrategy,
  type NormalizedOptions,
  type OpenApiDocument,
  type OverrideInput,
  type WriteSpecBuilder,
} from '@orval/core';
import { bundle, type Plugin } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
  readFiles,
} from '@scalar/json-magic/bundle/plugins/node';
import { upgrade, validate as validateSpec } from '@scalar/openapi-parser';
import { readFile } from 'node:fs/promises';
import nodePath from 'node:path';
import { isNullish } from 'remeda';
import jsYaml from 'js-yaml';

import { importOpenApi } from './import-open-api';
import { logger } from './logger';
import { getHeadersForUrl } from './utils/options';

interface ResolveSpecOptions {
  parserOptions?: NormalizedOptions['input']['parserOptions'];
  transformer?: OverrideInput['transformer'];
  workspace: string;
  unsafeDisableValidation?: boolean;
}

async function resolveSpec(
  input: string | Record<string, unknown>,
  {
    parserOptions,
    transformer,
    workspace,
    unsafeDisableValidation = false,
  }: ResolveSpecOptions,
): Promise<OpenApiDocument> {
  const allowedRefs = parserOptions?.externalRefs?.allow ?? [];
  const isWildcard = allowedRefs.includes('*');

  // Load the top-level spec so we can scan for external $refs before
  // bundle() resolves them. The top-level target is trusted (user-configured
  // input.target); only the $ref values inside the spec are untrusted.
  const { data: specData, origin } = await loadSpec(
    input,
    parserOptions?.headers,
  );

  const refScan = scanRefs(specData);

  // Enforce the allow-list on refs found in the top-level spec.
  // Transitive refs (inside external docs) are enforced by the loader wrappers.
  if (!isWildcard) {
    const disallowed = refScan.external.filter(
      (ref) => !isAllowedRef(ref, allowedRefs, origin),
    );
    if (disallowed.length > 0) {
      throw new Error(formatDisallowedRefsError(disallowed, allowedRefs));
    }
  } else {
    const docs = [...new Set(refScan.external.map(getRefDocument))];
    if (docs.length > 0) {
      logger.warn(
        `External $ref documents being resolved:\n` +
          docs.map((d) => `  - ${d}`).join('\n'),
      );
    }
  }

  // Bundling walks the whole document with an `await` per node and
  // dereferencing then deep-clones the result. Neither changes anything when
  // every `$ref` is already a local JSON pointer, so skip both — on a large
  // spec without external refs that is the bulk of the parsing cost (#3805).
  const dereferencedData = refScan.needsBundling
    ? await bundleAndDereferenceExternalRefs(
        specData,
        parserOptions,
        origin,
        isWildcard,
        allowedRefs,
      )
    : specData;

  // Apply user-provided transformer before validation so users can repair
  // malformed specs in-place. The transformer is typed against
  // `OpenApiDocument`, but we pass the raw bundled object — repairing a spec
  // necessarily means it does not yet conform to the type at call time.
  let transformedData = dereferencedData;
  if (transformer) {
    const applied = await applyInputTransformer(
      dereferencedData,
      transformer,
      workspace,
    );
    // A transformer may inject NEW external $refs that were absent from the
    // original spec (e.g. `refs.yaml#/...`), so the initial bundle never
    // resolved them. Re-run the bundle + dereference pipeline on its output so
    // those refs are resolved too (#3327). External refs resolve relative to
    // the original spec file, so reuse the string target as the bundle origin;
    // an object input has no file base and cannot introduce relative refs.
    transformedData = scanRefs(applied).needsBundling
      ? await bundleAndDereferenceExternalRefs(
          applied,
          parserOptions,
          origin,
          isWildcard,
          allowedRefs,
        )
      : applied;
  }

  if (unsafeDisableValidation) {
    logger.warn(
      `OpenAPI spec validation is disabled.\n` +
        `  Code generation with invalid specs is not guaranteed to work and may break in minor updates.\n` +
        `  Bug reports with validation disabled will not be accepted.`,
    );
  } else {
    validateComponentKeys(transformedData);

    const { valid, errors } = await validateSpec(transformedData);
    if (!valid) {
      throw new Error(
        `OpenAPI spec validation failed:\n${JSON.stringify(errors, undefined, 2)}`,
      );
    }
  }

  // The upgrader converts Swagger 2.0 `formData` parameters into a
  // `requestBody` schema but drops the `items` of array-typed parameters,
  // which would degrade generated types from e.g. `string[]` to `unknown[]`
  // (#3857). Capture the item schemas before upgrading (the upgrader also
  // mutates its input, so `swagger: '2.0'` is gone afterwards) and re-apply
  // them to the upgraded document.
  const formDataItems = isSwagger2(transformedData)
    ? collectSwagger2FormDataItems(transformedData)
    : undefined;

  // Normalize invalid OpenAPI 3.0 nullable references into a valid 3.1 form.
  // A `$ref` with a sibling `nullable: true` is out of spec: per the Reference
  // Object rules, sibling properties on a `$ref` are ignored, so `nullable` has
  // no effect. Many specs still use it to mean `Pet | null`. Rewrite
  // `{ $ref, nullable: true }` to `{ anyOf: [$ref, { type: 'null' }] }` and warn
  // so users know their spec was non-conformant (#3714).
  //
  // Runs *before* `upgrade()`: as of @scalar/openapi-upgrader@0.2.13 the
  // upgrader performs the same rewrite itself, silently. Leaving this after the
  // upgrade would find nothing left to rewrite and drop the diagnostic, so it
  // goes first and the upgrader finds the case already handled. Validation has
  // already run above, so the validator still sees the document as authored,
  // and bundling and dereferencing are done, so the warning fires once per
  // source occurrence rather than once per dereference site.
  transformedData = normalizeNullableRefs(
    transformedData,
  ) as typeof transformedData;

  const upgraded = upgrade(transformedData);
  let specification = upgraded.specification;

  // upgrade() returns @scalar/openapi-types/3.1 Document (openapi: string);
  // OpenApiDocument uses the legacy OpenAPIV3_1 namespace (openapi version literals).
  if (formDataItems && formDataItems.size > 0) {
    specification = restoreSwagger2FormDataItems(specification, formDataItems);
  }

  // Close the OpenAPI 3.0 syntax the upgrader leaves behind, so what reaches
  // `importOpenApi` is fully 3.1-shaped (#4115). Runs last so the schemas
  // restored above are normalized too.
  specification = normalizeToOpenApi31(specification) as typeof specification;

  return specification as OpenApiDocument;
}

// ─── Invalid nullable $ref normalization (#3714) ───────────────────────────

/**
 * Per the OpenAPI Reference Object rules, sibling properties on a `$ref` are
 * ignored — so `{ $ref, nullable: true }` does NOT mean `Pet | null`. Many
 * 3.0 specs still emit it that way. Rewrite such nodes into the valid 3.1 form
 * `{ anyOf: [$ref, { type: 'null' }] }` and warn with the JSON Pointer path so
 * users learn their spec was non-conformant.
 *
 * Honoring the author's evident intent that way is a choice, not a reading of
 * the spec, and it is made everywhere the intent can survive into the emitted
 * type. The one place it cannot is a direct member of an `allOf` whose null
 * branch the rest of the intersection already absorbs — `null & { marker?: string }`
 * is `never`, so the branch is inert whether it is emitted or not. There the
 * sibling is dropped instead. Note that this depends on there *being* something
 * to absorb it: `allOf: [{ $ref, nullable: true }]` on its own is still
 * `Base | null`, and is rewritten like any other position. See
 * `absorbsNullBranch` and the two branches below.
 *
 * Runs before `upgrade()`, which since @scalar/openapi-upgrader@0.2.13 applies
 * the same rewrite without reporting it, and after bundling, so the warning
 * fires once per occurrence rather than once per dereference site.
 */
export function normalizeNullableRefs(
  spec: unknown,
  path: string[] = [],
  nullAbsorbed: boolean = false,
): unknown {
  if (Array.isArray(spec)) {
    return spec.map((item, i) =>
      normalizeNullableRefs(item, [...path, String(i)], false),
    );
  }

  if (!isObject(spec)) {
    return spec;
  }

  const obj = spec as Record<string, unknown>;

  // A direct `allOf` member whose null branch something else in the intersection
  // already absorbs (see `absorbsNullBranch`): drop the sibling instead of
  // rewriting it. Not because it means any less here than elsewhere — it is out
  // of spec in both positions — but because the union cannot survive this one.
  // `null & { marker?: string }` is `never`, so `(Base | null) & { marker?: string }`
  // and `Base & { marker?: string }` are the same type; the null branch is inert
  // whether it is emitted or not.
  //
  // Emitting it anyway costs something real: orval reads through `allOf` members
  // to collect the keys a schema guarantees, and an
  // `{ anyOf: [$ref, { type: 'null' }] }` member hides them, degrading
  // `Pick<Wrapper, 'id'>` to `Pick<Wrapper, Extract<keyof Wrapper, 'id'>>`. The
  // upgrader applies its rewrite with no `allOf` guard as of
  // @scalar/openapi-upgrader@0.2.13, so strip it here and hand it a plain
  // `$ref`.
  if (nullAbsorbed && isNullableRef(obj)) {
    delete obj.nullable;
  }

  // Every other position: below an `allOf` member, at a plain property, or in an
  // `allOf` with nothing to absorb the null (a lone member, or members that are
  // all themselves nullable). Here the union does survive into the emitted type,
  // so the rewrite is the only way to keep the `| null` the author meant, and it
  // is worth warning about (#3714).
  if (!nullAbsorbed && isNullableRef(obj)) {
    const ref = obj.$ref as string;
    delete obj.nullable;
    delete obj.$ref;
    const jsonPointer = '#/' + path.join('/');
    logger.warn(
      `Invalid nullable reference found at ${jsonPointer}.\n` +
        `  A \`$ref\` with a sibling \`nullable: true\` is out of spec (siblings on a reference are ignored).\n` +
        `  Treating it as \`${ref} | null\` by rewriting to \`anyOf: [\`$ref\`, { type: "null" }]\`.\n` +
        `  Fix the source spec with \`nullable: true\` + \`allOf: [$ref]\` (OpenAPI 3.0) or\n` +
        `  \`anyOf: [$ref, { type: "null" }]\` (OpenAPI 3.1).`,
    );
    return {
      anyOf: [{ $ref: ref }, { type: 'null' }],
      ...obj,
    };
  }

  // `nullAbsorbed` is set only for the direct members of a real `allOf` array,
  // and only when the intersection has something to absorb the null with. It is
  // cleared for every other key, so a `$ref` further down — in a member's
  // `properties`, for instance — takes the ordinary rewrite above. The
  // `Array.isArray` check matters: a schema may have a *property* called
  // `allOf`, which is an ordinary property and not a composition.
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'allOf' && Array.isArray(value)) {
      const absorbed = absorbsNullBranch(obj, value);
      obj[key] = value.map((member, i) =>
        normalizeNullableRefs(member, [...path, key, String(i)], absorbed),
      );
      continue;
    }

    obj[key] = normalizeNullableRefs(value, [...path, key], false);
  }

  return obj;
}

/** A ReferenceObject carrying the out-of-spec `nullable: true` sibling. */
function isNullableRef(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    '$ref' in obj &&
    isString(obj.$ref) &&
    (obj.nullable as boolean | undefined) === true
  );
}

/**
 * Whether the null branch of a nullable `$ref` member is absorbed by the rest of
 * the intersection, which is the only thing that makes dropping it lossless.
 *
 * `allOf` is an intersection, so the branch dies only when something else in it
 * cannot be null — `null & { marker?: string }` is `never`. That something can
 * come from either side: another member of the array, or the enclosing schema's
 * own constraints, since `{ type: 'object', properties: {...}, allOf: [...] }` is
 * itself an intersection of the two (`NullableParentWrapper` in
 * regressions.yaml). With neither — a lone `allOf: [{ $ref, nullable: true }]`,
 * or members that are all themselves nullable — the null survives and has to be
 * kept.
 *
 * The check is deliberately syntactic: a bare `$ref` is not followed, so
 * `allOf: [{ $ref: A, nullable: true }, { $ref: B }]` keeps the union even though
 * `B` is usually a non-nullable object. That errs toward emitting a union that
 * was not strictly needed, which is at worst noisier. Erring the other way would
 * silently delete a `| null` the API can really return.
 */
function absorbsNullBranch(
  enclosing: Record<string, unknown>,
  members: unknown[],
): boolean {
  return (
    isNonNullableObjectSchema(enclosing) ||
    members.some((member) => isNonNullableObjectSchema(member))
  );
}

function isNonNullableObjectSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if ((obj.nullable as boolean | undefined) === true) {
    return false;
  }
  return 'properties' in obj || obj.type === 'object';
}

// ─── Residual OpenAPI 3.0 syntax normalization (#4115) ─────────────────────

/**
 * What kind of node the traversal is standing on.
 *
 * Everything this pass rewrites is a Schema Object keyword, so the rules may
 * only run on a `schema`. The distinction matters in both directions: a key
 * spelled `nullable` is a keyword on a schema but a member name inside
 * `properties`, and a key spelled `default` is a data value on a schema but a
 * status code inside `responses`. Tracking the kind structurally, rather than
 * guessing from the spelling of a path segment, is the only way to tell them
 * apart — a schema can have a property named `content`, `responses` or
 * `example` just as legitimately as it can have one named `id`.
 */
type NodeKind =
  /** A Schema Object. The rules below apply here and nowhere else. */
  | 'schema'
  /** A map of names to Schema Objects (`properties`, `$defs`, `schemas`). */
  | 'schemaMap'
  /** A map of names to non-schema OpenAPI objects (`responses`, `content`). */
  | 'oasMap'
  /** A Link Object, whose `parameters` and `requestBody` hold literal values. */
  | 'link'
  /** Any other OpenAPI object, whose field names are fixed by the spec. */
  | 'oas';

/** Schema keywords holding a map of named subschemas. */
const SCHEMA_MAP_KEYWORDS = new Set([
  '$defs',
  'definitions',
  'dependentSchemas',
  'patternProperties',
  'properties',
]);

/** Schema keywords holding a subschema, or an array of them. */
const SUBSCHEMA_KEYWORDS = new Set([
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'contains',
  'else',
  'if',
  'items',
  'not',
  'oneOf',
  'prefixItems',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
]);

/**
 * OpenAPI fields holding a map keyed by an arbitrary name — a status code, a
 * media type, a header name, a path. Their keys are never keywords, so a
 * `default` response or a header called `example` must still be traversed.
 */
const OAS_MAP_KEYWORDS = new Set([
  'callbacks',
  'content',
  'encoding',
  'headers',
  'links',
  'mapping',
  'parameters',
  'pathItems',
  'paths',
  'requestBodies',
  'responses',
  'scopes',
  'securitySchemes',
  'variables',
  'webhooks',
]);

/**
 * Schema keywords whose value is arbitrary user data. Nothing below them may be
 * rewritten: an `example` payload that happens to carry a `nullable` key is
 * data the API really returns, not 3.0 syntax.
 */
const SCHEMA_DATA_KEYWORDS = new Set([
  'const',
  'default',
  'enum',
  'example',
  'examples',
]);

/**
 * The same, for the non-schema objects that also carry data: a Parameter,
 * Header or Media Type Object has `example`/`examples`, and
 * `components/examples` is a map of Example Objects that holds no schemas.
 */
const OAS_DATA_KEYWORDS = new Set(['example', 'examples']);

/**
 * The same, for a Link Object. The spec types both of these as
 * `Any | {expression}` — the literal value or runtime expression to send when
 * following the link, not an OpenAPI object. `parameters` in particular is a map
 * of names to values, unlike `parameters` everywhere else in the document.
 *
 * @see https://spec.openapis.org/oas/v3.1.2.html#link-object
 */
const LINK_DATA_KEYWORDS = new Set(['parameters', 'requestBody']);

/** The `format` values 3.1 replaced with `contentMediaType`/`contentEncoding`. */
const CONTENT_FORMATS = new Set(['base64', 'binary', 'byte']);

/**
 * Keywords that make a typeless schema something other than a plain string, so
 * {@link inferStringForContentKeywords} leaves it alone.
 */
const NON_STRING_ASSERTIONS = new Set([
  '$ref',
  '$dynamicRef',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'enum',
  'const',
  'properties',
  'patternProperties',
  'additionalProperties',
  'items',
  'prefixItems',
]);

/**
 * Close the OpenAPI 3.0 syntax `upgrade()` leaves behind, so the document handed
 * to `importOpenApi` is fully 3.1-shaped (#4115).
 *
 * `@scalar/openapi-upgrader` bails out of its `nullable` rewrite whenever there
 * is no sibling `type`, `$ref` or `allOf` to attach the null to — its own source
 * says so: *"Otherwise there is nothing for `nullable` to attach to, so leave the
 * schema untouched."* That leaves `nullable` sitting next to `enum`, `anyOf` and
 * `oneOf`. Two further gaps are consequences of the order its own rules run in,
 * and one is the upgrader early-returning on a document that already declares
 * 3.1 while still carrying 3.0 syntax:
 *
 * - it widens `type` to `[T, 'null']` without widening a sibling `enum`, and the
 *   two combine with AND — so `{ type: 'string', enum: ['a'], nullable: true }`
 *   comes back admitting only `'a'`, with the author's `null` gone and the
 *   `'null'` in `type` unreachable;
 * - having widened `type` into an array, its `format: binary | base64 | byte`
 *   handling no longer matches (it tests `type === 'string'`), so those formats
 *   survive on nullable string unions;
 * - a document declaring `3.1` is skipped wholesale, so every 3.0 keyword in one
 *   reaches us untouched.
 * - from 0.2.16 it writes `contentMediaType`/`contentEncoding` in place of a
 *   `format` but drops the `type: 'string'` that carried it, leaving a part
 *   that describes a string with no type at all (#4157).
 *
 * Every rule below therefore stands on its own rather than assuming the upgrader
 * already handled anything with a `type`.
 *
 * Runs *after* `upgrade()`, unlike {@link normalizeNullableRefs}, which has to go
 * first to keep its diagnostic. Nothing here warns: these specs were valid 3.0,
 * and the loss is the upgrader's, not the author's.
 *
 * @param spec - Node to normalize, mutated in place where possible.
 * @param kind - What `spec` is. Defaults to a whole OpenAPI document; pass
 *   `'schema'` to normalize a bare Schema Object.
 */
export function normalizeToOpenApi31(
  spec: unknown,
  kind: NodeKind = 'oas',
): unknown {
  return normalizeNode(spec, { kind });
}

interface NodeContext {
  kind: NodeKind;
  /** The keyword that introduced an `oasMap`, which decides what its members are. */
  mapKeyword?: string;
  /** Media type of the enclosing Media Type Object, for `format: 'byte'`. */
  mediaType?: string;
}

function normalizeNode(node: unknown, context: NodeContext): unknown {
  if (Array.isArray(node)) {
    const memberContext = arrayMemberContext(context);
    return node.map((item) => normalizeNode(item, memberContext));
  }

  if (!isObject(node)) {
    return node;
  }

  // The rules are Schema Object keywords, so they run on a schema and nowhere
  // else. On a map of names they would consume member names: a property called
  // `nullable` is a field the API has, not a keyword to resolve.
  const obj =
    context.kind === 'schema'
      ? normalizeSchemaNode(node as Record<string, unknown>, context.mediaType)
      : (node as Record<string, unknown>);

  for (const [key, value] of Object.entries(obj)) {
    if (holdsData(context.kind, key)) {
      continue;
    }
    obj[key] = normalizeNode(value, childContext(context, key));
  }

  return obj;
}

/**
 * Whether `key` names arbitrary user data rather than a schema. Only true where
 * the key is really a keyword — inside a map the same word is a name, which is
 * what keeps a `default` response and a header called `example` reachable.
 */
function holdsData(kind: NodeKind, key: string): boolean {
  // A map's keys are names, so one may legitimately be spelled like a keyword —
  // a `default` response, a property called `x-legacy-id`, a header called
  // `x-request-id`. The schemas under those all have to stay reachable.
  if (kind === 'schemaMap' || kind === 'oasMap') {
    return false;
  }

  if (isExtension(key)) {
    return true;
  }

  switch (kind) {
    case 'schema': {
      return SCHEMA_DATA_KEYWORDS.has(key);
    }
    case 'link': {
      return LINK_DATA_KEYWORDS.has(key);
    }
    default: {
      return OAS_DATA_KEYWORDS.has(key);
    }
  }
}

/**
 * Whether `key` is a Specification Extension.
 *
 * An extension's value is explicitly unrestricted, so it is the user's data and
 * not ours to rewrite — even when it happens to be schema-shaped. Nothing orval
 * reads out of an extension is a schema: `x-enumNames`, `x-enum-varnames` and
 * `x-enumDescriptions` hold arrays of strings, `x-codegen-request-body-name`
 * holds a string, `x-orval-property-overrides` is written by the Zod generator
 * well after this pass, and `x-ext` is consumed and removed by
 * `dereferenceExternalRef` before the upgrade runs.
 */
function isExtension(key: string): boolean {
  return key.startsWith('x-');
}

/** What the members of an array at this position are. */
function arrayMemberContext(context: NodeContext): NodeContext {
  switch (context.kind) {
    // `allOf` and friends arrive here already marked as schema positions.
    case 'schema':
    case 'schemaMap': {
      return { ...context, kind: 'schema' };
    }
    // `parameters` is an array on an Operation and a map under `components`;
    // either way its members are Parameter Objects.
    default: {
      return { ...context, kind: 'oas' };
    }
  }
}

/** What the value held under `key` is, given what the current node is. */
function childContext(context: NodeContext, key: string): NodeContext {
  switch (context.kind) {
    case 'schemaMap': {
      return { ...context, kind: 'schema' };
    }

    case 'oasMap': {
      switch (context.mapKeyword) {
        // A Content Object is keyed by media type, which `format: 'byte'` needs.
        // It stays on the context so a schema nested below still sees it.
        case 'content': {
          return { kind: 'oas', mediaType: key };
        }
        case 'links': {
          return { ...context, kind: 'link', mapKeyword: undefined };
        }
        default: {
          return { ...context, kind: 'oas', mapKeyword: undefined };
        }
      }
    }

    case 'schema': {
      if (SCHEMA_MAP_KEYWORDS.has(key)) {
        return { ...context, kind: 'schemaMap', mapKeyword: undefined };
      }
      if (SUBSCHEMA_KEYWORDS.has(key)) {
        return { ...context, kind: 'schema', mapKeyword: undefined };
      }
      // `discriminator`, `xml`, `externalDocs`: no schemas of their own, and not
      // data either.
      return { ...context, kind: 'oas', mapKeyword: undefined };
    }

    // An `oas` node and a `link` choose their children the same way. A Link's
    // own data fields never reach here — `holdsData` has already skipped them —
    // so all that is left of one is `server`.
    default: {
      if (key === 'schema') {
        return { ...context, kind: 'schema', mapKeyword: undefined };
      }
      if (key === 'schemas') {
        return { ...context, kind: 'schemaMap', mapKeyword: undefined };
      }
      if (OAS_MAP_KEYWORDS.has(key)) {
        return { ...context, kind: 'oasMap', mapKeyword: key };
      }
      return { ...context, kind: 'oas', mapKeyword: undefined };
    }
  }
}

/** Apply every 3.0-residue rule to one schema. May return a replacement node. */
function normalizeSchemaNode(
  obj: Record<string, unknown>,
  mediaType: string | undefined,
): Record<string, unknown> {
  const withoutNullable = resolveNullable(obj);
  widenEnumForNullableType(withoutNullable);
  convertContentFormat(withoutNullable, mediaType);
  inferStringForContentKeywords(withoutNullable);
  normalizeExclusiveBounds(withoutNullable);
  return withoutNullable;
}

/**
 * Attach a `nullable: true` to whatever sits beside it, in the 3.1 form for that
 * shape, and remove the keyword either way — 3.1 has no `nullable`, so leaving it
 * is never right.
 *
 * `allOf` is the one shape that cannot simply gain a `{ type: 'null' }` member:
 * `allOf` is an intersection, so null intersected with the rest is `never` and
 * the schema would admit nothing. It has to be wrapped in a union instead.
 */
function resolveNullable(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  if (!('nullable' in obj)) {
    return obj;
  }

  const nullable = obj.nullable === true;
  delete obj.nullable;

  if (!nullable) {
    return obj;
  }

  // A sibling `type` takes the null directly, as a type union.
  if (obj.type !== undefined) {
    const members = Array.isArray(obj.type) ? obj.type : [obj.type];
    obj.type = members.includes('null') ? members : [...members, 'null'];
    return obj;
  }

  // A reference cannot carry the null itself, so the union moves outside it.
  // `$dynamicRef` resolves at validation time and behaves the same way here.
  const refKey = isString(obj.$ref)
    ? '$ref'
    : isString(obj.$dynamicRef)
      ? '$dynamicRef'
      : undefined;
  if (refKey) {
    const ref = obj[refKey];
    delete obj[refKey];
    return { ...obj, anyOf: [{ [refKey]: ref }, { type: 'null' }] };
  }

  // A union just gains a null branch.
  for (const key of ['anyOf', 'oneOf'] as const) {
    const branches = obj[key];
    if (Array.isArray(branches)) {
      if (!branches.some(isNullBranch)) {
        branches.push({ type: 'null' });
      }
      return obj;
    }
  }

  // An intersection has to be wrapped, never appended to. A single member is
  // unwrapped so the union reads `anyOf: [<member>, { type: 'null' }]`, matching
  // what the upgrader emits for the same shape.
  if (Array.isArray(obj.allOf)) {
    const { allOf, ...rest } = obj;
    const base = allOf.length === 1 ? allOf[0] : { allOf };
    return { ...rest, anyOf: [base, { type: 'null' }] };
  }

  // A bare `enum` carries the null as a member: with no sibling `type` the enum
  // is the whole constraint.
  if (Array.isArray(obj.enum)) {
    if (!obj.enum.includes(null)) {
      obj.enum.push(null);
    }
    return obj;
  }

  // Nothing to attach to. Dropping the keyword loses nothing: a schema with no
  // `type` already admits every type, `null` included.
  return obj;
}

/**
 * Repair the widening `upgrade()` does by halves. `type` and `enum` combine with
 * AND, so a type union admitting null next to an enum that does not list it
 * makes the null unreachable — which is never what the author of the 3.0 spec
 * wrote, since `nullable: true` is the only way that pairing arises.
 */
function widenEnumForNullableType(obj: Record<string, unknown>): void {
  if (
    Array.isArray(obj.type) &&
    obj.type.includes('null') &&
    Array.isArray(obj.enum) &&
    !obj.enum.includes(null)
  ) {
    obj.enum.push(null);
  }
}

/**
 * Apply the 3.1 replacements for the string `format`s that became content
 * keywords. The upgrader does this too, but only for a bare `type: 'string'`,
 * and its own `nullable` rule has already turned that into `['string', 'null']`
 * by the time the check runs.
 */
function convertContentFormat(
  obj: Record<string, unknown>,
  mediaType: string | undefined,
): void {
  if (!isString(obj.format) || !CONTENT_FORMATS.has(obj.format)) {
    return;
  }

  const types = Array.isArray(obj.type) ? obj.type : [obj.type];
  if (!types.includes('string')) {
    return;
  }

  const format = obj.format;
  delete obj.format;

  if (format === 'binary') {
    obj.contentMediaType = 'application/octet-stream';
    return;
  }

  obj.contentEncoding = 'base64';

  // `byte` was base64 *of* the surrounding media type, so carry that over when
  // the schema sits under a Media Type Object.
  if (format === 'byte' && mediaType !== undefined) {
    obj.contentMediaType = mediaType;
  }
}

/**
 * Give a schema that carries only `contentMediaType`/`contentEncoding` the
 * `type: 'string'` those keywords describe (#4157).
 *
 * Both are string-only annotations — JSON Schema says they are ignored for any
 * other instance type — so a schema asserting one and no `type` describes a
 * string, and reading it as "any type" is what made the field come out
 * `unknown`. `@scalar/openapi-upgrader` produces exactly that shape from
 * `>= 0.2.16`: converting a Swagger 2.0 `type: file` parameter, or any
 * `{ type: 'string', format: 'binary' }`, it writes the content keyword and
 * drops the `type` that carried it. orval's binary detection is gated on a
 * string-like `type`, so the part lost its `Blob | File` in the model, its
 * `instanceof Blob` in the zod and effect validators, and its file value in
 * the mocks.
 *
 * Only a schema that asserts nothing else is narrowed. A `$ref` or a
 * composition carrying a content keyword describes whatever the reference or
 * the branches describe, and object/array keywords say outright that the
 * instance is not a string; annotating `type` there would drop members the
 * spec admits, so those are left as authored.
 */
function inferStringForContentKeywords(obj: Record<string, unknown>): void {
  if (obj.type !== undefined) {
    return;
  }

  if (!isString(obj.contentMediaType) && !isString(obj.contentEncoding)) {
    return;
  }

  for (const keyword of NON_STRING_ASSERTIONS) {
    if (keyword in obj) {
      return;
    }
  }

  obj.type = 'string';
}

/**
 * 3.0's boolean `exclusiveMinimum`/`exclusiveMaximum` modified a sibling
 * `minimum`/`maximum`; 3.1's holds the bound itself. The upgrader converts them,
 * but assigns `schema.minimum` unconditionally — so a spec with the flag and no
 * bound ends up with the key present and holding `undefined`, which is still not
 * a valid 3.1 schema.
 */
function normalizeExclusiveBounds(obj: Record<string, unknown>): void {
  for (const [flag, bound] of [
    ['exclusiveMinimum', 'minimum'],
    ['exclusiveMaximum', 'maximum'],
  ] as const) {
    if (!(flag in obj)) {
      continue;
    }

    const value = obj[flag];

    if (value === true) {
      if (typeof obj[bound] === 'number') {
        obj[flag] = obj[bound];
      } else {
        delete obj[flag];
      }
      delete obj[bound];
      continue;
    }

    // `false` meant "not exclusive", so the sibling bound stands as written.
    // `undefined` is the upgrader's own leftover.
    if (value === false || value === undefined) {
      delete obj[flag];
    }
  }
}

function isNullBranch(value: unknown): boolean {
  return isObject(value) && (value as Record<string, unknown>).type === 'null';
}

// ─── Swagger 2.0 formData array items repair (#3857) ───────────────────────

/**
 * A capture of Swagger 2.0 `formData` array parameter item schemas, keyed by
 * path → method → parameter name. `@scalar/openapi-parser`'s `upgrade()`
 * rewrites `formData` parameters into a `requestBody.content` schema but does
 * not carry the parameter's `items` over, so array-typed fields would be
 * generated as `unknown[]` instead of e.g. `string[]`.
 */
type Swagger2FormDataItems = Map<
  string,
  Map<
    string,
    {
      byName: Map<string, Record<string, unknown>>;
      /** Path-level formData parameter names this operation overrides. */
      overriddenNames: Set<string>;
    }
  >
>;

/**
 * A stable identity for a parameter: `in` + `name`. Only string values
 * participate — a non-string `in`/`name` cannot dedupe against anything.
 */
function paramKey(
  param: unknown,
  resolveParameter: (p: unknown) => Record<string, unknown> | undefined,
): string | undefined {
  const resolved = resolveParameter(param);
  if (!resolved) return undefined;
  if (!isString(resolved.in) || !isString(resolved.name)) {
    return undefined;
  }
  return `${resolved.in}:${resolved.name}`;
}

function isSwagger2(document: Record<string, unknown>): boolean {
  return document.swagger === '2.0';
}

function collectSwagger2FormDataItems(
  document: Record<string, unknown>,
): Swagger2FormDataItems {
  const reusableParameters = isObject(document.parameters)
    ? (document.parameters as Record<string, unknown>)
    : {};

  const resolveParameter = (
    param: unknown,
  ): Record<string, unknown> | undefined => {
    if (!isObject(param)) {
      return undefined;
    }
    if ('$ref' in param && isString(param.$ref)) {
      const ref = param.$ref;
      if (!ref.startsWith('#/parameters/')) {
        return undefined;
      }
      const target = reusableParameters[ref.slice('#/parameters/'.length)];
      return isObject(target) ? target : undefined;
    }
    return param;
  };

  const formDataItems: Swagger2FormDataItems = new Map();
  const paths = isObject(document.paths) ? document.paths : {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;

    const pathLevelParams = Array.isArray(pathItem.parameters)
      ? pathItem.parameters
      : [];

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isObject(operation)) {
        continue;
      }
      const operationParams = Array.isArray(operation.parameters)
        ? operation.parameters
        : undefined;
      if (!operationParams && pathLevelParams.length === 0) {
        continue;
      }

      // Swagger 2.0 applies path-item parameters to every operation, with
      // operation-level parameters overriding path-level ones on the same
      // (name, in) pair — including a ref and its inline equivalent.
      const merged = mergePathAndOperationParameters(
        pathLevelParams,
        operationParams,
        resolveParameter,
      );

      const byName = new Map<string, Record<string, unknown>>();
      for (const rawParam of merged) {
        const param = resolveParameter(rawParam);
        if (!param || param.in !== 'formData' || !isObject(param.items)) {
          continue;
        }
        byName.set(String(param.name), param.items);
      }

      // Path-level formData parameters this operation overrides on the same
      // (name, in) key. Their effective items live in the operation's own
      // request body — never in the shared path-level body that other
      // operations may still use.
      const opKeys = new Set(
        (operationParams ?? [])
          .map((p) => paramKey(p, resolveParameter))
          .filter((k): k is string => k !== undefined),
      );
      const overriddenNames = new Set<string>();
      for (const rawParam of pathLevelParams) {
        const param = resolveParameter(rawParam);
        if (!param || param.in !== 'formData' || !isString(param.name)) {
          continue;
        }
        const key = paramKey(rawParam, resolveParameter);
        if (key !== undefined && opKeys.has(key)) {
          overriddenNames.add(param.name);
        }
      }

      if (byName.size > 0) {
        let methods = formDataItems.get(path);
        if (!methods) {
          methods = new Map();
          formDataItems.set(path, methods);
        }
        methods.set(method, { byName, overriddenNames });
      }
    }
  }

  return formDataItems;
}

/**
 * Merge path-item parameters into an operation's own parameters per Swagger 2.0
 * semantics: operation-level parameters override path-level ones with the same
 * (name, in) pair. `$ref`s are resolved (when possible) so a ref and its inline
 * equivalent dedupe against each other.
 */
function mergePathAndOperationParameters(
  pathLevel: unknown[],
  operationLevel: unknown[] | undefined,
  resolveParameter: (p: unknown) => Record<string, unknown> | undefined,
): unknown[] {
  const opKeys = new Set(
    (operationLevel ?? [])
      .map((p) => paramKey(p, resolveParameter))
      .filter((k): k is string => k !== undefined),
  );
  const kept = pathLevel.filter((p) => {
    const key = paramKey(p, resolveParameter);
    return key === undefined || !opKeys.has(key);
  });
  return [...kept, ...(operationLevel ?? [])];
}

/**
 * Re-apply captured Swagger 2.0 formData item schemas onto the upgraded
 * document. Only patches array-typed schema properties that the upgrader
 * left without an `items` key, so it never overrides anything the upgrader
 * already preserved.
 */
function restoreSwagger2FormDataItems<T extends Record<string, unknown>>(
  document: T,
  captured: Swagger2FormDataItems,
): T {
  const paths = isObject(document.paths) ? document.paths : {};

  // The upgrader promotes reusable formData parameters (`$ref` to
  // `#/parameters/...`) to `components.requestBodies` and leaves the
  // operation's `requestBody` as a `$ref` to them.
  const components = isObject(document.components) ? document.components : {};
  const requestBodies = isObject(components.requestBodies)
    ? (components.requestBodies as Record<string, unknown>)
    : {};

  const resolveRequestBody = (
    requestBody: unknown,
  ): Record<string, unknown> | undefined => {
    if (!isObject(requestBody)) {
      return undefined;
    }
    if ('$ref' in requestBody && isString(requestBody.$ref)) {
      const ref = requestBody.$ref;
      if (!ref.startsWith('#/components/requestBodies/')) {
        return undefined;
      }
      const target =
        requestBodies[ref.slice('#/components/requestBodies/'.length)];
      return isObject(target) ? target : undefined;
    }
    return requestBody;
  };

  const patchProperties = (
    requestBody: Record<string, unknown>,
    byName: Map<string, Record<string, unknown>>,
  ): void => {
    const content = requestBody.content;
    if (!isObject(content)) return;

    for (const mediaType of Object.values(content)) {
      if (!isObject(mediaType)) continue;
      const schema = mediaType.schema;
      if (!isObject(schema)) continue;
      const properties = schema.properties;
      if (!isObject(properties)) continue;

      for (const [paramName, items] of byName) {
        const property = properties[paramName];
        if (!isObject(property)) continue;

        const propType = property.type;
        const isArray =
          propType === 'array' ||
          (Array.isArray(propType) && propType.includes('array'));
        if (!isArray || property.items !== undefined) continue;

        // The captured item schema is a plain Items Object (a `$ref` is not
        // valid there in Swagger 2.0), so it can be assigned as-is.
        property.items = items;
      }
    }
  };

  for (const [path, methods] of captured) {
    const pathItem = paths[path];
    if (!isObject(pathItem)) continue;

    for (const [method, capture] of methods) {
      const operation = pathItem[method];
      if (!isObject(operation)) continue;

      const { byName, overriddenNames } = capture;
      // Bodies owned by the operation (its direct requestBody plus any refs in
      // its own parameters array) carry the effective, merged parameter set.
      const effectiveBodies = new Set<Record<string, unknown>>();
      const directBody = resolveRequestBody(operation.requestBody);
      if (directBody) {
        effectiveBodies.add(directBody);
      }
      for (const rawParam of Array.isArray(operation.parameters)
        ? operation.parameters
        : []) {
        const body = resolveRequestBody(rawParam);
        if (body) {
          effectiveBodies.add(body);
        }
      }
      for (const body of effectiveBodies) {
        patchProperties(body, byName);
      }

      // The Path Item's parameters reference shared request bodies that other
      // operations may also use. Patch only the names this operation does not
      // override; an overridden name lives in the operation's own body, and
      // writing its items here would corrupt the shared body for everyone else.
      const sharedByNames = new Map(
        [...byName].filter(([name]) => !overriddenNames.has(name)),
      );
      for (const rawParam of Array.isArray(pathItem.parameters)
        ? pathItem.parameters
        : []) {
        const body = resolveRequestBody(rawParam);
        if (body) {
          patchProperties(body, sharedByNames);
        }
      }
    }
  }

  return document;
}

async function applyInputTransformer(
  data: Record<string, unknown>,
  transformer: NonNullable<OverrideInput['transformer']>,
  workspace: string,
): Promise<Record<string, unknown>> {
  const transformerFn = await dynamicImport(transformer, workspace);
  const result: unknown = await transformerFn(
    data as unknown as OpenApiDocument,
  );
  if (!isObject(result)) {
    const source = isString(transformer)
      ? transformer
      : transformerFn.name || '<inline function>';
    throw new Error(
      `input.override.transformer must return an OpenAPI document object; ` +
        `got ${result === undefined ? 'undefined' : typeof result} from ${source}. ` +
        `Ensure your transformer returns the (possibly modified) spec.`,
    );
  }
  return result;
}

/**
 * Bundle external references into the document and then resolve the `x-ext`
 * entries that `@scalar/json-magic` produces. Shared by the initial pass and
 * the post-transformer pass (#3327); `origin` lets the second pass resolve refs
 * relative to the original spec file when the input is an in-memory object.
 */
async function bundleAndDereferenceExternalRefs(
  input: string | Record<string, unknown>,
  parserOptions: ResolveSpecOptions['parserOptions'],
  origin?: string,
  isWildcard = false,
  allowedExternalRefs: string[] = [],
): Promise<Record<string, unknown>> {
  const data = await bundle(input, {
    plugins: [
      createSafeFileLoader(origin, isWildcard, allowedExternalRefs),
      createSafeUrlLoader(
        origin,
        isWildcard,
        allowedExternalRefs,
        parserOptions?.headers,
      ),
      parseJson(),
      parseYaml(),
    ],
    treeShake: false,
    ...(parserOptions?.compress ? { compress: parserOptions.compress } : {}),
    ...(origin ? { origin } : {}),
  });
  return dereferenceExternalRef(
    data as Record<string, unknown>,
    parserOptions?.externalRefs?.strategy,
  );
}

// ─── External ref allow-list enforcement (GHSA-cxq5-97v7-87j8) ─────────────

/**
 * JSON_SCHEMA keeps YAML scalars as plain JSON values — without it js-yaml
 * coerces date-like strings such as `2026-01-27` into `Date` objects (#3947).
 * It also drops the `merge` type, so the `<<` merge key would survive into the
 * document as a literal property and the validator would reject it with
 * "Property << is not expected to be here" (#4102). Add `merge` back on top of
 * JSON_SCHEMA to keep both behaviours.
 *
 * js-yaml ships this exact type as `types.merge` but does not declare it in
 * `@types/js-yaml`, so it is redefined here; the loader keys the merge off the
 * tag name, not the type instance.
 */
const MERGE_KEY_TYPE = new jsYaml.Type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: (data: unknown) => data === '<<' || data === null,
});

const SPEC_YAML_SCHEMA = jsYaml.JSON_SCHEMA.extend({
  implicit: [MERGE_KEY_TYPE],
});

/**
 * Load the top-level spec into an inline object so we can scan it for external
 * `$ref`s before `bundle()` resolves them. The top-level target is trusted
 * (user-configured `input.target`); only `$ref` values inside the spec are
 * untrusted.
 */
function parseSpec(text: string): Record<string, unknown> {
  const result = parseSpecText(text);
  if (!isObject(result)) {
    throw new Error('OpenAPI spec must be a valid JSON/YAML object.');
  }
  return result as Record<string, unknown>;
}

/**
 * JSON is a strict subset of YAML, so a JSON document parses the same either
 * way — but `JSON.parse` is an order of magnitude faster than js-yaml on the
 * large documents orval is usually pointed at. Use the native parser whenever
 * the text looks like a JSON object, and fall back to YAML when it turns out
 * not to be one so that everything js-yaml accepts today keeps working (flow
 * mappings with unquoted keys, a comment after the opening `{`, ...).
 *
 * `trimStart()` also strips a leading BOM, which `JSON.parse` rejects.
 */
function parseSpecText(text: string): unknown {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not JSON after all — let js-yaml parse it (and report the error).
    }
  }
  return jsYaml.load(text, { schema: SPEC_YAML_SCHEMA });
}

async function loadSpec(
  input: string | Record<string, unknown>,
  headers?: NonNullable<ResolveSpecOptions['parserOptions']>['headers'],
): Promise<{ data: Record<string, unknown>; origin?: string }> {
  if (!isString(input)) {
    // An in-memory spec belongs to the caller, and everything downstream
    // (bundling, `upgrade()`, the nullable-$ref rewrite, ...) mutates the
    // document in place. Parsed inputs are freshly allocated here, so clone
    // only this one to give the pipeline a document it owns.
    return { data: structuredClone(input) };
  }
  if (isUrl(input)) {
    const response = await fetch(input, {
      headers: getHeadersForUrl(input, headers),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch OpenAPI spec from ${input}: ${response.status} ${response.statusText}`,
      );
    }
    return { data: parseSpec(await response.text()), origin: input };
  }
  return { data: parseSpec(await readFile(input, 'utf-8')), origin: input };
}

/**
 * Strip the JSON pointer fragment (`#/...`) from a `$ref` value, leaving only
 * the document target (file path or URL).
 */
function getRefDocument(ref: string): string {
  const hashIndex = ref.indexOf('#');
  return hashIndex === -1 ? ref : ref.slice(0, hashIndex);
}

/**
 * The result of a single pass over a spec looking for `$ref`s.
 */
interface RefScan {
  /**
   * Deduplicated external ref strings in their raw form (before fragment
   * stripping) — everything that does not start with `#`.
   */
  external: string[];
  /**
   * Whether the document holds any `$ref` that `bundle()` would act on. Plain
   * local JSON pointers (`#/...`) are returned untouched by the bundler, so a
   * document made only of those can skip the bundle + dereference pipeline
   * entirely. Anything else — an external target, or a local `$anchor`
   * reference such as `#Pet` — has to go through it.
   */
  needsBundling: boolean;
}

/**
 * Walk a spec object once and classify every `$ref` it contains.
 */
function scanRefs(obj: unknown): RefScan {
  const external = new Set<string>();
  let needsBundling = false;
  function walk(val: unknown) {
    if (Array.isArray(val)) {
      val.forEach(walk);
      return;
    }
    if (isObject(val)) {
      if ('$ref' in val && isString(val.$ref)) {
        if (!val.$ref.startsWith('#')) {
          external.add(val.$ref);
        }
        needsBundling ||= !val.$ref.startsWith('#/');
      }
      Object.values(val).forEach(walk);
    }
  }
  walk(obj);
  return { external: [...external], needsBundling };
}

/**
 * Resolve a ref document target (the part before `#`) to a canonical path or
 * URL, so it can be compared against allow-list entries that were resolved the
 * same way.
 */
function resolveRefTarget(ref: string, origin?: string): string {
  const doc = getRefDocument(ref);
  if (isUrl(doc)) return new URL(doc).href;
  if (origin && isUrl(origin)) {
    return new URL(doc, origin).href;
  }
  if (origin) {
    return nodePath.resolve(nodePath.dirname(origin), doc);
  }
  return nodePath.resolve(doc);
}

/**
 * Check whether a `$ref` is allowed by the user's allow-list. Both the ref and
 * the allow-list entries are resolved against the spec origin so that
 * `./schemas/pet.yaml` in the spec matches `./schemas/pet.yaml` in the config.
 */
function isAllowedRef(
  ref: string,
  allowedExternalRefs: string[],
  origin?: string,
): boolean {
  const resolved = resolveRefTarget(ref, origin);
  return allowedExternalRefs.some(
    (entry) => resolveRefTarget(entry, origin) === resolved,
  );
}

function formatDisallowedRefsError(
  disallowed: string[],
  currentAllowed: string[],
): string {
  const docs = [...new Set(disallowed.map(getRefDocument))];
  const all = [...new Set([...currentAllowed, ...docs])];
  const configSnippet = JSON.stringify(
    {
      input: {
        parserOptions: { externalRefs: { allow: all } },
      },
    },
    null,
    2,
  );
  return (
    `External $ref targets are not allowed by default.\n` +
    `Add them to your config, or use externalRefs.allow: ['*'] to allow all.\n\n` +
    `Disallowed refs:\n${disallowed.map((r) => `  - ${r}`).join('\n')}\n\n` +
    `Suggested config:\n${configSnippet}`
  );
}

/**
 * Wrap `readFiles()` so every file read is checked against the allow-list.
 * The top-level spec file (matching `origin`) is always allowed; subsequent
 * reads must match an explicit entry or the wildcard.
 */
function createSafeFileLoader(
  origin: string | undefined,
  isWildcard: boolean,
  allowedExternalRefs: string[],
) {
  const base = readFiles();
  return {
    type: 'loader' as const,
    validate: base.validate,
    async exec(value: string) {
      if (isWildcard) {
        return base.exec(value);
      }
      if (origin && nodePath.resolve(value) === nodePath.resolve(origin)) {
        return base.exec(value);
      }
      const isAllowed = isAllowedRef(value, allowedExternalRefs, origin);
      if (!isAllowed) {
        throw new Error(
          `Refused to read external file: ${value}\n` +
            `Add it to externalRefs.allow or use ['*'] to allow all.`,
        );
      }
      return base.exec(value);
    },
  };
}

/** Redirect hops to follow before giving up, matching common HTTP clients. */
const MAX_EXTERNAL_REF_REDIRECTS = 5;

/**
 * Whether a URL may be fetched: the top-level spec URL is always allowed, and
 * anything else has to match an explicit allow-list entry. Mirrors the check in
 * `createSafeUrlLoader.exec` so a redirect cannot reach somewhere the initial
 * `$ref` could not.
 */
function isFetchableUrl(
  url: string,
  origin: string | undefined,
  allowedExternalRefs: string[],
): boolean {
  if (origin && resolveRefTarget(url, origin) === resolveRefTarget(origin)) {
    return true;
  }
  return isAllowedRef(url, allowedExternalRefs, origin);
}

/**
 * The configured headers that apply to a URL's host.
 *
 * Mirrors the domain matching `fetchUrls` performs, so a hop is sent only the
 * headers the user configured for the host actually being contacted.
 */
function headersForUrl(
  url: string,
  headers?: { domains: string[]; headers: Record<string, string> }[],
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return undefined;
  }

  return headers.find((entry) => entry.domains.includes(host))?.headers;
}

/**
 * A `fetch` that follows redirects itself so every hop is allow-list checked.
 *
 * The global `fetch` follows redirects transparently, so an allowed URL could
 * answer `302` and send the request to a host the user never allowed — the
 * allow-list only ever saw the first URL (GHSA-jmpc-3jgr-j7jv). Resolving each
 * `Location` and re-checking it closes that.
 *
 * Headers are recomputed per hop rather than carried over. `fetchUrls` picks
 * them by domain for the *first* URL only, so reusing them would hand headers
 * configured for one host to whatever the redirect points at — and the global
 * `fetch` this replaces drops `Authorization` across origins by itself.
 */
function createAllowListCheckedFetch(
  origin: string | undefined,
  allowedExternalRefs: string[],
  headers?: { domains: string[]; headers: Record<string, string> }[],
) {
  return async (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response> => {
    let url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    for (let hop = 0; ; hop++) {
      const response = await fetch(url, {
        ...init,
        headers: headersForUrl(url, headers),
        redirect: 'manual',
      });

      const location = response.headers.get('location');
      const isRedirect =
        response.status >= 300 && response.status < 400 && location;
      if (!isRedirect) {
        return response;
      }

      if (hop >= MAX_EXTERNAL_REF_REDIRECTS) {
        throw new Error(
          `Refused to follow more than ${MAX_EXTERNAL_REF_REDIRECTS} redirects while fetching an external $ref (stopped at ${url}).`,
        );
      }

      const next = new URL(location, url).href;
      if (!isFetchableUrl(next, origin, allowedExternalRefs)) {
        // The loader swallows whatever this throws and reports only a generic
        // "reference may be invalid, inaccessible" error, so say plainly what
        // happened first — otherwise a blocked redirect is indistinguishable
        // from an unreachable server.
        logger.warn(
          `Refused to follow a redirect to a URL that is not allowed: ${next}\n` +
            `Reached by redirect from ${url}.\n` +
            `Add it to externalRefs.allow or use ['*'] to allow all.`,
        );
        throw new Error(
          `Refused to follow a redirect to a URL that is not allowed: ${next}`,
        );
      }

      url = next;
    }
  };
}

/**
 * Wrap `fetchUrls()` so every URL fetch is checked against the allow-list.
 * The top-level spec URL (matching `origin`) is always allowed; subsequent
 * fetches must match an explicit entry or the wildcard.
 */
function createSafeUrlLoader(
  origin: string | undefined,
  isWildcard: boolean,
  allowedExternalRefs: string[],
  headers?: { domains: string[]; headers: Record<string, string> }[],
): Plugin {
  const base = fetchUrls({
    headers,
    // With the wildcard every destination is permitted anyway, so leave the
    // default redirect handling in place.
    ...(isWildcard
      ? {}
      : {
          fetch: createAllowListCheckedFetch(
            origin,
            allowedExternalRefs,
            headers,
          ),
        }),
  });
  return {
    type: 'loader' as const,
    validate: base.validate,
    async exec(value: string) {
      if (isWildcard) {
        return base.exec(value);
      }
      const resolved = resolveRefTarget(value, origin);
      if (origin && resolved === resolveRefTarget(origin)) {
        return base.exec(value);
      }
      const isAllowed = isAllowedRef(value, allowedExternalRefs, origin);
      if (!isAllowed) {
        throw new Error(
          `Refused to fetch external URL: ${value}\n` +
            `Add it to externalRefs.allow or use ['*'] to allow all.`,
        );
      }
      return base.exec(value);
    },
  };
}

export async function importSpecs(
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
): Promise<WriteSpecBuilder> {
  const { input, output } = options;

  const spec = await resolveSpec(input.target, {
    parserOptions: input.parserOptions,
    transformer: input.override.transformer,
    workspace,
    unsafeDisableValidation: input.unsafeDisableValidation,
  });

  return importOpenApi({
    spec,
    input,
    output,
    target: isString(input.target) ? input.target : workspace,
    workspace,
    projectName,
  });
}

const COMPONENT_KEY_PATTERN = /^[a-zA-Z0-9.\-_]+$/;

const COMPONENT_SECTIONS = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'securitySchemes',
  'links',
  'callbacks',
  'pathItems', // OAS 3.1.0+
] as const;

/**
 * Validate that all component keys conform to the OAS regex: ^[a-zA-Z0-9.\-_]+$
 * @see https://spec.openapis.org/oas/v3.0.3.html#fixed-fields-5
 * @see https://spec.openapis.org/oas/v3.1.0#fixed-fields-5
 */
export function validateComponentKeys(data: Record<string, unknown>): void {
  const components = data.components;
  if (!isObject(components)) return;

  const invalidKeys: string[] = [];

  for (const section of COMPONENT_SECTIONS) {
    const sectionObj = components[section];
    if (!isObject(sectionObj)) continue;

    for (const key of Object.keys(sectionObj)) {
      if (!COMPONENT_KEY_PATTERN.test(key)) {
        invalidKeys.push(`components.${section}.${key}`);
      }
    }
  }

  if (invalidKeys.length > 0) {
    throw new Error(
      `Invalid component key${invalidKeys.length > 1 ? 's' : ''} found. ` +
        `OpenAPI component keys must match the pattern ${COMPONENT_KEY_PATTERN} ` +
        `(non-ASCII characters are not allowed per the spec).\n` +
        `  See: https://spec.openapis.org/oas/v3.0.3.html#components-object\n` +
        `  Invalid keys:\n` +
        invalidKeys.map((k) => `    - ${k}`).join('\n'),
    );
  }
}

/**
 * Where a document keeps its reusable schemas. Swagger 2.0 has no
 * `components` — carrying one makes the document invalid ("Property components
 * is not expected to be here"), so merged schemas have to land in
 * `definitions` and be referenced as `#/definitions/...` instead (#2993).
 */
const schemaRefPrefix = (data: Record<string, unknown>): string =>
  isSwagger2(data) ? '#/definitions/' : '#/components/schemas/';

/**
 * The plugins from `@scalar/json-magic` does not dereference $ref.
 * Instead it fetches them and puts them under x-ext, and changes the $ref to point to #x-ext/<name>.
 * This function:
 * 1. Merges external schemas into the main spec's schema container (with collision handling)
 * 2. Replaces x-ext refs with standard schema refs or inlined content
 */
export function dereferenceExternalRef(
  data: Record<string, unknown>,
  strategy: ExternalRefNamingStrategy = 'default',
): Record<string, unknown> {
  const extensions = (data['x-ext'] ?? {}) as Record<string, unknown>;
  const refPrefix = schemaRefPrefix(data);

  // Step 1: Merge external schemas into main spec with collision handling
  const schemaNameMappings = mergeExternalSchemas(data, extensions, strategy);

  // Step 2: Replace all x-ext refs throughout the document
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'x-ext') {
      result[key] = replaceXExtRefs(
        value,
        extensions,
        schemaNameMappings,
        refPrefix,
      );
    }
  }

  return result;
}

/**
 * Merge external document schemas into main spec's components.schemas
 * Returns mapping of original schema names to final names (with suffixes for collisions)
 */
function mergeExternalSchemas(
  data: Record<string, unknown>,
  extensions: Record<string, unknown>,
  strategy: ExternalRefNamingStrategy,
): Record<string, Record<string, string>> {
  const schemaNameMappings: Record<string, Record<string, string>> = {};

  if (Object.keys(extensions).length === 0) return schemaNameMappings;

  const swagger2 = isSwagger2(data);

  // Materialized on the first schema actually merged. An external document that
  // contributes none — the common case, where it holds bare schemas at its root
  // and the ref is inlined instead — must not leave an empty container behind:
  // on a Swagger 2.0 document that stray `components` fails validation (#2993).
  let mainSchemas: Record<string, unknown> | undefined;
  const getMainSchemas = () => {
    if (mainSchemas) return mainSchemas;

    if (swagger2) {
      data.definitions ??= {};
      mainSchemas = data.definitions as Record<string, unknown>;
      return mainSchemas;
    }

    data.components ??= {};
    const mainComponents = data.components as Record<string, unknown>;
    mainComponents.schemas ??= {};
    mainSchemas = mainComponents.schemas as Record<string, unknown>;
    return mainSchemas;
  };

  // Merge schemas from each external doc. In default mode, preserve the
  // original name unless it is occupied by a different schema. In always mode,
  // include the external document key for every external schema.
  for (const [extKey, extDoc] of Object.entries(extensions)) {
    schemaNameMappings[extKey] = {};

    if (isObject(extDoc) && 'components' in extDoc) {
      const extComponents = extDoc.components as Record<string, unknown>;
      if (isObject(extComponents) && 'schemas' in extComponents) {
        const extSchemas = extComponents.schemas as Record<string, unknown>;
        for (const [schemaName, schema] of Object.entries(extSchemas)) {
          const targetSchemas = getMainSchemas();
          const existingSchema = targetSchemas[schemaName];
          const existingRef =
            isObject(existingSchema) &&
            '$ref' in existingSchema &&
            isString(existingSchema.$ref) &&
            existingSchema.$ref;
          const isMatchingXExtRef =
            existingRef ===
            `#/x-ext/${extKey}/components/schemas/${schemaName}`;

          let finalSchemaName = schemaName;

          const suffix = extKey.replaceAll(/[^a-zA-Z0-9]/g, '_');
          if (strategy === 'always' && suffix.length === 0) {
            throw new Error(
              `External schema "${schemaName}" from "${extKey}" cannot be named with the always strategy because its external document identity is empty after sanitization.`,
            );
          }

          if (strategy === 'always') {
            finalSchemaName = `${schemaName}_${suffix}`;
          } else if (schemaName in targetSchemas && !isMatchingXExtRef) {
            finalSchemaName = `${schemaName}_${suffix}`;
          }

          const isExistingPlaceholder =
            finalSchemaName === schemaName && isMatchingXExtRef;
          if (
            Object.hasOwn(targetSchemas, finalSchemaName) &&
            !isExistingPlaceholder
          ) {
            throw new Error(
              `External schema "${schemaName}" from "${extKey}" cannot be merged as "${finalSchemaName}" because that component name is already occupied.`,
            );
          }

          schemaNameMappings[extKey][schemaName] = finalSchemaName;
          targetSchemas[finalSchemaName] = scrubUnwantedKeys(schema);
        }
      }
    }
  }

  // Nothing was merged, so there is no container and no ref to rewrite.
  if (!mainSchemas) return schemaNameMappings;

  // Apply internal ref updates to all schemas from external docs
  const refPrefix = schemaRefPrefix(data);
  for (const [extKey, mapping] of Object.entries(schemaNameMappings)) {
    for (const [, finalName] of Object.entries(mapping)) {
      const schema = mainSchemas[finalName];
      if (schema) {
        mainSchemas[finalName] = updateInternalRefs(
          schema,
          extKey,
          schemaNameMappings,
          refPrefix,
        ) as Record<string, unknown>;
      }
    }
  }

  return schemaNameMappings;
}

/**
 * Remove unwanted keys like $schema and $id from objects
 */
function scrubUnwantedKeys(obj: unknown): unknown {
  const UNWANTED_KEYS = new Set(['$schema', '$id']);

  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((x) => scrubUnwantedKeys(x));
  if (isObject(obj)) {
    const rec = obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (UNWANTED_KEYS.has(k)) continue;
      out[k] = scrubUnwantedKeys(v);
    }
    return out;
  }
  return obj;
}

/**
 * Update internal refs within an external schema to use suffixed names.
 *
 * External documents are OpenAPI 3 shaped, so their own refs read
 * `#/components/schemas/...`. `refPrefix` is where those schemas landed in the
 * *main* document, which is `#/definitions/` when that document is Swagger 2.0
 * (#2993).
 */
function updateInternalRefs(
  obj: unknown,
  extKey: string,
  schemaNameMappings: Record<string, Record<string, string>>,
  refPrefix: string,
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      updateInternalRefs(element, extKey, schemaNameMappings, refPrefix),
    );
  }

  if (isObject(obj)) {
    const record = obj;

    // Check if this is a $ref to #/components/schemas/...
    if ('$ref' in record && isString(record.$ref)) {
      const refValue = record.$ref;
      if (refValue.startsWith('#/components/schemas/')) {
        const schemaName = refValue.replace('#/components/schemas/', '');
        // If this schema was mapped to a suffixed name, update the ref
        const mappedName = schemaNameMappings[extKey][schemaName];
        if (mappedName) {
          return {
            $ref: `${refPrefix}${mappedName}`,
          };
        }
      }
    }

    // Recursively process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = updateInternalRefs(
        value,
        extKey,
        schemaNameMappings,
        refPrefix,
      );
    }
    return result;
  }

  return obj;
}

/**
 * Decode a single JSON Pointer reference token taken from an x-ext `$ref`.
 *
 * The token carries two layers of encoding: it sits in a URI fragment, so it
 * may be percent-encoded (e.g. `%7B` for `{` in templated paths), and it is a
 * JSON Pointer token, so `~1`/`~0` stand for `/`/`~` (RFC 6901). Percent-
 * encoding is the outer layer and is removed first; a malformed sequence is
 * left as-is rather than throwing. Without this, tokens such as `~1pets`
 * never match the real `/pets` key and the external `$ref` fails to resolve.
 */
function decodeRefToken(token: string): string {
  let decoded = token;
  try {
    decoded = decodeURIComponent(token);
  } catch {
    // Malformed percent-encoding — fall back to the raw token.
  }
  return decoded.replaceAll('~1', '/').replaceAll('~0', '~');
}

/**
 * Replace x-ext refs with standard component refs, or inline the content.
 * `inliningRefs` tracks the inline chain to break cycles in recursive
 * external schemas that aren't under `components.schemas` (#1642).
 */
function replaceXExtRefs(
  obj: unknown,
  extensions: Record<string, unknown>,
  schemaNameMappings: Record<string, Record<string, string>>,
  refPrefix: string,
  inliningRefs = new Set<string>(),
): unknown {
  if (isNullish(obj)) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      replaceXExtRefs(
        element,
        extensions,
        schemaNameMappings,
        refPrefix,
        inliningRefs,
      ),
    );
  }

  if (isObject(obj)) {
    const record = obj;

    // Check if this object is a $ref to x-ext
    if ('$ref' in record && isString(record.$ref)) {
      const refValue = record.$ref;
      if (refValue.startsWith('#/x-ext/')) {
        // Parse the x-ext ref
        const pathStr = refValue.replace('#/x-ext/', '');
        const parts = pathStr.split('/');
        const extKey = parts.shift();

        if (extKey) {
          // Check if this is a ref to components/schemas - if so, replace with standard ref
          if (
            parts.length >= 3 &&
            parts[0] === 'components' &&
            parts[1] === 'schemas'
          ) {
            const schemaName = parts.slice(2).join('/');
            // Use the mapped name (which may include suffix for collisions)
            const finalName =
              schemaNameMappings[extKey][schemaName] || schemaName;
            return { $ref: `${refPrefix}${finalName}` };
          }

          // Otherwise inline the content; break cycles with `{}`.
          if (inliningRefs.has(refValue)) {
            logger.warn(
              `Detected a circular external $ref while inlining "${refValue}". ` +
                `Replacing with an empty schema to avoid infinite recursion. ` +
                `Move the schema under "components.schemas" in its source file ` +
                `or pre-bundle the spec to keep the recursion intact.`,
            );
            return {};
          }

          const extDoc = extensions[extKey];
          let refObj: unknown = extDoc;
          for (const rawPart of parts) {
            const p = decodeRefToken(rawPart);
            if (
              refObj &&
              (isObject(refObj) || Array.isArray(refObj)) &&
              p in (refObj as Record<string, unknown>)
            ) {
              refObj = (refObj as Record<string, unknown>)[p];
            } else {
              refObj = undefined;
              break;
            }
          }

          if (refObj) {
            const cleaned = scrubUnwantedKeys(refObj);
            const nextInlining = new Set(inliningRefs);
            nextInlining.add(refValue);
            return replaceXExtRefs(
              cleaned,
              extensions,
              schemaNameMappings,
              refPrefix,
              nextInlining,
            );
          }
        }
      }
    }

    // Recursively process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = replaceXExtRefs(
        value,
        extensions,
        schemaNameMappings,
        refPrefix,
        inliningRefs,
      );
    }
    return result;
  }

  return obj;
}
