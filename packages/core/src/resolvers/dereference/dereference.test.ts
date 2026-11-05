import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestContextSpec } from '../../test-utils';
import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiSchemaObject,
} from '../../types';
import {
  createExpansionCache,
  getExpansionCache,
  MAX_VARIANTS_PER_REF,
  NO_REFS,
  singleRef,
  unionRefs,
} from './cache';
import { dereference } from './dereference';
import { expandSchema } from './expand';
import type { DereferenceOptions, RefSet } from './types';

type Schemas = Record<string, unknown>;

const createContext = (
  schemas: Schemas,
  extra: Partial<OpenApiDocument> = {},
): ContextSpec =>
  createTestContextSpec({
    target: 'core-test',
    workspace: '/tmp',
    spec: {
      openapi: '3.1.0',
      components: { schemas },
      ...extra,
    } as Partial<OpenApiDocument>,
    override: {},
  });

// Test fixtures use JSON shapes the schema types do not model (null values).
const asSchema = (value: unknown) => value as OpenApiSchemaObject;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

describe('dereference', () => {
  it('inlines refs recursively', () => {
    const context = createContext({
      Pet: {
        type: 'object',
        properties: {
          owner: ref('Owner'),
          tags: { type: 'array', items: ref('Tag') },
        },
      },
      Owner: { type: 'object', properties: { name: { type: 'string' } } },
      Tag: { type: 'string' },
    });

    expect(dereference(ref('Pet'), context)).toEqual({
      type: 'object',
      properties: {
        owner: { type: 'object', properties: { name: { type: 'string' } } },
        tags: { type: 'array', items: { type: 'string' } },
      },
    });
  });

  it('merges siblings over the target', () => {
    const context = createContext({
      Name: { type: 'string', description: 'target', maxLength: 5 },
    });

    expect(
      dereference({ ...ref('Name'), description: 'sibling' }, context),
    ).toEqual({ type: 'string', description: 'sibling', maxLength: 5 });
  });

  it('turns boolean schemas into object schemas', () => {
    const context = createContext({});

    expect(dereference(true, context)).toEqual({});
    expect(dereference(false, context)).toEqual({ not: {} });
  });

  it('passes null through untouched', () => {
    const context = createContext({});
    const nullable = { type: 'object', properties: { a: null } };

    expect(dereference(asSchema(nullable), context)).toEqual(nullable);
  });

  it('resolves boolean targets and drops siblings by default', () => {
    const context = createContext({ Never: false, Any: true });

    expect(dereference({ ...ref('Never'), description: 'x' }, context)).toEqual(
      {
        not: {},
      },
    );
    expect(dereference(ref('Any'), context)).toEqual({});
  });

  it('replaces an unresolved ref with an empty schema', () => {
    const context = createContext({});

    expect(dereference(ref('Missing'), context)).toEqual({});
  });

  it('copies default, example and examples verbatim', () => {
    const context = createContext({ Other: { type: 'string' } });
    const value = { a: ref('Other') };

    expect(
      dereference(
        { type: 'object', default: value, example: value, examples: [value] },
        context,
      ),
    ).toEqual({
      type: 'object',
      default: value,
      example: value,
      examples: [value],
    });
  });

  describe('cycles', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { b: ref('B') } },
      B: { type: 'object', properties: { a: ref('A') } },
    };

    it('cuts the ref that closes the cycle, from A', () => {
      expect(dereference(ref('A'), createContext(schemas))).toEqual({
        type: 'object',
        properties: {
          b: { type: 'object', properties: { a: {} } },
        },
      });
    });

    it('cuts the ref that closes the cycle, from B', () => {
      expect(dereference(ref('B'), createContext(schemas))).toEqual({
        type: 'object',
        properties: {
          a: { type: 'object', properties: { b: {} } },
        },
      });
    });

    it('does not let a cut result leak between entry points', () => {
      const context = createContext(schemas);
      dereference(ref('A'), context);
      dereference(ref('B'), context);

      expect(dereference(ref('A'), context)).toEqual({
        type: 'object',
        properties: { b: { type: 'object', properties: { a: {} } } },
      });
      expect(dereference(ref('B'), context)).toEqual({
        type: 'object',
        properties: { a: { type: 'object', properties: { b: {} } } },
      });
    });

    it('expands a self reference once', () => {
      const context = createContext({
        Node: { type: 'object', properties: { next: ref('Node') } },
      });

      expect(dereference(ref('Node'), context)).toEqual({
        type: 'object',
        properties: { next: {} },
      });
    });

    it('keeps a diamond below a cycle correct when reached first outside it', () => {
      const context = createContext({
        Root: { type: 'object', properties: { x: ref('X'), y: ref('Y') } },
        X: { type: 'object', properties: { y: ref('Y') } },
        Y: { type: 'object', properties: { x: ref('X') } },
      });

      expect(dereference(ref('Root'), context)).toEqual({
        type: 'object',
        properties: {
          x: {
            type: 'object',
            properties: {
              y: { type: 'object', properties: { x: {} } },
            },
          },
          y: {
            type: 'object',
            properties: {
              x: { type: 'object', properties: { y: {} } },
            },
          },
        },
      });
    });
  });

  describe('expansion cache', () => {
    const countReads = (schemas: Schemas, name: string) => {
      const reads = vi.fn();
      const observed = new Proxy(schemas, {
        get(target, key, receiver) {
          if (key === name) reads();
          return Reflect.get(target, key, receiver) as unknown;
        },
      });
      return { observed, reads };
    };

    it('expands a component referenced from many places once', () => {
      const { observed, reads } = countReads(
        {
          Root: {
            type: 'object',
            properties: {
              a: ref('Shared'),
              b: ref('Shared'),
              c: ref('Shared'),
            },
          },
          Shared: { type: 'object', properties: { id: { type: 'string' } } },
        },
        'Shared',
      );
      const context = createContext(observed);

      const result = dereference(ref('Root'), context);

      expect(result.properties?.a).toEqual(result.properties?.c);
      expect(reads).toHaveBeenCalledTimes(1);
    });

    it('returns a distinct top-level object on every hit', () => {
      const context = createContext({ Shared: { type: 'string' } });

      const first = dereference(ref('Shared'), context);
      first.description = 'mutated';
      const second = dereference(ref('Shared'), context);
      const third = dereference(ref('Shared'), context);

      expect(second).toEqual({ type: 'string' });
      expect(third).not.toBe(second);
    });

    it('does not cache across documents', () => {
      const first = createContext({ Shared: { type: 'string' } });
      const second = createContext({ Shared: { type: 'number' } });

      dereference(ref('Shared'), first);

      expect(dereference(ref('Shared'), second)).toEqual({ type: 'number' });
    });

    it('does not share results between options objects', () => {
      const context = createContext({
        Shared: { type: 'object', properties: { flag: false } },
      });
      const keep: DereferenceOptions = { keepBooleanProperties: true };

      expect(dereference(ref('Shared'), context, keep).properties?.flag).toBe(
        false,
      );
      expect(dereference(ref('Shared'), context).properties?.flag).toEqual({
        not: {},
      });
    });

    it('does not cache refs that carry siblings', () => {
      const context = createContext({ Name: { type: 'string' } });

      dereference(ref('Name'), context);

      expect(
        dereference({ ...ref('Name'), description: 'd' }, context),
      ).toEqual({ type: 'string', description: 'd' });
    });

    // Two refs per level to the next one: without reuse the work doubles per level.
    const diamondChain = (depth: number, last: unknown): Schemas =>
      Object.fromEntries(
        Array.from({ length: depth }, (_, level) => [
          `L${level}`,
          level === depth - 1
            ? last
            : {
                type: 'object',
                properties: {
                  left: ref(`L${level + 1}`),
                  right: ref(`L${level + 1}`),
                },
              },
        ]),
      );

    // Counts visited keys, a measure of the work done.
    const countingOptions = () => {
      const visits = { count: 0 };
      const options: DereferenceOptions = {
        isVerbatimKey: () => {
          visits.count += 1;
          return false;
        },
      };
      return { visits, options };
    };

    it('expands a chain of diamonds in linear work', () => {
      const { visits, options } = countingOptions();
      const result = dereference(
        ref('L0'),
        createContext(diamondChain(25, { type: 'string' })),
        options,
      );

      expect(visits.count).toBeLessThan(500);
      expect(result.properties?.left).toEqual(result.properties?.right);
    });

    it('reuses expansions below a cycle', () => {
      const last = { type: 'object', properties: { next: ref('L24') } };
      const { visits, options } = countingOptions();
      const result = dereference(
        ref('L0'),
        createContext(diamondChain(25, last)),
        options,
      );

      expect(visits.count).toBeLessThan(500);
      expect(result.properties?.left).toEqual(result.properties?.right);
    });

    it('gives the same result for a cached and a fresh expansion of a cycle', () => {
      const schemas: Schemas = {
        Tree: { type: 'object', properties: { root: ref('Node') } },
        Node: {
          type: 'object',
          properties: {
            child: ref('Node'),
            tree: ref('Tree'),
            leaf: ref('Leaf'),
          },
        },
        Leaf: { type: 'object', properties: { up: ref('Node') } },
      };
      const context = createContext(schemas);
      const shared: DereferenceOptions = {};
      const entries = ['Tree', 'Node', 'Leaf', 'Node', 'Tree', 'Leaf'];

      for (const name of entries) {
        expect(dereference(ref(name), context, shared)).toEqual(
          dereference(ref(name), createContext(schemas), {}),
        );
      }
    });
  });

  describe('deep chains', () => {
    const chain = (depth: number, wrap: (next: unknown) => unknown): Schemas =>
      Object.fromEntries(
        Array.from({ length: depth + 1 }, (_, index) => [
          `S${index}`,
          index === depth ? { type: 'string' } : wrap(ref(`S${index + 1}`)),
        ]),
      );

    it('expands a 4000-deep chain of properties', () => {
      const depth = 4000;
      const context = createContext(
        chain(depth, (next) => ({
          type: 'object',
          properties: { next },
        })),
      );

      let node: unknown = dereference(ref('S0'), context);
      for (let level = 0; level < depth; level++) {
        node = (node as { properties: { next: unknown } }).properties.next;
      }
      expect(node).toEqual({ type: 'string' });
    });

    it('expands a 1200-deep chain of allOf', () => {
      const depth = 1200;
      const context = createContext(
        chain(depth, (next) => ({ allOf: [next] })),
      );

      let node: unknown = dereference(ref('S0'), context);
      for (let level = 0; level < depth; level++) {
        node = (node as { allOf: unknown[] }).allOf[0];
      }
      expect(node).toEqual({ type: 'string' });
    });
  });

  describe('options', () => {
    it('keepBooleanProperties keeps booleans under properties', () => {
      const context = createContext({});
      const schema = { type: 'object', properties: { no: false, yes: true } };

      expect(dereference(asSchema(schema), context).properties).toEqual({
        no: { not: {} },
        yes: {},
      });
      expect(
        dereference(asSchema(schema), context, { keepBooleanProperties: true })
          .properties,
      ).toEqual({ no: false, yes: true });
    });

    it('keepSiblingsOfBooleanTarget keeps siblings next to a boolean target', () => {
      const context = createContext({ Never: false });

      expect(
        dereference({ ...ref('Never'), description: 'd' }, context, {
          keepSiblingsOfBooleanTarget: true,
        }),
      ).toEqual({ not: {}, description: 'd' });
    });

    it('ignoreEmptyRef passes a node with an empty $ref through', () => {
      const context = createContext({});
      const schema = { $ref: '', type: 'string' };

      expect(dereference(asSchema(schema), context)).toEqual({});
      expect(
        dereference(asSchema(schema), context, { ignoreEmptyRef: true }),
      ).toEqual({ $ref: '', type: 'string' });
    });

    it('mergeArrayTargets spreads an array target into the node', () => {
      const context = createContext({ Odd: ['a', { type: 'string' }] });
      const schema = { ...ref('Odd'), description: 'd' };

      expect(dereference(asSchema(schema), context)).toEqual({});
      expect(
        dereference(asSchema(schema), context, { mergeArrayTargets: true }),
      ).toEqual({ 0: 'a', 1: { type: 'string' }, description: 'd' });
    });

    it('falseTargetIsUnresolved empties a ref to the false schema', () => {
      const context = createContext({ Never: false, Any: true });

      expect(dereference(ref('Never'), context)).toEqual({ not: {} });
      expect(
        dereference(ref('Never'), context, { falseTargetIsUnresolved: true }),
      ).toEqual({});
      expect(
        dereference(ref('Any'), context, { falseTargetIsUnresolved: true }),
      ).toEqual({});
    });

    it('isVerbatimKey copies matching keys untouched', () => {
      const context = createContext({ Other: { type: 'string' } });
      const schema = {
        type: 'object',
        'x-meta': ref('Other'),
        other: ref('Other'),
      };

      expect(
        dereference(asSchema(schema), context, {
          isVerbatimKey: (k) => k.startsWith('x-'),
        }),
      ).toEqual({
        type: 'object',
        'x-meta': ref('Other'),
        other: { type: 'string' },
      });
    });

    it('calls onCircularRef for a cut', () => {
      const onCircularRef = vi.fn();
      const context = createContext({
        Node: { type: 'object', properties: { next: ref('Node') } },
      });

      dereference(ref('Node'), context, { onCircularRef });

      expect(onCircularRef).toHaveBeenCalledWith('#/components/schemas/Node');
    });

    it('calls onUnresolvedRef and onResolveError for a missing target', () => {
      const onUnresolvedRef = vi.fn();
      const onResolveError = vi.fn();
      const context = createContext({});

      dereference(ref('Missing'), context, { onUnresolvedRef, onResolveError });

      expect(onUnresolvedRef).toHaveBeenCalledWith(
        '#/components/schemas/Missing',
      );
      expect(onResolveError).toHaveBeenCalledWith(
        expect.stringContaining('#/components/schemas/Missing'),
      );
    });

    describe('dynamicRefs', () => {
      const schemas: Schemas = {
        Page: {
          $dynamicAnchor: 'item',
          type: 'object',
          properties: { next: { $dynamicRef: '#item' } },
        },
      };

      it('leaves $dynamicRef untouched when off', () => {
        const context = createContext(schemas);

        expect(dereference(ref('Page'), context).properties?.next).toEqual({
          $dynamicRef: '#item',
        });
      });

      it('resolves $dynamicRef through the scope when on', () => {
        const context = createContext(schemas);

        expect(
          dereference(ref('Page'), context, { dynamicRefs: true }).properties
            ?.next,
        ).toEqual({
          $dynamicAnchor: 'item',
          type: 'object',
          properties: { next: {} },
        });
      });

      it('does not reuse expansions that depend on the dynamic scope', () => {
        const context = createContext(schemas);
        const options: DereferenceOptions = { dynamicRefs: true };

        const first = dereference(ref('Page'), context, options);
        const second = dereference(ref('Page'), context, options);

        expect(second).toEqual(first);
      });

      describe('expansion reuse', () => {
        const options: DereferenceOptions = { dynamicRefs: true };

        // Two sibling refs to the same component: a reused expansion would
        // share its nested objects, a fresh one would not.
        const expandTwice = (schemas: Schemas, name: string) => {
          const result = dereference(
            {
              type: 'object',
              properties: { first: ref(name), second: ref(name) },
            },
            createContext(schemas),
            options,
          );
          return [result.properties?.first, result.properties?.second] as [
            { properties: object },
            { properties: object },
          ];
        };

        it('does not reuse a component that declares an anchor', () => {
          const [first, second] = expandTwice(
            {
              Anchored: {
                $dynamicAnchor: 'anchored',
                type: 'object',
                properties: { id: { type: 'string' } },
              },
            },
            'Anchored',
          );

          expect(second).toEqual(first);
          expect(second.properties).not.toBe(first.properties);
        });

        it('does not reuse a component with a $dynamicRef', () => {
          const [first, second] = expandTwice(
            {
              Anchor: { $dynamicAnchor: 'item', type: 'string' },
              Holder: {
                type: 'object',
                properties: { value: { $dynamicRef: '#item' } },
              },
            },
            'Holder',
          );

          expect(first.properties).toEqual({
            value: { $dynamicAnchor: 'item', type: 'string' },
          });
          expect(second.properties).not.toBe(first.properties);
        });

        it('does not reuse a component with an unresolved $dynamicRef', () => {
          const [first, second] = expandTwice(
            {
              Holder: {
                type: 'object',
                properties: { value: { $dynamicRef: '#missing' } },
              },
            },
            'Holder',
          );

          expect(first.properties).toEqual({ value: {} });
          expect(second.properties).not.toBe(first.properties);
        });

        it('does not reuse a scope-free component inside a dynamic scope', () => {
          const result = dereference(
            {
              type: 'object',
              properties: { outside: ref('Plain'), inside: ref('Scoped') },
            },
            createContext({
              Plain: { type: 'object', properties: { n: { type: 'string' } } },
              Scoped: {
                $dynamicAnchor: 'scoped',
                type: 'object',
                properties: { plain: ref('Plain') },
              },
            }),
            options,
          );
          const inside = result.properties?.inside as {
            properties: { plain: { properties: object } };
          };
          const outside = result.properties?.outside as {
            properties: object;
          };

          expect(inside.properties.plain).toEqual(outside);
          expect(inside.properties.plain.properties).not.toBe(
            outside.properties,
          );
        });

        it('resolves a shared component per binding of a generic template', () => {
          const bind = (type: string) => ({
            $defs: { T: { $dynamicAnchor: 'T', type } },
            type: 'object',
            properties: { inner: ref('Inner') },
          });
          const result = dereference(
            asSchema({
              type: 'object',
              properties: {
                plain: ref('Inner'),
                str: bind('string'),
                num: bind('number'),
                again: ref('Inner'),
              },
            }),
            createContext({
              Inner: {
                type: 'object',
                properties: { value: { $dynamicRef: '#T' } },
              },
            }),
            options,
          );
          const valueOf = (name: string) => {
            const holder = result.properties?.[name] as {
              properties: { inner: { properties: { value: unknown } } };
            };
            return holder.properties.inner.properties.value;
          };

          expect(valueOf('str')).toMatchObject({ type: 'string' });
          expect(valueOf('num')).toMatchObject({ type: 'number' });
          expect(result.properties?.again).toEqual(result.properties?.plain);
        });
      });
    });
  });

  it('honors a seeded parents chain regardless of earlier calls', () => {
    const context = createContext({
      Obj: { type: 'object', properties: { s: ref('S') } },
      S: { type: 'string' },
    });
    const seeded = { ...context, parents: ['#/components/schemas/S'] };
    const options: DereferenceOptions = {};

    dereference(ref('Obj'), context, options);

    expect(dereference(ref('Obj'), seeded, options)).toEqual({
      type: 'object',
      properties: { s: {} },
    });
    expect(dereference(ref('Obj'), context, options)).toEqual({
      type: 'object',
      properties: { s: { type: 'string' } },
    });
  });

  it('treats a repeated seeded parent like a single one', () => {
    const schemas: Schemas = {
      R: { type: 'object', properties: { x: ref('X'), z: ref('Z') } },
      X: { type: 'string' },
      Z: { type: 'number' },
    };
    const context = createContext(schemas);
    const shared: DereferenceOptions = {};
    const seeded = (parents: string[]) => ({
      ...context,
      parents: parents.map((name) => ref(name).$ref),
    });

    dereference(ref('R'), seeded(['X', 'Z']), shared);

    expect(dereference(ref('R'), seeded(['X', 'X']), shared)).toEqual(
      dereference(ref('R'), seeded(['X']), {}),
    );
  });

  it('treats an empty-string ref as unresolved', () => {
    const context = createContext({});

    expect(dereference({ $ref: '' }, context)).toEqual({});
  });

  it('expands a bare ref when the context has no document', () => {
    const context = createContext({ Pet: { type: 'string' } });
    const detached = { ...context, spec: undefined } as unknown as ContextSpec;

    expect(dereference(ref('Pet'), detached)).toEqual({});
  });

  describe('__proto__ keys', () => {
    const schemas = (): Schemas => ({
      Pet: JSON.parse(
        '{"type":"object","properties":{"__proto__":{"type":"string"},"id":{"type":"string"}},"__proto__":{"type":"number"}}',
      ) as Schemas,
    });

    it('drops them without touching the prototype', () => {
      const result = dereference(ref('Pet'), createContext(schemas()));

      expect(Object.keys(result)).toEqual(['type', 'properties']);
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.keys(result.properties ?? {})).toEqual(['id']);
      expect(Object.getPrototypeOf(result.properties)).toBe(Object.prototype);
    });

    it('keepProtoKey defines them as own properties', () => {
      const result = dereference(ref('Pet'), createContext(schemas()), {
        keepProtoKey: true,
      });

      expect(Object.getOwnPropertyNames(result)).toEqual([
        'type',
        'properties',
        '__proto__',
      ]);
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.getOwnPropertyNames(result.properties)).toEqual([
        '__proto__',
        'id',
      ]);
    });
  });

  describe('strongly connected graphs', () => {
    // Plain recursive expansion, the behavior every optimization must keep.
    const expandNaive = (
      schemas: Schemas,
      value: unknown,
      parents: readonly string[] = [],
    ): unknown => {
      if (Array.isArray(value)) {
        return value.map((item) => expandNaive(schemas, item, parents));
      }
      if (typeof value !== 'object' || value === null) return value;
      const node = value as Record<string, unknown>;
      if (typeof node.$ref === 'string') {
        if (parents.includes(node.$ref)) return {};
        const name = node.$ref.replace('#/components/schemas/', '');
        return expandNaive(schemas, schemas[name], [...parents, node.$ref]);
      }
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [
          key,
          key === 'properties'
            ? Object.fromEntries(
                Object.entries(child as Schemas).map(([name, property]) => [
                  name,
                  expandNaive(schemas, property, parents),
                ]),
              )
            : expandNaive(schemas, child, parents),
        ]),
      );
    };

    const graph = (
      size: number,
      targets: (index: number) => number[],
    ): Schemas =>
      Object.fromEntries(
        Array.from({ length: size }, (_, index) => [
          `S${index}`,
          {
            type: 'object',
            properties: Object.fromEntries(
              targets(index).map((target, slot) => [
                `p${slot}`,
                ref(`S${target}`),
              ]),
            ),
          },
        ]),
      );

    // Counts how often each schema is looked up, the unit of expansion work.
    const countReads = (schemas: Schemas) => {
      let reads = 0;
      const counted = new Proxy(schemas, {
        get: (target, key, receiver): unknown => {
          if (typeof key === 'string' && key in target) reads++;
          return Reflect.get(target, key, receiver);
        },
      });
      return {
        context: createContext(counted),
        reads: () => reads,
        reset: () => {
          reads = 0;
        },
      };
    };

    const layered = (width: number, depth: number): Schemas =>
      Object.fromEntries(
        Array.from({ length: width * depth }, (_, index) => {
          const layer = Math.floor(index / width);
          return [
            `N${index}`,
            {
              type: 'object',
              properties:
                layer === depth - 1
                  ? { leaf: { type: 'string' } }
                  : Object.fromEntries(
                      Array.from({ length: width }, (_, slot) => [
                        `p${slot}`,
                        ref(`N${(layer + 1) * width + slot}`),
                      ]),
                    ),
            },
          ];
        }),
      );

    it('keeps results right and reuses them past the variant cap', () => {
      const count = MAX_VARIANTS_PER_REF + 4;
      const schemas: Schemas = {
        X: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: count }, (_, index) => [
              `a${index}`,
              ref(`A${index}`),
            ]),
          ),
        },
        ...Object.fromEntries(
          Array.from({ length: count }, (_, index) => [
            `A${index}`,
            { type: 'object', properties: { x: ref('X') } },
          ]),
        ),
      };
      const counted = countReads(schemas);
      const shared: DereferenceOptions = {};

      for (let index = 0; index < count; index++) {
        const name = `A${index}`;
        expect(dereference(ref(name), counted.context, shared)).toEqual(
          expandNaive(schemas, ref(name)),
        );
      }

      counted.reset();
      for (let index = 0; index < count; index++) {
        dereference(ref(`A${index}`), counted.context, shared);
      }
      expect(counted.reads()).toBe(0);
    });

    it('matches plain expansion on a small layered graph', () => {
      const schemas = layered(3, 4);
      const context = createContext(schemas);
      expect(dereference(ref('N0'), context, {})).toEqual(
        expandNaive(schemas, ref('N0')),
      );
    });

    it('reads each schema of a wide layered graph a bounded number of times', () => {
      const width = 20;
      const depth = 8;
      const counted = countReads(layered(width, depth));
      const shared: DereferenceOptions = {};

      dereference(ref('N0'), counted.context, shared);

      // Without reuse this is width^depth reads.
      expect(counted.reads()).toBeLessThanOrEqual(width * depth * 2);
    });

    it('reads each schema of a random acyclic graph a bounded number of times', () => {
      const size = 200;
      let seed = 11;
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
        return seed;
      };
      const counted = countReads(
        graph(size, (index) =>
          Array.from({ length: Math.min(4, size - index - 1) }, () =>
            Math.min(size - 1, index + 1 + (next() % 25)),
          ),
        ),
      );
      const shared: DereferenceOptions = {};

      for (let index = size - 1; index >= 0; index--) {
        dereference(ref(`S${index}`), counted.context, shared);
      }

      expect(counted.reads()).toBeLessThanOrEqual(size * 4 * 2);
    });

    it('reuses results across calls on a wide layered graph', () => {
      const width = 40;
      const depth = 6;
      const counted = countReads(layered(width, depth));
      const shared: DereferenceOptions = {};

      dereference(ref('N0'), counted.context, shared);
      counted.reset();
      dereference(ref('N1'), counted.context, shared);

      expect(counted.reads()).toBeLessThanOrEqual(width * depth);
    });

    it('stops storing a ref once it has too many variants', () => {
      const count = MAX_VARIANTS_PER_REF + 4;
      const schemas: Schemas = {
        X: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: count }, (_, index) => [
              `a${index}`,
              ref(`A${index}`),
            ]),
          ),
        },
        ...Object.fromEntries(
          Array.from({ length: count }, (_, index) => [
            `A${index}`,
            { type: 'object', properties: { x: ref('X') } },
          ]),
        ),
      };
      const counted = countReads(schemas);

      // Each root stores X under a different ancestor, up to the cap.
      const full: DereferenceOptions = {};
      for (let index = 0; index < count; index++) {
        dereference(ref(`A${index}`), counted.context, full);
      }
      counted.reset();
      expect(dereference(ref('X'), counted.context, full)).toEqual(
        expandNaive(schemas, ref('X')),
      );
      counted.reset();
      dereference(ref('X'), counted.context, full);
      expect(counted.reads()).toBeGreaterThan(0);

      // With room left, the second lookup is served from the cache.
      const roomy: DereferenceOptions = {};
      dereference(ref('X'), counted.context, roomy);
      counted.reset();
      dereference(ref('X'), counted.context, roomy);
      expect(counted.reads()).toBe(0);
    });

    it('reads a chain of inline unions of refs a bounded number of times', () => {
      const size = 60;
      const schemas: Schemas = {
        Leaf: { type: 'string' },
        ...Object.fromEntries(
          Array.from({ length: size }, (_, index) => [
            `U${index}`,
            {
              type: 'object',
              properties: {
                list: {
                  type: 'array',
                  items: {
                    oneOf: [
                      ref(index === size - 1 ? 'Leaf' : `U${index + 1}`),
                      ref('Leaf'),
                    ],
                  },
                },
              },
            },
          ]),
        ),
      };
      const counted = countReads(schemas);
      const shared: DereferenceOptions = {};

      for (let index = size - 1; index >= 0; index--) {
        dereference(ref(`U${index}`), counted.context, shared);
      }

      expect(counted.reads()).toBeLessThanOrEqual(size * 4);
    });

    it('reads a large acyclic document a bounded number of times', () => {
      const size = 3000;
      let seed = 5;
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
        return seed;
      };
      const counted = countReads(
        graph(size, (index) =>
          Array.from({ length: Math.min(3, size - index - 1) }, () =>
            Math.min(size - 1, index + 1 + (next() % 40)),
          ),
        ),
      );

      dereference(ref('S0'), counted.context, {});

      // Without reuse this grows exponentially with the depth of the graph.
      expect(counted.reads()).toBeLessThanOrEqual(size * 2);
    });

    it('matches plain expansion once the tracking budget is spent', () => {
      let seed = 3;
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
        return seed;
      };
      const schemas = graph(25, () => [next() % 25, next() % 25]);
      const spent = { base: 0, perVisit: 0, perWord: 0 };
      const options: DereferenceOptions = {};
      const context = createContext(schemas);

      for (let index = 0; index < 25; index++) {
        expect(
          expandSchema(ref(`S${index}`), context, options, spent).value,
        ).toEqual(expandNaive(schemas, ref(`S${index}`)));
      }
      // Entries stored before the budget ran out stay valid for later calls.
      for (let index = 0; index < 25; index++) {
        expect(dereference(ref(`S${index}`), context, options)).toEqual(
          expandNaive(schemas, ref(`S${index}`)),
        );
      }
    });

    it('matches plain expansion on a moderate random graph', () => {
      let seed = 7;
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
        return seed;
      };
      const schemas = graph(30, () => [next() % 30, next() % 30]);
      const shared: DereferenceOptions = {};
      const context = createContext(schemas);

      for (let index = 0; index < 30; index++) {
        expect(dereference(ref(`S${index}`), context, shared)).toEqual(
          expandNaive(schemas, ref(`S${index}`)),
        );
      }
    });

    it('matches plain expansion on a fully connected graph', () => {
      const size = 8;
      const schemas = graph(size, (index) =>
        Array.from({ length: size }, (_, i) => i).filter(
          (other) => other !== index,
        ),
      );
      const shared: DereferenceOptions = {};
      const context = createContext(schemas);

      for (const index of [0, 5]) {
        expect(dereference(ref(`S${index}`), context, shared)).toEqual(
          expandNaive(schemas, ref(`S${index}`)),
        );
      }
    });

    it('matches plain expansion with offset sets on a cyclic graph past 32 refs', () => {
      let seed = 11;
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
        return seed;
      };
      // A chain with sparse back edges: cyclic, yet small enough to expand
      // plainly from every start.
      const size = 70;
      const schemas = graph(size, (index) => {
        const forward = index + 1 < size ? [index + 1] : [];
        return index % 7 === 6
          ? [...forward, index - 1 - (next() % 5)]
          : forward;
      });
      const shared: DereferenceOptions = {};
      const context = createContext(schemas);
      // Interning unrelated refs first moves every real id past word 0.
      const cache = getExpansionCache(context.spec, shared);
      for (let index = 0; index < 40; index++) {
        singleRef(cache, `#/dummy/${index}`);
      }

      for (let index = 0; index < size; index++) {
        expect(dereference(ref(`S${index}`), context, shared)).toEqual(
          expandNaive(schemas, ref(`S${index}`)),
        );
      }
    });
  });
});

describe('ref sets', () => {
  const setup = (count: number) => {
    const cache = createExpansionCache();
    const sets = Array.from({ length: count }, (_, id) =>
      singleRef(cache, `r${id}`),
    );
    return { cache, sets };
  };
  const members = (refs: RefSet): number[] =>
    [...refs.words].flatMap((word, index) =>
      Array.from({ length: 32 }, (_, bit) => bit)
        .filter((bit) => (word & (1 << bit)) !== 0)
        .map((bit) => (refs.lo + index) * 32 + bit),
    );
  const union = (
    cache: ReturnType<typeof createExpansionCache>,
    parts: RefSet[],
    own?: string,
  ) =>
    unionRefs(
      cache,
      parts.map((refs) => ({ refs })),
      own,
      { copied: 0 },
    );

  it('stores a singleton at a high id as one word', () => {
    const { sets } = setup(100);
    expect(sets[99]).toMatchObject({ lo: 3 });
    expect(sets[99].words).toHaveLength(1);
    expect(members(sets[99])).toEqual([99]);
  });

  it('keeps ids at bits 31 and 32 apart', () => {
    const { cache, sets } = setup(40);
    const merged = union(cache, [sets[31], sets[32]]);
    expect(merged.lo).toBe(0);
    expect(merged.words).toHaveLength(2);
    expect(members(merged)).toEqual([31, 32]);
  });

  it('unions sets that start past word 0', () => {
    const { cache, sets } = setup(140);
    const merged = union(cache, [sets[70], sets[130]]);
    expect(merged.lo).toBe(2);
    expect(members(merged)).toEqual([70, 130]);
  });

  it('spans the gap between distant sets', () => {
    const { cache, sets } = setup(200);
    const merged = union(cache, [sets[40], sets[199]]);
    expect(merged.lo).toBe(1);
    expect(merged.words).toHaveLength(6);
    expect(members(merged)).toEqual([40, 199]);
  });

  it('adds an own id below, inside and above the parts', () => {
    const { cache, sets } = setup(200);
    const parts = [sets[70], sets[130]];
    expect(members(union(cache, parts, 'r5'))).toEqual([5, 70, 130]);
    expect(members(union(cache, parts, 'r100'))).toEqual([70, 100, 130]);
    expect(members(union(cache, parts, 'r190'))).toEqual([70, 130, 190]);
    expect(union(cache, parts, 'r5').lo).toBe(0);
    expect(union(cache, parts, 'r190').lo).toBe(2);
  });

  it('adds an own id to a single part past word 0', () => {
    const { cache, sets } = setup(100);
    expect(members(union(cache, [sets[80]], 'r33'))).toEqual([33, 80]);
  });

  it('returns a part itself when nothing is added', () => {
    const { cache, sets } = setup(100);
    expect(union(cache, [sets[80], NO_REFS], 'r80')).toBe(sets[80]);
    expect(union(cache, [sets[80], sets[80], sets[80]])).toBe(sets[80]);
    expect(union(cache, [sets[80], sets[80]], 'r80')).toBe(sets[80]);
    expect(union(cache, [sets[80], sets[80]], 'r81')).not.toBe(sets[80]);
  });

  it('charges no work when it returns a part', () => {
    const { cache, sets } = setup(10);
    const work = { copied: 0 };
    unionRefs(cache, [{ refs: sets[3] }, { refs: sets[3] }], undefined, work);
    expect(work.copied).toBe(0);
  });

  it('returns the shared singleton for an own id alone', () => {
    const { cache, sets } = setup(50);
    expect(union(cache, [NO_REFS], 'r45')).toBe(sets[45]);
    expect(union(cache, [])).toBe(NO_REFS);
  });
});
