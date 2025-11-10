import { resolveValue } from '../resolvers/index.ts';
import type {
  ContextSpec,
  GeneratorImport,
  GeneratorSchema,
  GetterParameters,
  GetterQueryParam,
  OpenApiParameterObject,
  OpenApiSchemaObject,
} from '../types.ts';
import { jsDoc, pascal, sanitize } from '../utils/index.ts';
import { getEnum, getEnumDescriptions, getEnumNames } from './enum.ts';
import { getKey } from './keys.ts';

type QueryParamsType = {
  name: string;
  required: boolean;
  definition: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: OpenApiSchemaObject;
};

const isOpenApiSchemaObject = (
  value: unknown,
): value is OpenApiSchemaObject => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return !('$ref' in value);
};

const isSchemaNullable = (schema: OpenApiSchemaObject): boolean => {
  if (schema.nullable === true) {
    return true;
  }

  if (schema.type === 'null') {
    return true;
  }

  if (Array.isArray(schema.type) && schema.type.includes('null')) {
    return true;
  }

  const oneOfVariants = Array.isArray(schema.oneOf)
    ? (schema.oneOf as unknown[])
    : [];
  const anyOfVariants = Array.isArray(schema.anyOf)
    ? (schema.anyOf as unknown[])
    : [];
  const variants = [...oneOfVariants, ...anyOfVariants];

  return variants.some((variant) => {
    if (!isOpenApiSchemaObject(variant)) {
      return false;
    }

    return isSchemaNullable(variant);
  });
};

function getQueryParamsTypes(
  queryParams: GetterParameters['query'],
  operationName: string,
  context: ContextSpec,
): QueryParamsType[] {
  return queryParams.map(({ parameter, imports: parameterImports }) => {
    const {
      name,
      required,
      schema: schemaParam,
      content,
    } = parameter as {
      name: string;
      required: boolean;
      schema: OpenApiSchemaObject | undefined;
      content: OpenApiParameterObject['content'];
    };

    const queryName = sanitize(`${pascal(operationName)}${pascal(name)}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });

    const schema = schemaParam ?? content?.['application/json']?.schema;
    if (!schema) {
      throw new Error(
        `Query parameter "${name}" has no schema or content definition`,
      );
    }

    const resolvedValue = resolveValue({
      schema,
      context,
      name: queryName,
    });

    const key = getKey(name);
    // Bridge assertion: cast schema to jsDoc's expected parameter shape
    // to avoid AnyOtherAttribute spreading error type
    const schemaForDoc = schema as {
      description?: string | string[];
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
    };
    const doc = jsDoc(
      {
        description: parameter.description,
        ...schemaForDoc,
      },
      void 0,
      context,
    );

    if (parameterImports.length > 0) {
      return {
        name,
        required,
        definition: `${doc}${key}${!required || schema.default ? '?' : ''}: ${
          parameterImports[0].name
        };`,
        imports: parameterImports,
        schemas: [],
        originalSchema: resolvedValue.originalSchema,
      };
    }

    if (resolvedValue.isEnum && !resolvedValue.isRef) {
      const enumName = queryName;
      const enumValue = getEnum(
        resolvedValue.value,
        enumName,
        getEnumNames(resolvedValue.originalSchema),
        context.output.override.enumGenerationType,
        getEnumDescriptions(resolvedValue.originalSchema),
        context.output.override.namingConvention.enum,
      );

      return {
        name,
        required,
        definition: `${doc}${key}${
          !required || schema.default ? '?' : ''
        }: ${enumName};`,
        imports: [{ name: enumName }],
        schemas: [
          ...resolvedValue.schemas,
          { name: enumName, model: enumValue, imports: resolvedValue.imports },
        ],
        originalSchema: resolvedValue.originalSchema,
      };
    }

    const definition = `${doc}${key}${
      !required || schema.default ? '?' : ''
    }: ${resolvedValue.value};`;

    return {
      name,
      required,
      definition,
      imports: resolvedValue.imports,
      schemas: resolvedValue.schemas,
      originalSchema: resolvedValue.originalSchema,
    };
  });
}

interface GetQueryParamsOptions {
  queryParams: GetterParameters['query'];
  operationName: string;
  context: ContextSpec;
  suffix?: string;
}

export function getQueryParams({
  queryParams,
  operationName,
  context,
  suffix = 'params',
}: GetQueryParamsOptions): GetterQueryParam | undefined {
  if (queryParams.length === 0) {
    return;
  }
  const types = getQueryParamsTypes(queryParams, operationName, context);
  const imports = types.flatMap(({ imports }) => imports);
  const schemas = types.flatMap(({ schemas }) => schemas);
  const name = `${pascal(operationName)}${pascal(suffix)}`;

  const type = types.map(({ definition }) => definition).join('\n');
  const allOptional = queryParams.every(({ parameter }) => !parameter.required);
  const requiredNullableKeys = types
    .filter(
      ({ required, originalSchema }) =>
        required && isSchemaNullable(originalSchema),
    )
    .map(({ name }) => name);

  const schema = {
    name,
    model: `export type ${name} = {\n${type}\n};\n`,
    imports,
  };

  return {
    schema,
    deps: schemas,
    isOptional: allOptional,
    requiredNullableKeys,
  };
}
