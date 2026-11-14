import { describe, expect, it } from 'vite-plus/test';

import type { EffectValidationSchemaDefinition } from '.';
import { renderEffectType } from './render-type';

type Definition = EffectValidationSchemaDefinition;
type RenderTypeOptions = Parameters<typeof renderEffectType>[1];

const def = (...functions: [string, unknown][]): Definition => ({
  functions,
  consts: [],
});

const options: RenderTypeOptions = {
  direction: 'type',
  exactOptional: false,
  isEffectV4: true,
  declared: new Map([['Node', 'NodeEncoded']]),
};

const render = (
  definition: Definition,
  overrides: Partial<RenderTypeOptions> = {},
) => renderEffectType(definition, { ...options, ...overrides });

describe('renderEffectType', () => {
  it('reads a declared constant by name and another off its constant', () => {
    const node = def(['ref', 'Node']);
    const leaf = def(['ref', 'Leaf']);
    expect(render(node)).toBe('Node');
    expect(render(node, { direction: 'encoded' })).toBe('NodeEncoded');
    expect(render(leaf)).toBe('S.Schema.Type<typeof Leaf>');
    expect(render(leaf, { direction: 'encoded' })).toBe(
      'S.Codec.Encoded<typeof Leaf>',
    );
    expect(render(leaf, { direction: 'encoded', isEffectV4: false })).toBe(
      'S.Schema.Encoded<typeof Leaf>',
    );
  });

  it('reads a formatSchema expression off its constant, or as unknown', () => {
    expect(render(def(['formatSchema', 'Mod.Dayjs']))).toBe(
      'S.Schema.Type<typeof Mod.Dayjs>',
    );
    expect(render(def(['formatSchema', 'make()']))).toBe('unknown');
  });

  it('types a date by direction', () => {
    expect(render(def(['date', undefined]))).toBe('Date');
    expect(render(def(['date', undefined]), { direction: 'encoded' })).toBe(
      'string',
    );
  });

  it('types unions, intersections and open objects', () => {
    const a = def(['string', undefined]);
    const b = def(['null', undefined]);
    expect(render(def(['oneOf', [a, b]]))).toBe('string | null');
    expect(
      render(def(['allOf', [def(['oneOf', [a, b]]), a]]), {
        isEffectV4: false,
      }),
    ).toBe('(string | null) & string');
    expect(render(def(['looseObject', {}]))).toBe(
      '{} & { readonly [x: string]: unknown }',
    );
    expect(render(def(['oneOf', []]))).toBe('never');
  });

  it('lets a later allOf member replace a key of an earlier one on Effect 4', () => {
    const member = (type: string) =>
      def(['object', { tag: def([type, undefined]) }]);
    const members = [member('string'), member('null')];
    expect(render(def(['allOf', members]))).toBe('{ readonly "tag": null }');
    expect(render(def(['allOf', members]), { isEffectV4: false })).toBe(
      '{ readonly "tag": string } & { readonly "tag": null }',
    );
  });

  it('merges each alternative of an allOf union', () => {
    const object = (key: string) =>
      def(['object', { [key]: def(['string', undefined]) }]);
    const union = def(['oneOf', [object('a'), object('b')]]);
    expect(render(def(['allOf', [union, object('c')]]))).toBe(
      '{ readonly "a": string; readonly "c": string } | { readonly "b": string; readonly "c": string }',
    );
  });

  describe('an allOf that merges open and nullable members on Effect 4', () => {
    const field = (type = 'string') => def([type, undefined]);
    const object = (fields: Record<string, Definition>) =>
      def(['object', fields]);
    const loose = (fields: Record<string, Definition> = {}) =>
      def(['looseObject', fields]);
    const open = '{ readonly [x: string]: unknown }';

    it('keeps the keys of the members before an open one', () => {
      const pure = def(['additionalProperties', def(['unknown', undefined])]);
      for (const member of [loose(), pure]) {
        expect(render(def(['allOf', [object({ a: field() }), member]]))).toBe(
          `{ readonly "a": string } & ${open}`,
        );
      }
    });

    it('keeps the keys of an open member that others follow', () => {
      expect(
        render(
          def(['allOf', [loose({ a: field() }), object({ kids: field() })]]),
        ),
      ).toBe(`{ readonly "a": string; readonly "kids": string } & ${open}`);
    });

    it('adds the open signature once', () => {
      expect(
        render(def(['allOf', [loose({ a: field() }), loose({ b: field() })]])),
      ).toBe(`{ readonly "a": string; readonly "b": string } & ${open}`);
    });

    it('leaves out the null of a member unless every member admits it', () => {
      const nullable = (fields: Record<string, Definition>) =>
        def(['object', fields], ['nullable', undefined]);
      expect(
        render(
          def([
            'allOf',
            [nullable({ id: field() }), object({ kids: field() })],
          ]),
        ),
      ).toBe('{ readonly "id": string; readonly "kids": string }');
      expect(
        render(
          def([
            'allOf',
            [nullable({ id: field() }), nullable({ kids: field() })],
          ]),
        ),
      ).toBe('{ readonly "id": string; readonly "kids": string } | null');
    });
  });

  it('types an array of never as the empty tuple', () => {
    expect(render(def(['array', def(['never', undefined])]))).toBe(
      'readonly []',
    );
    expect(render(def(['array', def(['enum', '[]'])]))).toBe(
      'ReadonlyArray<never>',
    );
  });

  it('types a default and an optional key by direction', () => {
    const fields = {
      size: def(['number', undefined], ['default', 'sizeDefault']),
      tag: def(['string', undefined], ['optional', undefined]),
      note: def(['string', undefined], ['nullish', undefined]),
    };
    expect(render(def(['object', fields]))).toBe(
      '{ readonly "size": number; readonly "tag"?: string | undefined; readonly "note"?: string | null | undefined }',
    );
    expect(render(def(['object', fields]), { direction: 'encoded' })).toBe(
      '{ readonly "size"?: number | undefined; readonly "tag"?: string | undefined; readonly "note"?: string | null | undefined }',
    );
    expect(render(def(['object', fields]), { exactOptional: true })).toContain(
      'readonly "tag"?: string;',
    );
  });

  it('types an optional item with undefined', () => {
    expect(
      render(
        def(['array', def(['string', undefined], ['optional', undefined])]),
      ),
    ).toBe('ReadonlyArray<string | undefined>');
  });
});
