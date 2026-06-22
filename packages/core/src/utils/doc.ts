import type { ContextSpec } from '../types';

const search = String.raw`\*/`; // Find '*/'
const replacement = String.raw`*\/`; // Replace With '*\/'

const regex = new RegExp(search, 'g');

interface JsDocSchema extends Record<string, unknown> {
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
  items?: JsDocSchema;
}

interface JsDocEntry {
  key: string;
  value: boolean | number | string;
}

function trimTrailingEmptyLines(lines: string[]): string[] {
  let lastLineIndex = lines.length - 1;

  while (lastLineIndex >= 0 && lines[lastLineIndex]?.trim() === '') {
    lastLineIndex--;
  }

  return lines.slice(0, lastLineIndex + 1);
}

function escapeJsDoc(value: string): string {
  return value.replaceAll(regex, replacement);
}

function getDescriptionLines(description?: string[] | string): string[] {
  const descriptionBlocks = Array.isArray(description)
    ? description.filter((line) => !line.includes('eslint-disable'))
    : [description ?? ''];

  return trimTrailingEmptyLines(
    descriptionBlocks.flatMap((block) =>
      block.split(/\r?\n/).map((line) => escapeJsDoc(line)),
    ),
  );
}

function getEslintDisable(description?: string[] | string): string | undefined {
  return Array.isArray(description)
    ? description.find((line) => line.includes('eslint-disable'))
    : undefined;
}

const itemValidationKeys = [
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'pattern',
] as const satisfies readonly (keyof JsDocSchema)[];

function getItemValidationDocEntries(
  schema?: JsDocSchema,
  prefix = 'items',
  visited = new WeakSet<JsDocSchema>(),
): JsDocEntry[] {
  if (!schema) {
    return [];
  }
  if (visited.has(schema)) {
    return [];
  }
  visited.add(schema);

  const entries = itemValidationKeys.flatMap((key) => {
    const value = schema[key];

    return value === undefined ? [] : [{ key: `${prefix}.${key}`, value }];
  });

  return [
    ...entries,
    ...getItemValidationDocEntries(schema.items, `${prefix}.items`, visited),
  ];
}

function toJsDocEntry(
  key: string,
  value?: boolean | number | string,
): JsDocEntry[] {
  if (value === undefined || value === false || value === '') {
    return [];
  }

  return [{ key, value }];
}

function getSchemaDocEntries(
  schema: JsDocSchema,
  itemValidationDocEntries: JsDocEntry[],
  isNullable: boolean,
): JsDocEntry[] {
  const {
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

  return [
    ...toJsDocEntry('deprecated', deprecated),
    ...toJsDocEntry('summary', summary),
    ...toJsDocEntry('minLength', minLength),
    ...toJsDocEntry('maxLength', maxLength),
    ...toJsDocEntry('minimum', minimum),
    ...toJsDocEntry('maximum', maximum),
    ...toJsDocEntry('exclusiveMinimum', exclusiveMinimum),
    ...toJsDocEntry('exclusiveMaximum', exclusiveMaximum),
    ...toJsDocEntry('minItems', minItems),
    ...toJsDocEntry('maxItems', maxItems),
    ...toJsDocEntry('nullable', isNullable),
    ...toJsDocEntry('pattern', pattern),
    ...itemValidationDocEntries.flatMap(({ key, value }) =>
      toJsDocEntry(key, value),
    ),
  ];
}

function formatJsDocEntry({ key, value }: JsDocEntry): string {
  if (value === true) {
    return `@${key}`;
  }

  return `@${key} ${escapeJsDoc(value.toString())}`;
}

function renderJsDocBlock(lines: string[], tryOneLine = false): string {
  if (lines.length === 0) {
    return '';
  }

  if (lines.length === 1 && tryOneLine) {
    return `/** ${lines[0]} */\n`;
  }

  const linePrefix = `${tryOneLine ? '  ' : ''} *`;
  const closingPrefix = ` ${tryOneLine ? '  ' : ''}`;

  return `/**\n${lines
    .map((line) => `${linePrefix}${line ? ` ${line}` : ''}`)
    .join('\n')}\n${closingPrefix}*/\n`;
}

export function jsDoc(
  schema: object & JsDocSchema,
  tryOneLine = false,
  context?: ContextSpec,
): string {
  if (context?.output.override.jsDoc) {
    const { filter } = context.output.override.jsDoc;
    if (filter) {
      return keyValuePairsToJsDoc(filter(schema));
    }
  }

  const isNullable =
    schema.type === 'null' ||
    (Array.isArray(schema.type) && schema.type.includes('null'));
  const itemValidationDocEntries = getItemValidationDocEntries(schema.items);
  const lines = [
    ...getDescriptionLines(schema.description),
    ...getSchemaDocEntries(schema, itemValidationDocEntries, isNullable).map(
      (entry) => formatJsDocEntry(entry),
    ),
  ];
  const eslintDisable = getEslintDisable(schema.description);
  const doc = renderJsDocBlock(lines, tryOneLine);

  return `${eslintDisable ? `/* ${escapeJsDoc(eslintDisable)} */\n` : ''}${doc}`;
}

export function keyValuePairsToJsDoc(
  keyValues: {
    key: string;
    value: string;
  }[],
) {
  return renderJsDocBlock(
    keyValues.map(({ key, value }) => `@${key} ${value}`),
  );
}
