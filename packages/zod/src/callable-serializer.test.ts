import { describe, expect, it } from 'vite-plus/test';

import { serializeCallable } from './callable-serializer';
import { appendZodRefinements, renderZodRefine } from './export-emitter';

const evaluate = <T>(source: string): T =>
  new Function(`return (${source});`)() as T;

describe('serializeCallable', () => {
  it('preserves self-contained arrow functions without adding a wrapper', () => {
    const validator = (value: string) => value.length > 0;
    expect(serializeCallable({ callable: validator, bindings: null })).toBe(
      `(${validator.toString()})`,
    );
  });

  it('emits a captured constant and returns an independently executable function', () => {
    const minimum = 3;
    const validator = (value: number) => value >= minimum;
    const source = serializeCallable({
      callable: validator,
      bindings: { minimum },
    });

    expect(source).toBe(
      `(() => {\n  const minimum = 3;\n  return (${validator.toString()});\n})()`,
    );
    const recreated = evaluate<(value: number) => boolean>(source);
    expect(recreated(2)).toBe(false);
    expect(recreated(3)).toBe(true);
  });

  it('recognizes locals, parameter destructuring, and nested lexical scopes', () => {
    const validator = ({ amount }: { amount: number }) => {
      const offset = 1;
      const nested = (input: number) => input + offset;
      return nested(amount) > 4;
    };

    expect(serializeCallable({ callable: validator, bindings: null })).toBe(
      `(${validator.toString()})`,
    );
  });

  it('distinguishes object keys and method names from references', () => {
    const validator = (value: number) => {
      const object = { minimum: Math.max(value, 2) };
      return object.minimum === 2;
    };

    expect(serializeCallable({ callable: validator, bindings: null })).toBe(
      `(${validator.toString()})`,
    );
  });

  it('detects free references in shorthand and computed properties', () => {
    const minimum = 5;
    const key = 'min';
    const validator = (value: number) => {
      const record = { minimum, [key]: value };
      return record.minimum <= record[key];
    };
    const source = serializeCallable({
      callable: validator,
      bindings: { minimum, key },
    });
    expect(source).toContain('const minimum = 5;');
    expect(source).toContain('const key = "min";');
    const recreated = evaluate<(value: number) => boolean>(source);
    expect(recreated(4)).toBe(false);
    expect(recreated(5)).toBe(true);
  });

  it('handles shadowing without treating shadowed variables as captures', () => {
    const threshold = 100;
    const validator = (value: number) => {
      const threshold = 2;
      return value > threshold;
    };
    expect(threshold).toBe(100);
    expect(serializeCallable({ callable: validator, bindings: null })).toBe(
      `(${validator.toString()})`,
    );
  });

  it('includes references from nested callables and catch blocks', () => {
    const maximum = 12;
    const validator = (value: number) => {
      try {
        const check = (n: number) => n < maximum;
        return check(value);
      } catch (error) {
        return error === null;
      }
    };
    const source = serializeCallable({
      callable: validator,
      bindings: { maximum },
    });
    expect(source).toContain('const maximum = 12;');
    expect(evaluate<(value: number) => boolean>(source)(10)).toBe(true);
  });

  it('captures nested JSON-like values, special numbers, bigint, and undefined', () => {
    const options = {
      limits: [1, 3, undefined, 4n],
      negativeZero: -0,
      nan: NaN,
      infinity: Infinity,
    };
    const validator = (value: number) =>
      value < Number(options.limits[1]) && Object.is(options.negativeZero, -0);
    const source = serializeCallable({
      callable: validator,
      bindings: { options },
    });
    expect(source).toContain('"limits": [1, 3, undefined, 4n]');
    expect(source).toContain('"negativeZero": -0');
    expect(source).toContain('"nan": NaN');
    expect(source).toContain('"infinity": Infinity');
    expect(evaluate<(value: number) => boolean>(source)(2)).toBe(true);
  });

  it('serializes RegExp and Date values without losing their behavior', () => {
    const pattern = /^a+$/i;
    const limit = new Date('2020-01-01T00:00:00.000Z');
    const validator = (value: string) =>
      pattern.test(value) && limit.getUTCFullYear() === 2020;
    const source = serializeCallable({
      callable: validator,
      bindings: { pattern, limit },
    });
    expect(source).toContain('const pattern = new RegExp(');
    expect(source).toContain('const limit = new Date(1577836800000);');
    expect(evaluate<(value: string) => boolean>(source)('AAA')).toBe(true);
  });

  it('preserves object keys named __proto__ without mutating the prototype', () => {
    const settings = JSON.parse('{"__proto__":{"enabled":true}}') as {
      __proto__: { enabled: boolean };
    };
    const validator = (value: boolean) =>
      settings['__proto__'].enabled === value;
    const source = serializeCallable({
      callable: validator,
      bindings: { settings },
    });
    expect(source).toContain('["__proto__"]:');
    expect(evaluate<(value: boolean) => boolean>(source)(true)).toBe(true);
  });

  it('reports all unresolved external references instead of emitting broken code', () => {
    const first = 1;
    const second = 2;
    const validator = (value: number) => value > first && value < second;
    expect(() =>
      serializeCallable({ callable: validator, bindings: null }),
    ).toThrow('unresolved external reference(s): first, second');
    expect(() =>
      serializeCallable({ callable: validator, bindings: { first } }),
    ).toThrow('unresolved external reference(s): second');
  });

  it('rejects arrow-function closures over outer arguments', () => {
    function factory(..._items: unknown[]) {
      return () => arguments.length;
    }
    const capturesArguments = factory(1);
    expect(() =>
      serializeCallable({
        callable: capturesArguments,
        bindings: { arguments: [1] },
      }),
    ).toThrow('Cannot serialize a closure over arguments');
  });

  it('quotes captured strings rather than interpolating them as source', () => {
    const message = '"; throw new Error("injected"); //';
    const validator = (value: string) => value === message;
    const source = serializeCallable({
      callable: validator,
      bindings: { message },
    });
    expect(evaluate<(value: string) => boolean>(source)(message)).toBe(true);
    expect(evaluate<(value: string) => boolean>(source)('different')).toBe(
      false,
    );
  });

  it('rejects unused bindings', () => {
    expect(() =>
      serializeCallable({
        callable: (value: number) => value > 0,
        bindings: { minimum: 2 },
      }),
    ).toThrow('Unused callable binding: minimum');
  });

  it('rejects unrepresentable values and cycles', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const fn = (value: unknown) => value !== cyclic;
    expect(() =>
      serializeCallable({ callable: fn, bindings: { cyclic } }),
    ).toThrow('cyclic');

    const callback = () => true;
    const usesCallback = (value: unknown) => callback() && Boolean(value);
    expect(() =>
      serializeCallable({ callable: usesCallback, bindings: { callback } }),
    ).toThrow('Cannot serialize captured function');

    const symbol = Symbol('s');
    const usesSymbol = (value: unknown) => value !== symbol;
    expect(() =>
      serializeCallable({ callable: usesSymbol, bindings: { symbol } }),
    ).toThrow('Cannot serialize captured symbol');
  });

  it('does not invoke getters while serializing a captured object', () => {
    const settings = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get() {
        throw new Error('getter executed');
      },
    });
    const validator = () => settings !== null;
    expect(() =>
      serializeCallable({ callable: validator, bindings: { settings } }),
    ).toThrow('Cannot serialize captured accessor');
  });

  it('rejects closures over this and unserializable native functions', () => {
    const lexical = () => this;
    expect(() =>
      serializeCallable({ callable: lexical, bindings: null }),
    ).toThrow('containing this');
    expect(() =>
      serializeCallable({ callable: Math.max, bindings: null }),
    ).toThrow('Cannot serialize a native callable as a refinement');
  });
  it('captures an OpenAPI schema object by its original parameter name', () => {
    const openapi_object = {
      type: 'number',
      minimum: 2,
      maximum: 10,
    };
    const callable = (value: number) =>
      value >= openapi_object.minimum && value <= openapi_object.maximum;

    const source = serializeCallable({
      callable,
      bindings: { openapi_object },
    });

    expect(source).toContain('const openapi_object = {');
    expect(source).toContain('"maximum": 10');
    const recreated = evaluate<(value: number) => boolean>(source);
    expect(recreated(1)).toBe(false);
    expect(recreated(2)).toBe(true);
    expect(recreated(11)).toBe(false);
  });
});

describe('bound callable refinement emission', () => {
  it('renders a classic .refine() with its captured constants scoped locally', () => {
    const maximum = 20;
    const callable = (value: number) => value <= maximum;
    expect(renderZodRefine({ callable, bindings: { maximum } })).toBe(
      `.refine((() => {\n  const maximum = 20;\n  return (${callable.toString()});\n})())`,
    );
  });

  it('requires descriptors rather than raw functions, including functions without bindings', () => {
    const callable = (value: number) => value >= 7;
    expect(() => renderZodRefine(callable)).toThrow(
      'schemaExtension must return refinement descriptors',
    );
    expect(renderZodRefine({ callable, bindings: null })).toBe(
      `.refine((${callable.toString()}))`,
    );
  });

  it('serializes OpenAPI-derived values supplied by validatorsGenerator', () => {
    const validatorsGenerator = (openapi_object: { maximum: number }) => {
      const maximum = openapi_object.maximum;
      return {
        callable: (value: number) => value <= maximum,
        bindings: { maximum },
      };
    };

    const descriptor = validatorsGenerator({ maximum: 12 });
    const source = serializeCallable(descriptor);
    const recreated = evaluate<(value: number) => boolean>(source);

    expect(source).toContain('const maximum = 12;');
    expect(recreated(12)).toBe(true);
    expect(recreated(13)).toBe(false);
    expect(renderZodRefine(descriptor)).toContain('.refine((() => {');
  });

  it('renders a Zod Mini .check(zod.refine(...)) with captured constants', () => {
    const minimum = 1;
    const callable = (value: number) => value >= minimum;
    expect(renderZodRefine({ callable, bindings: { minimum } }, 'mini')).toBe(
      `.check(/*#__PURE__*/ zod.refine((() => {\n  const minimum = 1;\n  return (${callable.toString()});\n})()))`,
    );
  });

  it('keeps each bound refinement isolated even when binding names overlap', () => {
    const minimum = 3;
    const first = (value: number) => value >= minimum;
    const second = (value: number) => value < minimum;
    const emitted = appendZodRefinements('zod.number()', [
      ['refine', [{ callable: first, bindings: { minimum } }]],
      ['refine', [{ callable: second, bindings: { minimum: 10 } }]],
    ]);
    expect(emitted).toContain('const minimum = 3;');
    expect(emitted).toContain('const minimum = 10;');
    expect(emitted.match(/const minimum = /g)).toHaveLength(2);
  });
});
