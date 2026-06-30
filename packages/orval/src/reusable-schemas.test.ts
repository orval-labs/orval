import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../core/src/test-utils/context';
import {
  collectReachableComponentRefs,
  computeLazyEdges,
  generateReusableSchemaSet,
  resolveSchemaName,
  resolveSchemaNames,
  rewriteReusableSchemas,
} from './reusable-schemas';

describe('resolveSchemaName', () => {
  // Identifiers are always PascalCase (matching operation wrappers + TS model
  // types); `namingConvention` only affects file names, not identifiers.
  it('returns a PascalCase identifier regardless of namingConvention', () => {
    const camel = createTestContextSpec({
      output: { namingConvention: 'camelCase' as never },
    });
    expect(resolveSchemaName('#/components/schemas/Pet', camel)).toBe('Pet');
    expect(resolveSchemaName('#/components/schemas/Pet_Owner', camel)).toBe(
      'PetOwner',
    );

    const kebab = createTestContextSpec({
      output: { namingConvention: 'kebab-case' as never },
    });
    // kebab-case files, but the identifier is still a valid PascalCase symbol.
    expect(resolveSchemaName('#/components/schemas/pet_owner', kebab)).toBe(
      'PetOwner',
    );
  });
});

describe('resolveSchemaNames (conflict guard)', () => {
  const context = createTestContextSpec();

  it('returns a mapping of ref -> PascalCase identifier', () => {
    const result = resolveSchemaNames(
      ['#/components/schemas/Pet', '#/components/schemas/Owner'],
      context,
    );
    expect(result).toEqual(
      new Map([
        ['#/components/schemas/Pet', 'Pet'],
        ['#/components/schemas/Owner', 'Owner'],
      ]),
    );
  });

  it('throws when two refs collapse to the same identifier', () => {
    expect(() =>
      resolveSchemaNames(
        ['#/components/schemas/pet_owner', '#/components/schemas/PetOwner'],
        context,
      ),
    ).toThrow(/pet_owner.*PetOwner|PetOwner.*pet_owner/);
  });
});

describe('collectReachableComponentRefs', () => {
  const spec = {
    openapi: '3.1.0',
    info: { title: 'Test', version: '1' },
    paths: {
      '/pet': {
        get: {
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Pet' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Pet: {
          type: 'object',
          properties: {
            owner: { $ref: '#/components/schemas/Owner' },
            tags: {
              type: 'array',
              items: { $ref: '#/components/schemas/Tag' },
            },
          },
        },
        Owner: { type: 'object' },
        Tag: { type: 'object' },
        Unused: { type: 'object' },
      },
    },
  } as unknown as OpenAPIV3_1.Document;

  it('finds refs reachable from operations and follows them transitively', () => {
    const result = collectReachableComponentRefs(spec);
    expect(result).toEqual(
      new Set([
        '#/components/schemas/Pet',
        '#/components/schemas/Owner',
        '#/components/schemas/Tag',
      ]),
    );
  });

  it('does not include unreachable schemas', () => {
    const result = collectReachableComponentRefs(spec);
    expect(result.has('#/components/schemas/Unused')).toBe(false);
  });
});

describe('generateReusableSchemaSet', () => {
  it('produces one entry per reachable ref with sentinel-marked zod strings', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                owner: { $ref: '#/components/schemas/Owner' },
              },
              required: ['owner'],
            },
            Owner: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
    });

    const result = generateReusableSchemaSet(
      ['#/components/schemas/Pet', '#/components/schemas/Owner'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(result).toHaveLength(2);

    const petEntry = result.find((e) => e.name === 'Pet');
    const ownerEntry = result.find((e) => e.name === 'Owner');
    expect(petEntry).toBeDefined();
    expect(ownerEntry).toBeDefined();

    expect(petEntry?.zod).toContain('__REF_Owner__');
    expect(petEntry?.usedRefs).toEqual(new Set(['Owner']));

    expect(ownerEntry?.zod).not.toContain('__REF_');
    expect(ownerEntry?.usedRefs).toEqual(new Set());
  });

  it('injects paramsMutator with location: "schema" at every leaf validator when configured', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'integer' },
              },
              required: ['name', 'age'],
            },
          },
        },
      },
    });

    const paramsMutator = {
      name: 'zodParams',
      path: './zod-params',
      default: false,
      hasErrorType: false,
      errorTypeName: '',
      hasSecondArg: false,
      hasThirdArg: false,
      isHook: false,
    };

    const [entry] = generateReusableSchemaSet(
      ['#/components/schemas/Pet'],
      context,
      { strict: false, isZodV4: false, paramsMutator },
    );

    // Component schemas have no owning operation, so operationId is empty.
    // The `'schema'` location lets user-side `zodParams` branch on it.
    expect(entry.zod).toContain(
      `zodParams({"operationId":"","location":"schema","schemaName":"Pet","fieldPath":["name"],"validator":"string"})`,
    );
    expect(entry.zod).toContain(
      `zodParams({"operationId":"","location":"schema","schemaName":"Pet","fieldPath":["age"],"validator":"number"})`,
    );
  });

  it('emits no params injection when paramsMutator is not provided', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
    });

    const [entry] = generateReusableSchemaSet(
      ['#/components/schemas/Pet'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(entry.zod).not.toContain('zodParams(');
  });

  it('expands to the transitive closure of component-schema refs', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: {
                owner: { $ref: '#/components/schemas/Owner' },
              },
              required: ['owner'],
            },
            // Owner is reachable from Pet via $ref but NOT in the seed list.
            Owner: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
    });

    const result = generateReusableSchemaSet(
      ['#/components/schemas/Pet'],
      context,
      { strict: false, isZodV4: false },
    );

    // Owner must be in the result even though only Pet was seeded — the
    // orchestrator follows usedRefs to avoid dangling identifiers.
    expect(result.map((e) => e.name).toSorted()).toEqual(['Owner', 'Pet']);
  });
});

describe('computeLazyEdges', () => {
  it('returns empty set for a DAG', () => {
    const edges = computeLazyEdges(
      new Map([
        ['a', new Set(['b', 'c'])],
        ['b', new Set(['c'])],
        ['c', new Set()],
      ]),
    );
    expect(edges).toEqual(new Set());
  });

  it('marks one edge as lazy for a simple cycle a -> b -> a', () => {
    const edges = computeLazyEdges(
      new Map([
        ['a', new Set(['b'])],
        ['b', new Set(['a'])],
      ]),
    );
    expect(edges.size).toBe(1);
    expect([...edges][0]).toMatch(/^(a->b|b->a)$/);
  });

  it('marks a self-loop a -> a as lazy', () => {
    const edges = computeLazyEdges(new Map([['a', new Set(['a'])]]));
    expect(edges).toEqual(new Set(['a->a']));
  });

  it('marks at least one edge per cycle in a 3-node SCC', () => {
    const edges = computeLazyEdges(
      new Map([
        ['a', new Set(['b', 'c'])],
        ['b', new Set(['a', 'c'])],
        ['c', new Set(['a'])],
      ]),
    );
    expect(edges.size).toBeGreaterThan(0);
    expect(edges.size).toBeLessThan(5);
  });
});

describe('rewriteReusableSchemas', () => {
  it('replaces sentinels with direct names for a DAG', () => {
    const entries = [
      {
        ref: '#/components/schemas/Pet',
        name: 'pet',
        zod: 'zod.object({ owner: __REF_owner__ })',
        consts: '',
        usedRefs: new Set(['owner']),
      },
      {
        ref: '#/components/schemas/Owner',
        name: 'owner',
        zod: 'zod.object({})',
        consts: '',
        usedRefs: new Set<string>(),
      },
    ];
    const result = rewriteReusableSchemas(entries);
    const pet = result.find((e) => e.name === 'pet');
    expect(pet?.zod).toBe('zod.object({ owner: owner })');
    // Topological order: owner emitted before pet.
    expect(result.map((e) => e.name)).toEqual(['owner', 'pet']);
    // Acyclic schemas are not flagged recursive.
    expect(result.every((e) => e.isRecursive !== true)).toBe(true);
  });

  it('wraps cycle edges in z.lazy(() => Name)', () => {
    const entries = [
      {
        ref: '#/components/schemas/A',
        name: 'a',
        zod: 'zod.object({ b: __REF_b__ })',
        consts: '',
        usedRefs: new Set(['b']),
      },
      {
        ref: '#/components/schemas/B',
        name: 'b',
        zod: 'zod.object({ a: __REF_a__ })',
        consts: '',
        usedRefs: new Set(['a']),
      },
    ];
    const result = rewriteReusableSchemas(entries);
    const a = result.find((e) => e.name === 'a');
    const b = result.find((e) => e.name === 'b');
    const lazyCount = [a?.zod, b?.zod].filter((s) =>
      s?.includes('zod.lazy'),
    ).length;
    expect(lazyCount).toBe(1);
    // Both members of the cycle are flagged recursive so the writer pins each
    // to `zod.ZodType<Name>` (the const-level fix for TS7022).
    expect(a?.isRecursive).toBe(true);
    expect(b?.isRecursive).toBe(true);
  });

  it('wraps self-loops in z.lazy', () => {
    const entries = [
      {
        ref: '#/components/schemas/Node',
        name: 'node',
        zod: 'zod.object({ child: __REF_node__ })',
        consts: '',
        usedRefs: new Set(['node']),
      },
    ];
    const result = rewriteReusableSchemas(entries);
    expect(result[0].zod).toBe('zod.object({ child: zod.lazy(() => node) })');
    // Self-loop ⇒ recursive; the writer annotates `const node: zod.ZodType<node>`.
    expect(result[0].isRecursive).toBe(true);
  });

  it('adds pure comments to zod mini lazy self-loops', () => {
    const entries = [
      {
        ref: '#/components/schemas/Node',
        name: 'node',
        zod: 'zod.object({ child: __REF_node__ })',
        consts: '',
        usedRefs: new Set(['node']),
        variant: 'mini' as const,
      },
    ];
    const result = rewriteReusableSchemas(entries);
    expect(result[0].zod).toBe(
      'zod.object({ child: /*#__PURE__*/ zod.lazy(() => node) })',
    );
  });
});

describe('generateReusableSchemaSet with $dynamicRef', () => {
  it('discovers transitive refs through $dynamicRef', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              $dynamicAnchor: 'Pet',
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
            Lizard: {
              type: 'object',
              properties: {
                friends: {
                  type: 'array',
                  items: { $dynamicRef: '#Pet' },
                },
              },
              required: ['friends'],
            },
          },
        },
      },
    });

    const result = generateReusableSchemaSet(
      ['#/components/schemas/Lizard'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(result.map((e) => e.name).toSorted()).toEqual(['Lizard', 'Pet']);

    const lizard = result.find((e) => e.name === 'Lizard');
    expect(lizard?.zod).toContain('__REF_Pet__');
    expect(lizard?.usedRefs).toEqual(new Set(['Pet']));
  });

  it('handles self-referential $dynamicRef with z.lazy', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              $dynamicAnchor: 'Pet',
              type: 'object',
              properties: {
                name: { type: 'string' },
                playmates: {
                  type: 'array',
                  items: { $dynamicRef: '#Pet' },
                },
              },
              required: ['name'],
            },
          },
        },
      },
    });

    const entries = generateReusableSchemaSet(
      ['#/components/schemas/Pet'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].usedRefs).toEqual(new Set(['Pet']));

    const rewritten = rewriteReusableSchemas(entries);
    expect(rewritten[0].zod).toContain('zod.lazy(() => Pet)');
    expect(rewritten[0].isRecursive).toBe(true);
  });

  it('resolves $dynamicRef through the component local dynamic scope', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              $dynamicAnchor: 'Pet',
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
            Cat: {
              $dynamicAnchor: 'Pet',
              type: 'object',
              properties: {
                meow: { type: 'boolean' },
                playmates: {
                  type: 'array',
                  items: { $dynamicRef: '#Pet' },
                },
              },
              required: ['meow'],
            },
          },
        },
      },
    });

    const entries = generateReusableSchemaSet(
      ['#/components/schemas/Cat'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(entries.map((e) => e.name)).toEqual(['Cat']);
    expect(entries[0].usedRefs).toEqual(new Set(['Cat']));

    const rewritten = rewriteReusableSchemas(entries);
    expect(rewritten[0].zod).toContain('zod.lazy(() => Cat)');
    expect(rewritten[0].zod).not.toContain('__REF_Pet__');
  });

  it('resolves $defs dynamic anchors in reusable schemas', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'string' } },
              required: ['id'],
            },
            Container: {
              type: 'object',
              $defs: {
                itemType: {
                  $dynamicAnchor: 'itemType',
                  $ref: '#/components/schemas/User',
                },
              },
              properties: {
                items: {
                  type: 'array',
                  items: { $dynamicRef: '#itemType' },
                },
              },
              required: ['items'],
            },
          },
        },
      },
    });

    const entries = generateReusableSchemaSet(
      ['#/components/schemas/Container'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(entries.map((e) => e.name).toSorted()).toEqual([
      'Container',
      'User',
    ]);
    expect(entries.find((e) => e.name === 'Container')?.usedRefs).toEqual(
      new Set(['User']),
    );
  });

  it('handles mutual $dynamicRef cycle between two schemas', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Dog: {
              $dynamicAnchor: 'Dog',
              type: 'object',
              properties: {
                name: { type: 'string' },
                friends: {
                  type: 'array',
                  items: { $dynamicRef: '#Cat' },
                },
              },
              required: ['name'],
            },
            Cat: {
              $dynamicAnchor: 'Cat',
              type: 'object',
              properties: {
                name: { type: 'string' },
                friends: {
                  type: 'array',
                  items: { $dynamicRef: '#Dog' },
                },
              },
              required: ['name'],
            },
          },
        },
      },
    });

    const entries = generateReusableSchemaSet(
      ['#/components/schemas/Dog'],
      context,
      { strict: false, isZodV4: false },
    );

    expect(entries.map((e) => e.name).toSorted()).toEqual(['Cat', 'Dog']);

    const rewritten = rewriteReusableSchemas(entries);
    const dog = rewritten.find((e) => e.name === 'Dog');
    const cat = rewritten.find((e) => e.name === 'Cat');

    expect(dog?.isRecursive).toBe(true);
    expect(cat?.isRecursive).toBe(true);

    const lazyCount = [dog?.zod, cat?.zod].filter((s) =>
      s?.includes('zod.lazy'),
    ).length;
    expect(lazyCount).toBe(1);
  });
});
