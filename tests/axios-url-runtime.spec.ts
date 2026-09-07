import { runInNewContext } from 'node:vm';

import { generateAxiosUrl } from '@orval/core';
import axios from 'axios';
import { describe, expect, it } from 'vite-plus/test';
import { computed, ref } from 'vue';

import { getListPetsUrl as getListPetsUrlFromFunctions } from './generated/axios/named-parameters/endpoints';
import { getSwaggerPetstore } from './generated/axios/petstore/endpoints';
import { getHealthCheckUrl as getHealthCheckUrlFromReactQuery } from './generated/react-query/tag-hook-mutator-axios/endpoints';
import { getListPetsUrl as getListPetsUrlFromVueQuery } from './generated/vue-query/petstore/endpoints';

const evaluateGeneratedUrl = (
  source: string,
  axiosClient: ReturnType<typeof axios.create>,
  functionName: string,
  globals: Record<string, unknown> = {},
) =>
  runInNewContext(`${source.replace('export ', '')}; ${functionName}`, {
    axios: axiosClient,
    ...globals,
  }) as (...args: unknown[]) => string;

describe('generated Axios URL helpers', () => {
  it('uses factory instance serialization while excluding the instance baseURL', () => {
    const axiosInstance = axios.create({
      baseURL: 'https://api.example.test',
      paramsSerializer: { indexes: null },
    });
    const api = getSwaggerPetstore(axiosInstance);
    const params = {
      tags: ['red', 'blue'],
      sort: 'name' as const,
      optional: undefined,
      empty: null,
    };

    const expected = axiosInstance.getUri({
      url: '/v2/pets',
      baseURL: '',
      params,
    });

    expect(api.getListPetsUrl(params, 2)).toBe(expected);
    expect(api.getListPetsUrl(params, 2)).toBe(
      '/v2/pets?tags=red&tags=blue&sort=name',
    );
    expect(api.getListPetsUrl(params, 2)).not.toContain('api.example.test');
  });

  it('uses the configured Axios serializer in factory mode', () => {
    const axiosInstance = axios.create({
      baseURL: 'https://api.example.test',
      paramsSerializer: {
        serialize: (params) =>
          `filter=${encodeURIComponent(String(params.filter))}`,
      },
    });
    const api = getSwaggerPetstore(axiosInstance);
    const params = { filter: 'red/blue', sort: 'name' as const };
    const expected = axiosInstance.getUri({
      url: '/v3/pets',
      baseURL: '',
      params,
    });

    expect(api.getListPetsUrl(params, 3)).toBe(expected);
    expect(api.getListPetsUrl(params, 3)).toBe('/v3/pets?filter=red%2Fblue');
  });

  it('uses serializers declared by the generated Axios configuration', () => {
    const customSerializer = (params: Record<string, unknown>) =>
      `filter=${encodeURIComponent(String(params.filter))}`;
    const source = generateAxiosUrl({
      functionName: 'getGetPetUrl',
      propsImplementation: 'params',
      route: '/pets',
      axiosRef: 'axios',
      hasQueryParams: true,
      paramsSerializer: 'customSerializer',
    });
    const getUrl = evaluateGeneratedUrl(
      source,
      axios.create(),
      'getGetPetUrl',
      { customSerializer },
    );

    expect(getUrl({ filter: 'red/blue' })).toBe('/pets?filter=red%2Fblue');
  });

  it('passes paramsSerializerOptions.qs through Axios getUri', () => {
    const qs = {
      stringify: (params: Record<string, unknown>, options: unknown) => {
        expect(options).toEqual({ arrayFormat: 'repeat' });
        return (params.tags as string[])
          .map((tag) => `tag=${encodeURIComponent(tag)}`)
          .join('&');
      },
    };
    const source = generateAxiosUrl({
      functionName: 'getGetPetUrl',
      propsImplementation: 'params',
      route: '/pets',
      axiosRef: 'axios',
      hasQueryParams: true,
      paramsSerializerOptions: { qs: { arrayFormat: 'repeat' } },
    });
    const getUrl = evaluateGeneratedUrl(
      source,
      axios.create(),
      'getGetPetUrl',
      { qs },
    );

    expect(getUrl({ tags: ['a', 'b'] })).toBe('/pets?tag=a&tag=b');
  });

  it('preserves root and trailing-slash OpenAPI routes', () => {
    const rootUrl = evaluateGeneratedUrl(
      generateAxiosUrl({
        functionName: 'getRootUrl',
        propsImplementation: 'params = {}',
        route: '/',
        axiosRef: 'axios',
        hasQueryParams: true,
      }),
      axios.create(),
      'getRootUrl',
    );
    const trailingSlashUrl = evaluateGeneratedUrl(
      generateAxiosUrl({
        functionName: 'getUsersUrl',
        propsImplementation: 'params = {}',
        route: '/users/',
        axiosRef: 'axios',
        hasQueryParams: true,
      }),
      axios.create(),
      'getUsersUrl',
    );

    expect(rootUrl({ foo: 'bar' })).toBe('/?foo=bar');
    expect(rootUrl()).toBe('/');
    expect(trailingSlashUrl({ foo: 'bar' })).toBe('/users/?foo=bar');
  });
  it('does not leak instance default params into the OpenAPI URL', () => {
    const axiosInstance = axios.create({
      baseURL: 'https://api.example.test',
      params: { tenant: 'runtime-default', page: 99 },
    });
    const api = getSwaggerPetstore(axiosInstance);

    expect(api.getListPetsUrl({ sort: 'name' }, 2)).toBe('/v2/pets?sort=name');
  });

  it('matches Axios exactly for null, undefined, and empty query values', () => {
    const axiosInstance = axios.create();
    const api = getSwaggerPetstore(axiosInstance);
    const cases = [
      { foo: null },
      { foo: undefined },
      { foo: '' },
      { foo: null, bar: 'x' },
    ];
    const expected = ['/users', '/users', '/users?foo=', '/users?bar=x'];

    expect(
      cases.map((params) => axiosInstance.getUri({ url: '/users', params })),
    ).toEqual(expected);
    expect(
      cases.map((params) => api.getListPetsUrl(params as never, 1)),
    ).toEqual(['/v1/pets', '/v1/pets', '/v1/pets?foo=', '/v1/pets?bar=x']);
  });

  it('uses global Axios serialization in axios-functions mode', () => {
    const params = { tags: ['red', 'blue'], sort: 'name' as const };

    expect(getListPetsUrlFromFunctions({ version: 3 }, params)).toBe(
      axios.getUri({
        url: '/v3/pets',
        baseURL: '',
        params,
      }),
    );
  });

  it('excludes global Axios runtime defaults in functions mode', () => {
    const previousBaseURL = axios.defaults.baseURL;
    const previousParams = axios.defaults.params;
    axios.defaults.baseURL = 'https://api.example.test';
    axios.defaults.params = { tenant: 'runtime-default' };

    try {
      expect(
        getListPetsUrlFromFunctions({ version: 3 }, { sort: 'name' }),
      ).toBe('/v3/pets?sort=name');
    } finally {
      axios.defaults.baseURL = previousBaseURL;
      axios.defaults.params = previousParams;
    }
  });

  it('matches Axios for scalar edge cases, arrays, and repeated calls', () => {
    const axiosInstance = axios.create();
    const api = getSwaggerPetstore(axiosInstance);
    const params = {
      sort: 'name' as const,
      limit: '20',
      search: 'hello world',
      foo: undefined,
      nullable: null,
      enabled: true,
      disabled: false,
      zero: 0,
      negative: -1,
      decimal: 1.5,
      empty: '',
      special: 'foo&bar=a? #+/%',
      unicode: '你好 漢字 José ñ 日本語',
      tags: ['a&b', '你好'],
      emptyTags: [],
    };
    const before = structuredClone(params);
    const expected = axiosInstance.getUri({
      url: '/v2/pets',
      baseURL: '',
      params,
    });

    expect(api.getListPetsUrl(params, 2)).toBe(expected);
    expect(api.getListPetsUrl(params, 2)).toContain('search=hello+world');
    expect(api.getListPetsUrl(params, 2)).toContain('enabled=true');
    expect(api.getListPetsUrl(params, 2)).toContain('disabled=false');
    expect(api.getListPetsUrl(params, 2)).toContain('zero=0');
    expect(api.getListPetsUrl(params, 2)).toContain('negative=-1');
    expect(api.getListPetsUrl(params, 2)).toContain('decimal=1.5');
    expect(api.getListPetsUrl(params, 2)).toContain('empty=');
    expect(api.getListPetsUrl(params, 2)).not.toContain('foo=undefined');
    expect(api.getListPetsUrl(params, 2)).not.toContain('nullable');
    expect(params).toEqual(before);

    expect(api.getListPetsUrl({ sort: 'name' }, 2)).toBe('/v2/pets?sort=name');
    expect(api.getListPetsUrl({ sort: 'email' }, 2)).toBe(
      '/v2/pets?sort=email',
    );
    expect(api.getListPetsUrl({ sort: 'name' }, 2)).not.toContain('email');
  });

  it('preserves existing generated path interpolation without double encoding', () => {
    const axiosInstance = axios.create({
      baseURL: 'https://api.example.test/v1',
    });
    const api = getSwaggerPetstore(axiosInstance);

    for (const petId of [
      'hello world',
      'a/b',
      'foo?bar',
      '100%',
      '你好',
      'hello%20world',
      'a%2Fb',
    ]) {
      expect(api.getShowPetByIdUrl(petId, 2)).toBe(
        axiosInstance.getUri({
          url: `/v2/pets/${petId}`,
          baseURL: '',
        }),
      );
    }

    expect(api.getHealthCheckUrl(2)).toBe('/v2/health');
  });

  it('preserves custom serializer output, including empty output and errors', () => {
    const params = { sort: 'name' as const };
    const customInstance = axios.create({
      paramsSerializer: { serialize: () => 'foo=a;b=c' },
    });
    const emptyInstance = axios.create({
      paramsSerializer: { serialize: () => '' },
    });
    const throwingInstance = axios.create({
      paramsSerializer: {
        serialize: () => {
          throw new Error('serializer failed');
        },
      },
    });

    expect(getSwaggerPetstore(customInstance).getListPetsUrl(params)).toBe(
      '/v1/pets?foo=a;b=c',
    );
    expect(getSwaggerPetstore(emptyInstance).getListPetsUrl(params)).toBe(
      '/v1/pets',
    );
    expect(() =>
      getSwaggerPetstore(throwingInstance).getListPetsUrl(params),
    ).toThrow('serializer failed');
  });

  it('uses the same generated helper behavior for a path plus query', () => {
    const source = generateAxiosUrl({
      functionName: 'getUserMessagesUrl',
      propsImplementation: 'userId, params',
      route: '/users/${userId}/messages',
      axiosRef: 'axios',
      hasQueryParams: true,
    });
    const axiosInstance = axios.create();
    const getUserMessagesUrl = evaluateGeneratedUrl(
      source,
      axiosInstance,
      'getUserMessagesUrl',
    );
    const params = { search: 'hello world', tags: ['a', 'b'] };

    expect(getUserMessagesUrl('john/doe', params)).toBe(
      axiosInstance.getUri({
        url: '/users/john/doe/messages',
        baseURL: '',
        params,
      }),
    );
    expect(getUserMessagesUrl('john/doe', params)).toBe(
      '/users/john/doe/messages?search=hello+world&tags%5B%5D=a&tags%5B%5D=b',
    );
  });

  it('unwraps Vue MaybeRefOrGetter values before Axios serialization', () => {
    const params = ref({ sort: 'name' as const, limit: '10' });
    const version = computed(() => 3);

    expect(getListPetsUrlFromVueQuery(params, version)).toBe(
      axios.getUri({
        url: '/v3/pets',
        baseURL: '',
        params: params.value,
      }),
    );
  });

  it('exports helpers for Axios-backed React Query output', () => {
    expect(getHealthCheckUrlFromReactQuery()).toBe(
      axios.getUri({
        url: '/health',
        baseURL: '',
      }),
    );
  });
});
