import { keyword } from 'esutils';

import type { NamingConvention } from '../types';
import { EnumGeneration, type OpenApiSchemaObject } from '../types';
import {
  conventionName,
  isNumeric,
  isString,
  jsStringEscape,
  jsStringLiteralEscape,
  sanitize,
} from '../utils';

type EnumConstBranch = {
  const?: SchemaEnumValue;
  enum?: SchemaEnumValue[];
  title?: string;
  type?: string | string[];
  description?: string;
  deprecated?: boolean;
};

/** Bridge type for enum values from AnyOtherAttribute-infected schema extensions */
type SchemaEnumValue = string | number | boolean | null;

/** Represents x-enumnames,... and x-enumdescriptions,... values */
type EnumMetadata = string[] | Record<string, string>;

/**
 * Normalized representation of an enum member, independent of how it was
 * authored in the OpenAPI schema (vendor extensions or `oneOf` + `const`).
 *
 * Used as the shared model for TypeScript and Zod code generation.
 */
export type EnumMember = {
  value: SchemaEnumValue;
  name?: string;
  description?: string;
  deprecated?: boolean;
};

/**
 * Metadata describing the type and logical structure of an enum.
 */
export interface EnumValueInfo {
  isHomogeneous: boolean;
  isBoolean: boolean;
}

interface CombinedEnumInput {
  value: string;
  isRef: boolean;
  schema: OpenApiSchemaObject | undefined;
  enumMembers?: EnumMember[];
}

interface CombinedEnumValue {
  value: string;
  valueImports: string[];
  hasNull: boolean;
}

/**
 * Map of special characters to semantic word replacements.
 *
 * Applied before naming convention transforms (PascalCase, camelCase, …) so
 * that characters which would otherwise be stripped still contribute a unique
 * segment to the generated key.  Without this, values like "created_at" and
 * "-created_at" both PascalCase to "CreatedAt", silently overwriting one
 * another in the generated const/enum object.
 *
 * Only characters that appear as leading/trailing modifiers in real-world
 * OpenAPI enums are mapped — the list is intentionally conservative to avoid
 * changing output for schemas that don't hit collisions.
 */
const ENUM_SPECIAL_CHARACTER_MAP: Record<string, string> = {
  '-': 'minus',
  '+': 'plus',
};

/**
 * Vendor extension keys used by various OpenAPI tools
 * to define custom names for enum members.
 */
const ENUM_NAME_EXTENSIONS = [
  'x-enumNames',
  'x-enumnames',
  'x-enum-varnames',
] as const;

/**
 * Vendor extension keys used to provide explicit documentation or descriptions
 * for individual enum members in OpenAPI schemas.
 */
const ENUM_DESC_EXTENSIONS = [
  'x-enumDescriptions',
  'x-enumdescriptions',
  'x-enum-descriptions',
] as const;

function getEnumNameMetadata(
  schemaObject: OpenApiSchemaObject | undefined,
): EnumMetadata | undefined {
  if (!schemaObject) return undefined;

  // Find the first matching extension key present in the object
  const key = ENUM_NAME_EXTENSIONS.find((ext) => ext in schemaObject);
  return key ? (schemaObject[key] as EnumMetadata) : undefined;
}

function getEnumDescriptionMetadata(
  schemaObject: OpenApiSchemaObject | undefined,
): EnumMetadata | undefined {
  if (!schemaObject) return undefined;

  const key = ENUM_DESC_EXTENSIONS.find((ext) => ext in schemaObject);
  return key ? (schemaObject[key] as EnumMetadata) : undefined;
}

function applyEnumMetadata(
  members: EnumMember[],
  metadata: EnumMetadata | undefined,
  key: 'name' | 'description',
) {
  if (!metadata) return;

  if (Array.isArray(metadata)) {
    metadata.forEach((value, index) => {
      if (value && members[index]) {
        members[index][key] = jsStringEscape(value);
      }
    });

    return;
  }

  members.forEach((member) => {
    const value = metadata[String(member.value)];

    if (value) {
      member[key] = jsStringEscape(value);
    }
  });
}

export function getEnumMembers(
  schemaObject: OpenApiSchemaObject | undefined,
  metadataObject: OpenApiSchemaObject | undefined = schemaObject,
): EnumMember[] {
  if (!schemaObject) {
    return [];
  }

  const members = dedupeEnumMembersByValue(getRawEnumMembers(schemaObject));

  // Apply metadata from the schema first as the fallback.
  applyEnumMetadata(members, getEnumNameMetadata(schemaObject), 'name');

  applyEnumMetadata(
    members,
    getEnumDescriptionMetadata(schemaObject),
    'description',
  );

  // Metadata from the outer object (e.g. a query parameter) takes precedence.
  if (metadataObject !== schemaObject) {
    applyEnumMetadata(members, getEnumNameMetadata(metadataObject), 'name');

    applyEnumMetadata(
      members,
      getEnumDescriptionMetadata(metadataObject),
      'description',
    );
  }

  return members;
}

/**
 * Generates the implementation of an enum from normalized enum members.
 */
export function getEnumImplementation(
  members: EnumMember[],
  options: {
    enumGenerationType: EnumGeneration;
    enumNamingConvention?: NamingConvention | undefined;
  },
): string {
  if (options.enumGenerationType === EnumGeneration.UNION) {
    return getEnumUnion(members);
  }
  const assignmentOperator =
    options.enumGenerationType === EnumGeneration.CONST ? ':' : '=';
  const membersWithoutNull = getEnumMembersWithoutNull(members);

  const disambiguate =
    !!options.enumNamingConvention &&
    new Set(
      membersWithoutNull.map((member) =>
        deriveEnumKey(member.value, options.enumNamingConvention),
      ),
    ).size < membersWithoutNull.length;

  let result = '';

  for (const member of membersWithoutNull) {
    const value = stringifyEnumValue(member.value);

    const comment = getEnumMemberComment(member);

    const rawKey = member.name
      ? member.name
      : deriveEnumKey(member.value, options.enumNamingConvention, disambiguate);

    // Native enums do not allow quoted string literals as keys in standard TS syntax,
    // but object literals do. Choose key representation safely.
    const formattedKey = keyword.isIdentifierNameES5(rawKey)
      ? rawKey
      : `'${jsStringLiteralEscape(rawKey)}'`;

    result += `${comment}  ${formattedKey}${assignmentOperator} ${value},\n`;
  }

  return result;
}

export function getEnum(
  enumMembers: EnumMember[],
  enumName: string,
  nullable: boolean,
  enumGenerationType: EnumGeneration,
  enumNamingConvention?: NamingConvention,
) {
  if (enumGenerationType === EnumGeneration.CONST) {
    return getTypeConstEnum(
      enumMembers,
      enumName,
      nullable,
      enumNamingConvention,
    );
  }

  if (enumGenerationType === EnumGeneration.ENUM) {
    return getNativeEnum(enumMembers, enumName, enumNamingConvention);
  }

  return getUnion(enumMembers, enumName);
}

/**
 * Checks whether any enum member has a name, description, or deprecation metadata.
 */
export function hasEnumMetadata(members: EnumMember[]): boolean {
  return members.some(
    (member) => member.name !== undefined || member.description !== undefined,
  );
}

export function getEnumValueInfo(members: EnumMember[]): EnumValueInfo {
  const firstValue = members[0]?.value;
  const firstType = typeof firstValue;

  return {
    isHomogeneous: members.every((member) => typeof member.value === firstType),
    isBoolean:
      members.length > 0 &&
      members.every((member) => typeof member.value === 'boolean'),
  };
}

export function getEnumUnion(enumMembers: EnumMember[]) {
  return enumMembers.map(({ value }) => stringifyEnumValue(value)).join(' | ');
}

/**
 * Builds the runtime value for a combined enum.
 *
 * Each input represents an individually resolved enum branch. Inline branches
 * are normalized into enum members so their names, descriptions, and
 * deprecation metadata can be preserved in the generated enum object.
 *
 * Referenced enum branches keep the existing spread and import behavior.
 */
export function getCombinedEnumValue(
  inputs: CombinedEnumInput[],
): CombinedEnumValue {
  const membersByInput = inputs.map((input) => ({
    input,
    members: getEnumMembers(input.schema),
  }));

  const members = membersByInput.flatMap(({ input, members }) =>
    input.isRef ? [] : members,
  );

  const hasNull = membersByInput.some(({ input, members }) => {
    if (input.value === 'null' || input.value.includes('| null')) {
      return true;
    }

    return members.some((member) => member.value === null);
  });

  const hasAnnotatedInlineEnum =
    inputs.every((input) => !input.isRef) && hasEnumMetadata(members);

  if (hasAnnotatedInlineEnum) {
    return {
      value: `{
${getEnumImplementation(members, {
  enumGenerationType: EnumGeneration.CONST,
})}} as const`,
      valueImports: [],
      hasNull,
    };
  }

  const valueImports: string[] = [];

  const addValueImport = (name: string) => {
    if (!valueImports.includes(name)) {
      valueImports.push(name);
    }
  };

  if (inputs.length === 1) {
    const input = inputs[0];

    if (input.isRef) {
      const refName = stripNullUnion(input.value);

      if (isSpreadableEnumRef(input.schema, refName)) {
        addValueImport(refName);

        return {
          value: refName,
          valueImports,
          hasNull,
        };
      }

      return {
        value: `{${buildInlineEnum(input.schema)}} as const`,
        valueImports,
        hasNull,
      };
    }

    return {
      value: `{${buildInlineEnum(input.schema)}} as const`,
      valueImports,
      hasNull,
    };
  }

  const enums = inputs
    .map((input) => {
      if (input.isRef) {
        const refName = stripNullUnion(input.value);

        if (isSpreadableEnumRef(input.schema, refName)) {
          addValueImport(refName);
          return `...${refName},`;
        }

        return buildInlineEnum(input.schema);
      }

      return buildInlineEnum(input.schema);
    })
    .join('');

  return {
    value: `{${enums}} as const`,
    valueImports,
    hasNull,
  };
}

function getEnumMembersFromBranches(
  schemaObject: OpenApiSchemaObject | undefined,
): EnumMember[] {
  if (!schemaObject) {
    return [];
  }

  const branches = [
    ...(schemaObject.oneOf ?? []),
    ...(schemaObject.anyOf ?? []),
  ] as EnumConstBranch[];

  const members: EnumMember[] = [];

  for (const branch of branches) {
    if (hasConst(branch)) {
      members.push({
        value: branch.const,
        name: branch.title ? jsStringEscape(branch.title) : undefined,
        description: branch.description
          ? jsStringEscape(branch.description)
          : undefined,
        deprecated: branch.deprecated === true ? true : undefined,
      });
      continue;
    }

    const enumValues = getSchemaEnumValues(branch.enum);

    members.push(
      ...enumValues.map((value) => ({
        value,
      })),
    );

    if (
      branch.type === 'null' ||
      (Array.isArray(branch.type) && branch.type.includes('null'))
    ) {
      members.push({
        value: null,
      });
    }
  }

  return dedupeEnumMembersByValue(members);
}

function getSchemaEnumValues(value: unknown): SchemaEnumValue[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SchemaEnumValue =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean' ||
          item === null,
      )
    : [];
}

function getRawEnumMembers(schemaObject: OpenApiSchemaObject): EnumMember[] {
  if ('const' in schemaObject) {
    return [
      {
        value: schemaObject.const as SchemaEnumValue,
        name: schemaObject.title
          ? jsStringEscape(schemaObject.title)
          : undefined,
        description: schemaObject.description
          ? jsStringEscape(schemaObject.description)
          : undefined,
        deprecated: schemaObject.deprecated === true ? true : undefined,
      },
    ];
  }

  if (schemaObject.enum) {
    const enumValues = schemaObject.enum as SchemaEnumValue[];

    return enumValues.map((value) => ({
      value,
    }));
  }

  return getEnumMembersFromBranches(schemaObject);
}

function getEnumMembersWithoutNull(members: EnumMember[]): EnumMember[] {
  return members.filter((member) => member.value !== null);
}

const getEnumMemberComment = (member: EnumMember): string => {
  if (member.description && member.deprecated) {
    return `  /**\n   * ${member.description}\n   * @deprecated\n   */\n`;
  }

  if (member.description) {
    return `  /** ${member.description} */\n`;
  }

  if (member.deprecated) {
    return `  /** @deprecated */\n`;
  }

  return '';
};

const getTypeConstEnum = (
  enumMembers: EnumMember[],
  enumName: string,
  nullable: boolean,
  enumNamingConvention?: NamingConvention,
) => {
  let enumValue = `export type ${enumName} = typeof ${enumName}[keyof typeof ${enumName}]`;

  if (nullable) {
    enumValue += ' | null';
  }

  enumValue += ';\n';

  const implementation = getEnumImplementation(enumMembers, {
    enumGenerationType: EnumGeneration.CONST,
    enumNamingConvention: enumNamingConvention,
  });

  enumValue += '\n\n';
  enumValue += `export const ${enumName} = {\n${implementation}} as const;\n`;

  return enumValue;
};

const getNativeEnum = (
  enumMembers: EnumMember[],
  enumName: string,
  enumNamingConvention?: NamingConvention,
) => {
  const membersWithoutNull = getEnumMembersWithoutNull(enumMembers);

  const enumItems = getEnumImplementation(membersWithoutNull, {
    enumNamingConvention: enumNamingConvention,
    enumGenerationType: EnumGeneration.ENUM,
  });

  return `export enum ${enumName} {\n${enumItems}\n}`;
};

function getUnion(enumMembers: EnumMember[], enumName: string) {
  return `export type ${enumName} = ${getEnumUnion(enumMembers)};`;
}

function getEnumUnionFromSchema(schema: OpenApiSchemaObject | undefined) {
  if (!schema?.enum) return '';
  const schemaEnum = schema.enum as SchemaEnumValue[];
  return schemaEnum
    .filter((val): val is Exclude<SchemaEnumValue, null> => val !== null)
    .map((val) =>
      isString(val) ? `'${jsStringLiteralEscape(val)}'` : String(val),
    )
    .join(' | ');
}

const stripNullUnion = (value: string) =>
  value.replaceAll(/\s*\|\s*null/g, '').trim();

const isSpreadableEnumRef = (
  schema: OpenApiSchemaObject | undefined,
  refName: string,
) => {
  if (!schema?.enum || !refName) return false;
  if (!getEnumUnionFromSchema(schema)) return false;
  const type = schema.type as string | string[] | undefined;
  if (type === 'boolean' || (Array.isArray(type) && type.includes('boolean'))) {
    return false;
  }
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(refName);
};

const buildInlineEnum = (schema: OpenApiSchemaObject | undefined) => {
  return getEnumImplementation(getEnumMembers(schema), {
    enumGenerationType: EnumGeneration.CONST,
  });
};

/**
 * Replace special characters with semantic words (plus an underscore separator)
 * so that naming convention transforms (PascalCase, etc.) produce unique keys.
 *
 * The trailing underscore acts as a word boundary so that PascalCase treats the
 * replacement as a separate word: "-created_at" → "minus_created_at" → "MinusCreatedAt".
 */
function replaceSpecialCharacters(key: string): string {
  let result = '';
  for (const char of key) {
    const replacement = ENUM_SPECIAL_CHARACTER_MAP[char];
    result += replacement ? replacement + '_' : char;
  }
  return result;
}

function stringifyEnumValue(value: SchemaEnumValue): string {
  if (value === null) {
    return 'null';
  }

  return isString(value) ? `'${jsStringLiteralEscape(value)}'` : String(value);
}

const toNumberKey = (value: string) => {
  if (value.startsWith('-')) {
    return `NUMBER_MINUS_${value.slice(1)}`;
  }
  if (value.startsWith('+')) {
    return `NUMBER_PLUS_${value.slice(1)}`;
  }
  return `NUMBER_${value}`;
};

/**
 * Derive the object/enum key for a single enum value.
 *
 * Handles numeric prefixes, sanitization, and optional naming convention
 * transforms.  When `disambiguate` is true, special characters (-/+) are
 * replaced with semantic words before the convention transform to prevent
 * key collisions.
 */
function deriveEnumKey(
  val: string | number | boolean | null,
  enumNamingConvention?: NamingConvention,
  disambiguate = false,
): string {
  let key = String(val);

  if (isNumeric(key)) {
    key = toNumberKey(key);
  }

  if (key.length > 1) {
    key = sanitize(key, {
      whitespace: '_',
      underscore: true,
      dash: true,
      special: true,
    });
  }

  if (enumNamingConvention) {
    if (disambiguate) {
      key = replaceSpecialCharacters(key);
    }

    key = conventionName(key, enumNamingConvention);
  }

  return key;
}

function hasConst(
  branch: EnumConstBranch,
): branch is EnumConstBranch & { const: SchemaEnumValue } {
  return 'const' in branch;
}

function dedupeEnumMembersByValue(members: EnumMember[]): EnumMember[] {
  return members.filter(
    (member, index, array) =>
      array.findIndex((item) => item.value === member.value) === index,
  );
}
