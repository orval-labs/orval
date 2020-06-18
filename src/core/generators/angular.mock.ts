import { OpenAPIObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { GeneratorVerbOptions } from '../../types/generator';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

const toDelayMock = (value: unknown, definition: string) =>
  `delay<${definition}>(1000)(of(${value}))`;

export const generateAngularMock = (
  { operationId, response, definitionName, props }: GeneratorVerbOptions,
  specs: OpenAPIObject,
  override?: OverrideOutput,
) => {
  const { definition, definitions, imports } = getMockDefinition(
    operationId,
    response,
    specs,
    override,
    toDelayMock,
  );

  const mockData = getMockOptionsDataOverride(operationId, override);

  const implementation = `  ${definitionName}(${
    props.definition
  }): Observable<${response.definition}> {
    return ${
      mockData
        ? toDelayMock(mockData, response.definition)
        : definitions.length > 1
        ? `faker.helpers.randomize(${definition})`
        : definitions[0]
    }
  }
`;

  return { implementation, imports };
};
