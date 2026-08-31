import {
  dynamicImport,
  isObject,
  isString,
  isUrl,
  logWarning,
  type NormalizedOptions,
  type OpenApiDocument,
  type OverrideInput,
  type WriteSpecBuilder,
} from '@orval/core';
import { bundle } from '@scalar/json-magic/bundle';
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

  // Enforce the allow-list on refs found in the top-level spec.
  // Transitive refs (inside external docs) are enforced by the loader wrappers.
  if (!isWildcard) {
    const refs = collectExternalRefs(specData);
    const disallowed = refs.filter(
      (ref) => !isAllowedRef(ref, allowedRefs, origin),
    );
    if (disallowed.length > 0) {
      throw new Error(formatDisallowedRefsError(disallowed, allowedRefs));
    }
  } else {
    const docs = [
      ...new Set(collectExternalRefs(specData).map(getRefDocument)),
    ];
    if (docs.length > 0) {
      logWarning(
        `External $ref documents being resolved:\n` +
          docs.map((d) => `  - ${d}`).join('\n'),
      );
    }
  }

  const dereferencedData = await bundleAndDereferenceExternalRefs(
    specData,
    parserOptions,
    origin,
    isWildcard,
    allowedRefs,
  );

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
    transformedData =
      collectExternalRefs(applied).length > 0
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
    logWarning(
      `🚨 OpenAPI spec validation is disabled.\n` +
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

  const upgraded = upgrade(transformedData);
  let specification = upgraded.specification;

  // Normalize invalid OpenAPI 3.0 nullable references into a valid 3.1 form.
  // A `$ref` with a sibling `nullable: true` is out of spec: per the Reference
  // Object rules, sibling properties on a `$ref` are ignored, so `nullable` has
  // no effect. Many specs still use it to mean `Pet | null`. Rewrite
  // `{ $ref, nullable: true }` to `{ anyOf: [$ref, { type: 'null' }] }` and warn
  // so users know their spec was non-conformant (#3714). Runs after `upgrade()`
  // so the validator never sees the rewritten node and the warning fires once
  // per source occurrence, not per dereference site.
  specification = normalizeNullableRefs(specification) as typeof specification;

  // upgrade() returns @scalar/openapi-types/3.1 Document (openapi: string);
  // OpenApiDocument uses the legacy OpenAPIV3_1 namespace (openapi version literals).
  if (formDataItems && formDataItems.size > 0) {
    specification = restoreSwagger2FormDataItems(specification, formDataItems);
  }

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
 * Runs before `upgrade()` so the corrected spec is validated as 3.1 and the
 * warning fires once per occurrence, not per dereference site.
 */
export function normalizeNullableRefs(
  spec: unknown,
  path: string[] = [],
  inAllOf: boolean = false,
): unknown {
  if (Array.isArray(spec)) {
    return spec.map((item, i) =>
      normalizeNullableRefs(item, [...path, String(i)], inAllOf),
    );
  }

  if (!isObject(spec)) {
    return spec;
  }

  const obj = spec as Record<string, unknown>;

  // A ReferenceObject with a sibling `nullable: true`.
  // Only rewrite when NOT inside an allOf array — allOf + $ref + nullable is
  // the valid OpenAPI 3.0 way to make a reference nullable, and orval already
  // handles it correctly (#3714).
  if (
    !inAllOf &&
    '$ref' in obj &&
    isString(obj.$ref) &&
    (obj.nullable as boolean | undefined) === true
  ) {
    const ref = obj.$ref;
    delete obj.nullable;
    delete obj.$ref;
    const jsonPointer = '#/' + path.join('/');
    logWarning(
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

  for (const [key, value] of Object.entries(obj)) {
    obj[key] = normalizeNullableRefs(
      value,
      [...path, key],
      inAllOf || key === 'allOf',
    );
  }

  return obj;
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
    ...(origin ? { origin } : {}),
  });
  return dereferenceExternalRef(data as Record<string, unknown>);
}

// ─── External ref allow-list enforcement (GHSA-cxq5-97v7-87j8) ─────────────

/**
 * Load the top-level spec into an inline object so we can scan it for external
 * `$ref`s before `bundle()` resolves them. The top-level target is trusted
 * (user-configured `input.target`); only `$ref` values inside the spec are
 * untrusted.
 */
function parseSpec(text: string): Record<string, unknown> {
  const schema = jsYaml.JSON_SCHEMA.extend({
    implicit: [jsYaml.types.merge],
  });
  const result = jsYaml.load(text, { schema });
  if (!isObject(result)) {
    throw new Error('OpenAPI spec must be a valid JSON/YAML object.');
  }
  return result as Record<string, unknown>;
}

async function loadSpec(
  input: string | Record<string, unknown>,
  headers?: NonNullable<ResolveSpecOptions['parserOptions']>['headers'],
): Promise<{ data: Record<string, unknown>; origin?: string }> {
  if (!isString(input)) {
    return { data: input };
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
 * Collect all external `$ref` document targets from a spec object. Returns
 * deduplicated ref strings in their raw form (before fragment stripping).
 */
function collectExternalRefs(obj: unknown): string[] {
  const refs = new Set<string>();
  function walk(val: unknown) {
    if (Array.isArray(val)) {
      val.forEach(walk);
      return;
    }
    if (isObject(val)) {
      if ('$ref' in val && isString(val.$ref) && !val.$ref.startsWith('#')) {
        refs.add(val.$ref);
      }
      Object.values(val).forEach(walk);
    }
  }
  walk(obj);
  return [...refs];
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
) {
  const base = fetchUrls({ headers });
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
 * The plugins from `@scalar/json-magic` does not dereference $ref.
 * Instead it fetches them and puts them under x-ext, and changes the $ref to point to #x-ext/<name>.
 * This function:
 * 1. Merges external schemas into main spec's components.schemas (with collision handling)
 * 2. Replaces x-ext refs with standard component refs or inlined content
 */
export function dereferenceExternalRef(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const extensions = (data['x-ext'] ?? {}) as Record<string, unknown>;

  // Step 1: Merge external schemas into main spec with collision handling
  const schemaNameMappings = mergeExternalSchemas(data, extensions);

  // Step 2: Replace all x-ext refs throughout the document
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'x-ext') {
      result[key] = replaceXExtRefs(value, extensions, schemaNameMappings);
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
): Record<string, Record<string, string>> {
  const schemaNameMappings: Record<string, Record<string, string>> = {};

  if (Object.keys(extensions).length === 0) return schemaNameMappings;

  data.components ??= {};
  const mainComponents = data.components as Record<string, unknown>;
  mainComponents.schemas ??= {};
  const mainSchemas = mainComponents.schemas as Record<string, unknown>;

  // Merge schemas from each external doc
  // Collision handling:
  // - If schema already exists in main spec, add x-ext key as suffix (e.g., User -> User_external1)
  // - x-ext refs in main spec get replaced by actual schema from external doc
  for (const [extKey, extDoc] of Object.entries(extensions)) {
    schemaNameMappings[extKey] = {};

    if (isObject(extDoc) && 'components' in extDoc) {
      const extComponents = extDoc.components as Record<string, unknown>;
      if (isObject(extComponents) && 'schemas' in extComponents) {
        const extSchemas = extComponents.schemas as Record<string, unknown>;
        for (const [schemaName, schema] of Object.entries(extSchemas)) {
          // Check if main schema is just an x-ext ref - if so, replace it without suffix
          const existingSchema = mainSchemas[schemaName];
          const isXExtRef =
            isObject(existingSchema) &&
            '$ref' in existingSchema &&
            isString(existingSchema.$ref) &&
            existingSchema.$ref.startsWith('#/x-ext/');

          let finalSchemaName = schemaName;

          if (schemaName in mainSchemas && !isXExtRef) {
            // Collision: add suffix to external schema
            const suffix = extKey.replaceAll(/[^a-zA-Z0-9]/g, '_');
            finalSchemaName = `${schemaName}_${suffix}`;
            schemaNameMappings[extKey][schemaName] = finalSchemaName;
          } else {
            // No collision or replacing x-ext ref
            schemaNameMappings[extKey][schemaName] = schemaName;
          }

          mainSchemas[finalSchemaName] = scrubUnwantedKeys(schema);
        }
      }
    }
  }

  // Apply internal ref updates to all schemas from external docs
  for (const [extKey, mapping] of Object.entries(schemaNameMappings)) {
    for (const [, finalName] of Object.entries(mapping)) {
      const schema = mainSchemas[finalName];
      if (schema) {
        mainSchemas[finalName] = updateInternalRefs(
          schema,
          extKey,
          schemaNameMappings,
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
 * Update internal refs within an external schema to use suffixed names
 */
function updateInternalRefs(
  obj: unknown,
  extKey: string,
  schemaNameMappings: Record<string, Record<string, string>>,
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      updateInternalRefs(element, extKey, schemaNameMappings),
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
            $ref: `#/components/schemas/${mappedName}`,
          };
        }
      }
    }

    // Recursively process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = updateInternalRefs(value, extKey, schemaNameMappings);
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
  inliningRefs = new Set<string>(),
): unknown {
  if (isNullish(obj)) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      replaceXExtRefs(element, extensions, schemaNameMappings, inliningRefs),
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
            return { $ref: `#/components/schemas/${finalName}` };
          }

          // Otherwise inline the content; break cycles with `{}`.
          if (inliningRefs.has(refValue)) {
            logWarning(
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
        inliningRefs,
      );
    }
    return result;
  }

  return obj;
}
