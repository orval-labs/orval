import { describe, expect, it } from 'vite-plus/test';

import type { GeneratorSchema } from '../types';
import { generateModelsInline } from './models-inline';

const objectModel = (
  name: string,
  body = '{\n  id: string;\n}',
  doc = '',
): GeneratorSchema => ({
  name,
  model: `${doc}export type ${name} = ${body};\n`,
  imports: [],
  kind: 'schema',
});

describe('generateModelsInline', () => {
  it('preserves the existing output unless deduplication is enabled', () => {
    const schemas = [objectModel('First'), objectModel('Second')];
    const expected = schemas.map(({ model }) => `${model}\n`).join('');
    expect(generateModelsInline(schemas)).toBe(expected);
    expect(generateModelsInline(schemas, false)).toBe(expected);
  });

  it('keeps every public name and its own JSDoc without creating alias chains', () => {
    const first = objectModel('First', undefined, '/** First DTO. */\n');
    const second = objectModel('Second', undefined, '/** Second DTO. */\n');
    const third = objectModel('Third');
    expect(generateModelsInline([first, second, third], true)).toBe(
      `${first.model}\n/** Second DTO. */\nexport type Second = First;\n\nexport type Third = First;\n\n`,
    );
    expect(second.model).toContain('id: string');
  });

  it('accepts grouped inputs and scopes reuse to one generated module', () => {
    const first = objectModel('First');
    const second = objectModel('Second');
    expect(generateModelsInline({ a: [first], b: [second] }, true)).toContain(
      'export type Second = First;',
    );
    expect(generateModelsInline([second], true)).toBe(`${second.model}\n`);
  });

  it.each([
    '{\n  id?: string;\n}',
    '{\n  readonly id: string;\n}',
    '{\n  id: number;\n}',
    '{\n  /** Identifier. */\n  id: string;\n}',
  ])('preserves differences in the emitted body: %s', (body) => {
    const first = objectModel('First');
    const second = objectModel('Second', body);
    expect(generateModelsInline([first, second], true)).toBe(
      `${first.model}\n${second.model}\n`,
    );
  });

  it('compares imported bindings, independently of import order', () => {
    const body = '{ value: Value; key: Key }';
    const first = objectModel('First', body);
    first.imports = [
      { name: 'Value', importPath: './a' },
      { name: 'Key', importPath: './key' },
    ];
    const second = {
      ...objectModel('Second', body),
      imports: [...first.imports].reverse(),
    };
    const third = {
      ...objectModel('Third', body),
      imports: [{ name: 'Value', importPath: './b' }, first.imports[1]],
    };
    const result = generateModelsInline([first, second, third], true);
    expect(result).toContain('export type Second = First;');
    expect(result).toContain(third.model);
  });

  it.each([
    'export interface Second { id: string }\n',
    'export type Second<T> = { id: T };\n',
    'export type Second = string;\n',
    'export type Second = First;\n',
    'export const Second = { id: "id" } as const;\nexport type Second = typeof Second;\n',
    'export type Second = { id: string };\nexport const extra = {};\n',
    'export type Second = { id: string };\nexport type Extra = {};\n',
  ])('leaves other declaration forms intact: %s', (model) => {
    const first = objectModel('First', '{ id: string }');
    const second = { ...objectModel('Second'), model };
    expect(generateModelsInline([first, second], true)).toBe(
      `${first.model}\n${model}\n`,
    );
  });

  it('does not rewrite a type mentioned in documentation or an enum', () => {
    const first = objectModel('First');
    const second = objectModel(
      'Second',
      undefined,
      '/**\n * Example: export type Second = { id: number };\n */\n',
    );
    const enumModel = { ...objectModel('Enum'), kind: 'enum' as const };
    const result = generateModelsInline([first, second, enumModel], true);
    expect(result).toContain(
      '/**\n * Example: export type Second = { id: number };\n */\nexport type Second = First;',
    );
    expect(result).toContain(enumModel.model);
  });

  it('does not introduce self aliases for a repeated schema name', () => {
    const first = objectModel('First');
    const result = generateModelsInline([first, first], true);
    expect(result).toBe(`${first.model}\n${first.model}\n`);
  });

  it('keeps a short definition when the canonical name would increase its size', () => {
    const first = objectModel('LongCanonicalModelName', '{}');
    const second = objectModel('Second', '{}');
    expect(generateModelsInline([first, second], true)).toBe(
      `${first.model}\n${second.model}\n`,
    );
  });

  it.each(['unique symbol', 'unique/**/symbol'])(
    'preserves nominally distinct %s declarations',
    (symbolType) => {
      const body = `{ readonly brand: ${symbolType} }`;
      const first = objectModel('First', body);
      const second = objectModel('Second', body);
      expect(generateModelsInline([first, second], true)).toBe(
        `${first.model}\n${second.model}\n`,
      );
    },
  );
});
