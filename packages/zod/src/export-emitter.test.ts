import { describe, expect, it } from 'vite-plus/test';

import { renderZodExport } from './export-emitter';

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
