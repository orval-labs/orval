const search = '\\*/'; // Find '*/'
const replacement = '*\\/'; // Replace With '*\/'

const regex = new RegExp(search, 'g');

export function jsDoc(
  {
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
    nullable,
    pattern,
  }: {
    description?: string[] | string;
    deprecated?: boolean;
    summary?: string;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: boolean;
    exclusiveMaximum?: boolean;
    minItems?: number;
    maxItems?: number;
    nullable?: boolean;
    pattern?: string;
  },
  tryOneLine = false,
): string {
  // Ensure there aren't any comment terminations in doc
  const lines = (
    Array.isArray(description)
      ? description.filter((d) => !d.includes('eslint-disable'))
      : [description || '']
  ).map((line) => line.replace(regex, replacement));

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
    nullable?.toString(),
    pattern,
  ].reduce((acc, it) => (it ? acc + 1 : acc), 0);

  if (!count) {
    return '';
  }

  const oneLine = count === 1 && tryOneLine;
  const eslintDisable = Array.isArray(description)
    ? description
        .find((d) => d.includes('eslint-disable'))
        ?.replace(regex, replacement)
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
      doc += ` @${key} ${value}`;
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
  tryAppendStringDocLine('summary', summary?.replace(regex, replacement));
  tryAppendNumberDocLine('minLength', minLength);
  tryAppendNumberDocLine('maxLength', maxLength);
  tryAppendNumberDocLine('minimum', minimum);
  tryAppendNumberDocLine('maximum', maximum);
  tryAppendBooleanDocLine('exclusiveMinimum', exclusiveMinimum);
  tryAppendBooleanDocLine('exclusiveMaximum', exclusiveMaximum);
  tryAppendNumberDocLine('minItems', minItems);
  tryAppendNumberDocLine('maxItems', maxItems);
  tryAppendBooleanDocLine('nullable', nullable);
  tryAppendStringDocLine('pattern', pattern);

  doc += !oneLine ? `\n ${tryOneLine ? '  ' : ''}` : ' ';

  doc += '*/\n';

  return doc;
}
