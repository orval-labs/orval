import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { sanitize } from '../../utils/string';
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

export const generateMSW = (
  { operationId, response, verb }: GeneratorVerbOptions,
  { specs, pathRoute, override }: GeneratorOptions,
) => {
  const { definitions, definition } = getMockDefinition(
    operationId,
    response,
    specs,
    override,
  );

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
    value[0] === '{' || value[0] === '[' || value.startsWith('(() => ({')
      ? 'json'
      : 'text';

  return `rest.${verb}('${route}', (req, res, ctx) => {
    return res(
      ctx.delay(1000),
      ctx.status(200, 'Mocked status'),${
        value !== 'undefined' ? `\nctx.${responseType}(${value}),` : ''
      }
    )
  }),`;
};
