import type { ContextSpec } from '../types';

const search = String.raw`\*/`; // Find '*/'
const replacement = String.raw`*\/`; // Replace With '*\/'

const regex = new RegExp(search, 'g');

export function jsDoc(
  schema: {
    description?: string[] | string;
    deprecated?: boolean;
    summary?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    minItems?: number;
    maxItems?: number;
    type?: string | string[];
    pattern?: string;
  },
  tryOneLine = false,
  context?: ContextSpec,
): string {
  if (context?.output.override.jsDoc) {
    const { filter } = context.output.override.jsDoc;
    if (filter) {
      return keyValuePairsToJsDoc(filter(schema));
    }
  }
  const {
    description,
    deprecated,
    summary,
    minLength,
    maxLength,
    minimum,
    maximum,
    exclusiveMinimum,
    exclusiveMaximum,
    minItems,
    maxItems,
    pattern,
  } = schema;
  const isNullable =
    schema.type === 'null' ||
    (Array.isArray(schema.type) && schema.type.includes('null'));
  // Ensure there aren't any comment terminations in doc
  const lines = (
    Array.isArray(description)
      ? description.filter((d) => !d.includes('eslint-disable'))
      : [description ?? '']
  ).map((line) => line.replaceAll(regex, replacement));

  const count = [
    description,
    deprecated,
    summary,
    minLength?.toString(),
    maxLength?.toString(),
    minimum?.toString(),
    maximum?.toString(),
    exclusiveMinimum?.toString(),
    exclusiveMaximum?.toString(),
    minItems?.toString(),
    maxItems?.toString(),
    isNullable ? 'null' : '',
    pattern,
  ].filter(Boolean).length;

  if (!count) {
    return '';
  }

  const oneLine = count === 1 && tryOneLine;
  const eslintDisable = Array.isArray(description)
    ? description
        .find((d) => d.includes('eslint-disable'))
        ?.replaceAll(regex, replacement)
    : undefined;
  let doc = `${eslintDisable ? `/* ${eslintDisable} */\n` : ''}/**`;

  if (description) {
    if (!oneLine) {
      doc += `\n${tryOneLine ? '  ' : ''} *`;
    }
    doc += ` ${lines.join('\n * ')}`;
  }

  function appendPrefix() {
    if (!oneLine) {
      doc += `\n${tryOneLine ? '  ' : ''} *`;
    }
  }

  function tryAppendStringDocLine(key: string, value?: string) {
    if (value) {
      appendPrefix();
      doc += ` @${key} ${value.replaceAll(regex, replacement)}`;
    }
  }

  function tryAppendBooleanDocLine(key: string, value?: boolean) {
    if (value === true) {
      appendPrefix();
      doc += ` @${key}`;
    }
  }

  function tryAppendNumberDocLine(key: string, value?: number) {
    if (value !== undefined) {
      appendPrefix();
      doc += ` @${key} ${value}`;
    }
  }

  tryAppendBooleanDocLine('deprecated', deprecated);
  tryAppendStringDocLine('summary', summary?.replaceAll(regex, replacement));
  tryAppendNumberDocLine('minLength', minLength);
  tryAppendNumberDocLine('maxLength', maxLength);
  tryAppendNumberDocLine('minimum', minimum);
  tryAppendNumberDocLine('maximum', maximum);
  tryAppendNumberDocLine('exclusiveMinimum', exclusiveMinimum);
  tryAppendNumberDocLine('exclusiveMaximum', exclusiveMaximum);
  tryAppendNumberDocLine('minItems', minItems);
  tryAppendNumberDocLine('maxItems', maxItems);
  tryAppendBooleanDocLine('nullable', isNullable);
  tryAppendStringDocLine('pattern', pattern);

  doc += oneLine ? ' ' : `\n ${tryOneLine ? '  ' : ''}`;

  doc += '*/\n';

  return doc;
}

export function keyValuePairsToJsDoc(
  keyValues: {
    key: string;
    value: string;
  }[],
) {
  if (keyValues.length === 0) return '';
  let doc = '/**\n';
  for (const { key, value } of keyValues) {
    doc += ` * @${key} ${value}\n`;
  }
  doc += ' */\n';
  return doc;
}
