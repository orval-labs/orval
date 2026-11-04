import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestContextSpec } from '../../test-utils';
import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiSchemaObject,
} from '../../types';
import { dereference } from './dereference';
import type { DereferenceOptions } from './types';

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
});
