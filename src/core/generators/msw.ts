import {
  GeneratorImport,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { sanitize } from '../../utils/string';
import { generateDependencyImports } from './imports';
import { getMockDefinition, getMockOptionsDataOverride } from './mocks';

const getRoutePath = (path: string) => {
  return path.split('').reduce((acc, letter) => {
    if (letter === '{') {
      return acc + ':';
    }

    if (letter === '}') {
      return acc + '';
    }

    return acc + sanitize(letter);
  }, '');
};

export const getRoute = (route: string) => {
  const splittedRoute = route.split('/');

  return splittedRoute.reduce((acc, path) => {
    if (!path) {
      return acc;
    }

    if (!path.includes('{')) {
      return `${acc}/${path}`;
    }

    return `${acc}/${getRoutePath(path)}`;
  }, '*');
};

const MSW_DEPENDENCIES = [
  {
    exports: [{ name: 'rest' }],
    dependency: 'msw',
  },
  {
    exports: [{ name: 'faker', default: true }],
    dependency: 'faker',
  },
];

export const generateMSWImports = (
  implementation: string,
  imports: {
    exports: GeneratorImport[];
    dependency: string;
  }[],
  specsName: Record<string, string>,
): string => {
  return generateDependencyImports(
    implementation,
    [...MSW_DEPENDENCIES, ...imports],
    specsName,
  );
};

export const generateMSW = async (
  { operationId, response, verb, tags }: GeneratorVerbOptions,
  { pathRoute, override, context }: GeneratorOptions,
) => {
  const { definitions, definition, imports } = await getMockDefinition({
    operationId,
    tags,
    response,
    override,
    context,
  });

  const route = getRoute(pathRoute);
  const mockData = getMockOptionsDataOverride(operationId, override);

  let value = '';

  if (mockData) {
    value = mockData;
  } else if (definitions.length > 1) {
    value = `faker.helpers.randomize(${definition})`;
  } else if (definitions[0]) {
    value = definitions[0];
  }

  const responseType =
    value[0] === '{' ||
    value[0] === '[' ||
    value.startsWith('(() => ({') ||
    value.startsWith('faker.')
      ? 'json'
      : 'text';

  return {
    implementation: {
      function:
        value && value !== 'undefined'
          ? `export const get${pascal(operationId)}Mock = () => (${value})\n\n`
          : '',
      handler: `rest.${verb}('${route}', (req, res, ctx) => {
        return res(
          ctx.delay(1000),
          ctx.status(200, 'Mocked status'),${
            value && value !== 'undefined'
              ? `\nctx.${responseType}(get${pascal(operationId)}Mock()),`
              : ''
          }
        )
      }),`,
    },
    imports,
  };
};
