import type { BoundRefinement } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  appendZodRefinements,
  renderZodExport,
  renderZodRefine,
} from './export-emitter';

describe('renderZodExport', () => {
  it('renders a plain export const with no brand and no companion types', () => {
    expect(
      renderZodExport({
        name: 'ListPetsParams',
        expression: 'zod.object({ limit: zod.number() })',
        variant: 'classic',
      }),
    ).toBe('export const ListPetsParams = zod.object({ limit: zod.number() })');
  });

  describe('brand', () => {
    it('appends a Zod v4 brand call when isZodV4 is true', () => {
      expect(
        renderZodExport({
          name: 'ListPetsBody',
          expression: 'zod.object({})',
          variant: 'classic',
          brand: { isZodV4: true },
        }),
      ).toBe(
        'export const ListPetsBody = zod.object({}).brand("ListPetsBody")',
      );
    });

    it('appends a Zod v3 brand call when isZodV4 is false', () => {
      expect(
        renderZodExport({
          name: 'ListPetsBody',
          expression: 'zod.object({})',
          variant: 'classic',
          brand: { isZodV4: false },
        }),
      ).toBe(
        'export const ListPetsBody = zod.object({}).brand<"ListPetsBody">()',
      );
    });

    it('omits the brand call when brand is unset', () => {
      expect(
        renderZodExport({
          name: 'ListPetsBody',
          expression: 'zod.object({})',
          variant: 'classic',
        }),
      ).toBe('export const ListPetsBody = zod.object({})');
    });
  });

  describe('companion types', () => {
    it('adds zod.input/zod.output companion type aliases when enabled', () => {
      expect(
        renderZodExport({
          name: 'Pet',
          expression: 'zod.object({ name: zod.string() })',
          variant: 'classic',
          companionTypes: true,
        }),
      ).toBe(
        'export const Pet = zod.object({ name: zod.string() })\n\n' +
          'export type Pet = zod.input<typeof Pet>;\n' +
          'export type PetOutput = zod.output<typeof Pet>;',
      );
    });

    it('omits companion type aliases when disabled', () => {
      expect(
        renderZodExport({
          name: 'Pet',
          expression: 'zod.object({ name: zod.string() })',
          variant: 'classic',
        }),
      ).toBe('export const Pet = zod.object({ name: zod.string() })');
    });

    it('reproduces the reusable-entry semicolon convention when the caller includes it in the expression', () => {
      expect(
        renderZodExport({
          name: 'Pet',
          expression: 'zod.object({ name: zod.string() });',
          variant: 'classic',
          companionTypes: true,
        }),
      ).toBe(
        'export const Pet = zod.object({ name: zod.string() });\n\n' +
          'export type Pet = zod.input<typeof Pet>;\n' +
          'export type PetOutput = zod.output<typeof Pet>;',
      );
    });
  });

  describe('array Item split', () => {
    it('splits into an Item schema and an unbounded array wrapper (classic)', () => {
      expect(
        renderZodExport({
          name: 'ListPetsResponse',
          expression: 'zod.object({ id: zod.number() })',
          variant: 'classic',
          arrayItem: {},
        }),
      ).toBe(
        'export const ListPetsResponseItem = zod.object({ id: zod.number() })\n' +
          'export const ListPetsResponse = zod.array(ListPetsResponseItem)',
      );
    });

    it('applies min/max bounds for the classic array wrapper', () => {
      expect(
        renderZodExport({
          name: 'ListPetsResponse',
          expression: 'zod.object({ id: zod.number() })',
          variant: 'classic',
          arrayItem: { rules: { min: 1, max: 10 } },
        }),
      ).toBe(
        'export const ListPetsResponseItem = zod.object({ id: zod.number() })\n' +
          'export const ListPetsResponse = zod.array(ListPetsResponseItem).min(1).max(10)',
      );
    });

    it('uses the Mini functional array call with no bounds', () => {
      expect(
        renderZodExport({
          name: 'ListPetsResponse',
          expression: '/*#__PURE__*/ zod.object({ id: zod.number() })',
          variant: 'mini',
          arrayItem: {},
        }),
      ).toBe(
        'export const ListPetsResponseItem = /*#__PURE__*/ zod.object({ id: zod.number() })\n' +
          'export const ListPetsResponse = /*#__PURE__*/ zod.array(ListPetsResponseItem)',
      );
    });

    it('uses Mini .check() calls for min/max bounds', () => {
      expect(
        renderZodExport({
          name: 'ListPetsResponse',
          expression: '/*#__PURE__*/ zod.object({ id: zod.number() })',
          variant: 'mini',
          arrayItem: { rules: { min: 1, max: 10 } },
        }),
      ).toBe(
        'export const ListPetsResponseItem = /*#__PURE__*/ zod.object({ id: zod.number() })\n' +
          'export const ListPetsResponse = /*#__PURE__*/ zod.array(ListPetsResponseItem)' +
          '.check(/*#__PURE__*/ zod.minLength(1)).check(/*#__PURE__*/ zod.maxLength(10))',
      );
    });

    it('gives both the Item schema and the wrapper their own companion type pair', () => {
      expect(
        renderZodExport({
          name: 'CreatePetsBody',
          expression: 'zod.object({ name: zod.string() })',
          variant: 'classic',
          companionTypes: true,
          arrayItem: {},
        }),
      ).toBe(
        'export const CreatePetsBodyItem = zod.object({ name: zod.string() })\n\n' +
          'export type CreatePetsBodyItem = zod.input<typeof CreatePetsBodyItem>;\n' +
          'export type CreatePetsBodyItemOutput = zod.output<typeof CreatePetsBodyItem>;\n\n' +
          'export const CreatePetsBody = zod.array(CreatePetsBodyItem)\n\n' +
          'export type CreatePetsBody = zod.input<typeof CreatePetsBody>;\n' +
          'export type CreatePetsBodyOutput = zod.output<typeof CreatePetsBody>;',
      );
    });

    it('brands only the wrapper, so its Output companion carries the brand while the Item pair does not', () => {
      expect(
        renderZodExport({
          name: 'CreatePetsBody',
          expression: 'zod.object({ name: zod.string() })',
          variant: 'classic',
          companionTypes: true,
          brand: { isZodV4: true },
          arrayItem: {},
        }),
      ).toBe(
        'export const CreatePetsBodyItem = zod.object({ name: zod.string() })\n\n' +
          'export type CreatePetsBodyItem = zod.input<typeof CreatePetsBodyItem>;\n' +
          'export type CreatePetsBodyItemOutput = zod.output<typeof CreatePetsBodyItem>;\n\n' +
          'export const CreatePetsBody = zod.array(CreatePetsBodyItem).brand("CreatePetsBody")\n\n' +
          'export type CreatePetsBody = zod.input<typeof CreatePetsBody>;\n' +
          'export type CreatePetsBodyOutput = zod.output<typeof CreatePetsBody>;',
      );
    });

    it('brands the array wrapper but never the Item schema', () => {
      expect(
        renderZodExport({
          name: 'ListPetsResponse',
          expression: 'zod.object({ id: zod.number() })',
          variant: 'classic',
          brand: { isZodV4: true },
          arrayItem: {},
        }),
      ).toBe(
        'export const ListPetsResponseItem = zod.object({ id: zod.number() })\n' +
          'export const ListPetsResponse = zod.array(ListPetsResponseItem).brand("ListPetsResponse")',
      );
    });
  });

  describe('recursive pin', () => {
    it('renders the TS type, the pinned const, and the Output companion type', () => {
      expect(
        renderZodExport({
          name: 'Category',
          expression: 'zod.lazy(() => CategorySchema)',
          variant: 'classic',
          recursivePin: { tsBody: '{ name: string; parent?: Category }' },
        }),
      ).toBe(
        'export type Category = { name: string; parent?: Category };\n\n' +
          'export const Category: zod.ZodType<Category> = zod.lazy(() => CategorySchema);\n\n' +
          'export type CategoryOutput = zod.output<typeof Category>;',
      );
    });

    it('uses ZodMiniType for the mini variant', () => {
      expect(
        renderZodExport({
          name: 'Category',
          expression: 'zod.lazy(() => CategorySchema)',
          variant: 'mini',
          recursivePin: { tsBody: '{ name: string }' },
        }),
      ).toBe(
        'export type Category = { name: string };\n\n' +
          'export const Category: zod.ZodMiniType<Category> = zod.lazy(() => CategorySchema);\n\n' +
          'export type CategoryOutput = zod.output<typeof Category>;',
      );
    });
  });
});

const isNonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.length > 0;
const isShortString = (value: unknown) =>
  typeof value === 'string' && value.length <= 10;

const nonEmptyDescriptor = { callable: isNonEmptyString, bindings: null };
const shortStringDescriptor = { callable: isShortString, bindings: null };

describe('schemaExtension refinement emission', () => {
  it('renders each predicate as a separate classic Zod .refine()', () => {
    expect(renderZodRefine([nonEmptyDescriptor, shortStringDescriptor])).toBe(
      `.refine((${isNonEmptyString.toString()}))` +
        `.refine((${isShortString.toString()}))`,
    );
  });

  it('renders refinements for Zod Mini using .check(zod.refine(...))', () => {
    expect(renderZodRefine([nonEmptyDescriptor], 'mini')).toBe(
      `.check(/*#__PURE__*/ zod.refine((${isNonEmptyString.toString()})))`,
    );
  });

  it('accepts an individual descriptor and an empty list', () => {
    expect(renderZodRefine(nonEmptyDescriptor, 'classic')).toBe(
      `.refine((${isNonEmptyString.toString()}))`,
    );
    expect(renderZodRefine([])).toBe('');
  });

  it('uses version-specific BoundRefinement option types', () => {
    const callable = (value: number) => value > 0;
    const zod3: BoundRefinement<number, 3> = {
      callable,
      options: (value) => ({ message: `Invalid ${value}`, path: ['quantity'] }),
      bindings: null,
    };
    const zod4: BoundRefinement<number, 4> = {
      callable,
      options: {
        error: (issue) => `Invalid ${String(issue.input)}`,
        abort: true,
      },
      bindings: null,
    };
    const invalidZod3: BoundRefinement<number, 3> = {
      callable,
      // @ts-expect-error `error` is only supported by Zod 4.
      options: { error: 'Not a Zod 3 option' },
      bindings: null,
    };
    const invalidZod4: BoundRefinement<number, 4> = {
      callable,
      // @ts-expect-error Zod 4 removes functions as the second argument.
      options: (value: number) => ({ message: String(value) }),
      bindings: null,
    };
    expect(renderZodRefine(zod3, 'classic', 3)).toContain('message');
    expect(renderZodRefine(zod4, 'classic', 4)).toContain('abort');
    expect(invalidZod3.options).toEqual({ error: 'Not a Zod 3 option' });
    expect(() => renderZodRefine(invalidZod4, 'classic', 4)).toThrow('Zod 4');
  });

  it('renders static Zod 3 refinement options as the second argument', () => {
    const callable = (value: number) => value > 0;
    expect(
      renderZodRefine(
        {
          callable,
          options: {
            message: 'Must be positive',
            path: ['quantity'],
            params: { min: 0 },
          },
          bindings: null,
        },
        'classic',
        3,
      ),
    ).toBe(
      `.refine((${callable.toString()}), { "message": "Must be positive", "path": ["quantity"], "params": { "min": 0 } })`,
    );
    expect(
      renderZodRefine(
        { callable, options: 'Required', bindings: null },
        'classic',
        3,
      ),
    ).toBe(`.refine((${callable.toString()}), "Required")`);
  });

  it('renders a Zod 3 options factory with the predicate in the same closure', () => {
    const minimum = 4;
    const callable = (value: number) => value >= minimum;
    const options = (value: number) => ({
      message: `Expected >= ${minimum}; got ${value}`,
    });
    const output = renderZodRefine(
      { callable, options, bindings: { minimum } },
      'classic',
      3,
    );
    expect(output).toContain('.refine(...(() => {');
    expect(output).toContain('const minimum = 4;');
    expect(output).toContain('] as const;');
    expect(output).toContain(options.toString());
  });

  it('renders Zod 4 options with error/when callbacks for classic and Mini', () => {
    const maximum = 8;
    const descriptor = {
      callable: (value: number) => value <= maximum,
      options: {
        error: (issue: { input: unknown }) =>
          `Input ${String(issue.input)} exceeds ${maximum}`,
        abort: true,
        when: ({ value }: { value: unknown }) => typeof value === 'number',
        params: { maximum },
      },
      bindings: { maximum },
    };
    const classic = renderZodRefine(descriptor, 'classic', 4);
    const mini = renderZodRefine(descriptor, 'mini', 4);
    expect(classic).toContain('.refine(...(() => {');
    expect(mini).toContain('.check(/*#__PURE__*/ zod.refine(...(() => {');
    expect(classic).toContain('"abort": true');
    expect(classic).toContain('"when": (');
    expect(classic).toContain('"error": (');
    expect(classic).toContain('"params": { "maximum": 8 }');
    expect(mini).toContain('const maximum = 8;');
  });

  it('forwards the selected version from appendZodRefinements', () => {
    const descriptor = {
      callable: (value: number) => value > 0,
      options: (value: number) => ({ message: `bad: ${value}` }),
      bindings: null,
    };
    expect(
      appendZodRefinements(
        'zod.number()',
        [['refine', descriptor]],
        'classic',
        3,
      ),
    ).toContain('.refine(');
    expect(() =>
      appendZodRefinements(
        'zod.number()',
        [['refine', descriptor]],
        'classic',
        4,
      ),
    ).toThrow(
      'Zod 4 does not support a function as the second refine argument',
    );
    expect(() => renderZodRefine(nonEmptyDescriptor, 'mini', 3)).toThrow(
      'Zod Mini requires Zod 4',
    );
  });

  it('rejects legacy message descriptors and malformed options at the renderer boundary', () => {
    const invalid = [
      { callable: isNonEmptyString, message: 'Legacy', bindings: null },
      { callable: isNonEmptyString, options: 123, bindings: null },
      { callable: isNonEmptyString, options: null, bindings: null },
      { callable: isNonEmptyString, options: [], bindings: null },
    ];
    for (const value of invalid) {
      expect(() => renderZodRefine(value)).toThrow(
        'schemaExtension must return refinement descriptors',
      );
    }
  });

  it('rejects raw functions and invalid descriptors', () => {
    const invalidInputs: unknown[] = [
      isNonEmptyString,
      [isNonEmptyString],
      'not a descriptor',
      { callable: isNonEmptyString },
      { callable: 42, bindings: null },
      { callable: isNonEmptyString, bindings: [] },
      { callable: isNonEmptyString, bindings: 1 },
    ];

    for (const input of invalidInputs) {
      expect(() => renderZodRefine(input)).toThrow(
        'schemaExtension must return refinement descriptors',
      );
    }
  });

  it('rejects native callables even inside otherwise valid descriptors', () => {
    expect(() =>
      renderZodRefine({ callable: Math.max, bindings: null }),
    ).toThrow('Cannot serialize a native callable as a refinement');
  });

  it('allows each descriptor to capture values from its generator scope', () => {
    const maximum = 9;
    const callable = (value: number) => value <= maximum;
    const emitted = renderZodRefine({ callable, bindings: { maximum } });

    expect(emitted).toBe(
      `.refine((() => {\n  const maximum = 9;\n  return (${callable.toString()});\n})())`,
    );
  });

  it('appends refinement descriptors in order and ignores non-refinement entries', () => {
    const expression = appendZodRefinements('zod.string()', [
      ['refine', [nonEmptyDescriptor]],
      ['describe', "'name'"],
      ['refine', [shortStringDescriptor]],
      ['optional', undefined],
    ]);

    expect(expression).toBe(
      `zod.string().refine((${isNonEmptyString.toString()}))` +
        `.refine((${isShortString.toString()}))`,
    );
  });

  it('rejects raw function entries forwarded through appendZodRefinements', () => {
    expect(() =>
      appendZodRefinements('zod.string()', [['refine', [isNonEmptyString]]]),
    ).toThrow('schemaExtension must return refinement descriptors');
  });

  it('appends Zod Mini refinements without rewriting the existing expression', () => {
    expect(
      appendZodRefinements(
        '/*#__PURE__*/ zod.object({})',
        [['refine', [nonEmptyDescriptor]]],
        'mini',
      ),
    ).toBe(
      '/*#__PURE__*/ zod.object({})' +
        `.check(/*#__PURE__*/ zod.refine((${isNonEmptyString.toString()})))`,
    );
  });
});
