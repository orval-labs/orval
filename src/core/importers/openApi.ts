import omit from 'lodash.omit';
import { OpenAPIObject, SchemasObject } from 'openapi3-ts';
import { ContextSpecs, ImportOpenApi, InputOptions } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { WriteSpecsProps } from '../../types/writers';
import { asyncReduce } from '../../utils/async-reduce';
import { swaggerConverter } from '../../utils/converter';
import { dynamicImport } from '../../utils/imports';
import { isObject, isReference } from '../../utils/is';
import { generateApi } from '../generators/api';
import { generateComponentDefinition } from '../generators/componentDefinition';
import { generateParameterDefinition } from '../generators/parameterDefinition';
import { generateSchemasDefinition } from '../generators/schemaDefinition';
import { ibmOpenapiValidator } from '../validators/ibm-openapi-validator';

const generateInputSpecs = async ({
  specs,
  input,
  workspace,
}: {
  specs: Record<string, OpenAPIObject>;
  input: InputOptions;
  workspace: string;
}): Promise<Record<string, OpenAPIObject>> => {
  const transformerFn = input.override?.transformer
    ? await dynamicImport(input.override.transformer, workspace)
    : undefined;

  return asyncReduce(
    Object.entries(specs),
    async (acc, [specKey, value]) => {
      const schema = await swaggerConverter(
        value,
        input.converterOptions,
        specKey,
      );

      const transfomedSchema = transformerFn ? transformerFn(schema) : schema;

      if (input.validation) {
        await ibmOpenapiValidator(transfomedSchema);
      }

      acc[specKey] = transfomedSchema;

      return acc;
    },
    {} as Record<string, OpenAPIObject>,
  );
};

export const importOpenApi = async ({
  data,
  input,
  output,
  target,
  workspace,
}: ImportOpenApi): Promise<WriteSpecsProps> => {
  const specs = await generateInputSpecs({ specs: data, input, workspace });

  const schemas = Object.entries(specs).reduce((acc, [specKey, spec]) => {
    const context: ContextSpecs = {
      specKey,
      target,
      workspace,
      specs,
      override: output.override,
      tslint: output.tslint,
      tsconfig: output.tsconfig,
      packageJson: output.packageJson,
    };

    const schemaDefinition = generateSchemasDefinition(
      !spec.openapi
        ? getAllSchemas(spec)
        : (spec.components?.schemas as SchemasObject),
      context,
      output.override.components.schemas.suffix,
    );

    const responseDefinition = generateComponentDefinition(
      spec.components?.responses,
      context,
      output.override.components.responses.suffix,
    );

    const bodyDefinition = generateComponentDefinition(
      spec.components?.requestBodies,
      context,
      output.override.components.requestBodies.suffix,
    );

    const parameters = generateParameterDefinition(
      spec.components?.parameters,
      context,
      output.override.components.parameters.suffix,
    );

    const schemas = [
      ...schemaDefinition,
      ...responseDefinition,
      ...bodyDefinition,
      ...parameters,
    ];

    if (!schemas.length) {
      return acc;
    }

    acc[specKey] = schemas;

    return acc;
  }, {} as Record<string, GeneratorSchema[]>);

  const api = await generateApi({
    output,
    context: {
      specKey: target,
      target,
      workspace,
      specs,
      override: output.override,
      tslint: output.tslint,
      tsconfig: output.tsconfig,
      packageJson: output.packageJson,
    },
  });

  return {
    ...api,
    schemas: {
      ...schemas,
      [target]: [...(schemas[target] ?? []), ...api.schemas],
    },
    target,
    info: specs[target].info,
  };
};

const getAllSchemas = (spec: object): SchemasObject => {
  const cleanedSpec = omit(spec, [
    'openapi',
    'info',
    'servers',
    'paths',
    'components',
    'security',
    'tags',
    'externalDocs',
  ]);

  const schemas = Object.entries(cleanedSpec).reduce<SchemasObject>(
    (acc, [key, value]) => {
      if (!isObject(value)) {
        return acc;
      }

      if (!value.type && !isReference(value)) {
        return { ...acc, ...getAllSchemas(value) };
      }

      acc[key] = value;

      return acc;
    },
    {},
  );

  return {
    ...schemas,
    ...((spec as OpenAPIObject)?.components?.schemas as SchemasObject),
  };
};
