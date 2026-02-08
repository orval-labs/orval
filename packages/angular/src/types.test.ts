import { describe, expect, it } from 'vitest';

import {
  HTTP_CLIENT_OPTIONS_TEMPLATE,
  THIRD_PARAMETER_TEMPLATE,
} from './types';

/**
 * Extracts property names from a TypeScript interface string template.
 * Matches lines like `  propertyName?: ...` or `  propertyName: ...`
 * Handles multi-line type definitions (e.g., params spanning multiple lines).
 */
const extractPropertyNames = (template: string): string[] => {
  const lines = template.split('\n');
  const props: string[] = [];

  for (const line of lines) {
    const match = /^\s+(\w+)\??\s*:/.exec(line);
    if (match) {
      props.push(match[1]);
    }
  }

  return props;
};

describe('Angular API conformance', () => {
  describe('HTTP_CLIENT_OPTIONS_TEMPLATE', () => {
    /**
     * Canonical list of HttpClient method options from Angular's public API.
     *
     * Source: angular/angular golden API file
     * (goldens/public-api/common/http/index.api.md)
     * and packages/common/http/src/client.ts
     *
     * These are the properties that appear on Angular HttpClient method
     * option objects (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS).
     *
     * Note: `observe` and `responseType` are overload discriminators in
     * Angular's API — they are handled by orval's code generation logic
     * (e.g., observe overloads) rather than being part of a unified
     * options interface. They are intentionally excluded.
     */
    const ANGULAR_HTTP_CLIENT_OPTIONS = [
      'headers',
      'context',
      'params',
      'reportProgress',
      'withCredentials',
      'credentials',
      'keepalive',
      'priority',
      'cache',
      'mode',
      'redirect',
      'referrer',
      'integrity',
      'referrerPolicy',
      'transferCache',
      'timeout',
    ] as const;

    const templateProperties = extractPropertyNames(
      HTTP_CLIENT_OPTIONS_TEMPLATE,
    );

    it('contains all Angular HttpClient options', () => {
      for (const prop of ANGULAR_HTTP_CLIENT_OPTIONS) {
        expect(
          templateProperties,
          `Missing Angular HttpClient option: "${prop}". ` +
            `Angular added this property — update HTTP_CLIENT_OPTIONS_TEMPLATE in types.ts.`,
        ).toContain(prop);
      }
    });

    it('does not contain properties absent from Angular HttpClient', () => {
      for (const prop of templateProperties) {
        expect(
          ANGULAR_HTTP_CLIENT_OPTIONS as readonly string[],
          `Unknown property "${prop}" in HTTP_CLIENT_OPTIONS_TEMPLATE. ` +
            `This property is not in Angular HttpClient's public API — ` +
            `either Angular removed it or it was added incorrectly.`,
        ).toContain(prop);
      }
    });

    it('declares the interface as HttpClientOptions', () => {
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'interface HttpClientOptions',
      );
    });

    it('uses correct TypeScript types for each property', () => {
      // Verify a representative set of property types match Angular's API
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'headers?: HttpHeaders | Record<string, string | string[]>',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('context?: HttpContext');
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'params?:\n        | HttpParams\n        | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'reportProgress?: boolean',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'withCredentials?: boolean',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'credentials?: RequestCredentials',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('keepalive?: boolean');
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'priority?: RequestPriority',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('cache?: RequestCache');
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('mode?: RequestMode');
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'redirect?: RequestRedirect',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('referrer?: string');
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('integrity?: string');
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'referrerPolicy?: ReferrerPolicy',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain(
        'transferCache?: {includeHeaders?: string[]} | boolean',
      );
      expect(HTTP_CLIENT_OPTIONS_TEMPLATE).toContain('timeout?: number');
    });

    it('marks all options as optional (?:)', () => {
      for (const prop of templateProperties) {
        const optionalPattern = new RegExp(String.raw`${prop}\?:`);
        expect(
          HTTP_CLIENT_OPTIONS_TEMPLATE,
          `Property "${prop}" should be optional (use ?: syntax)`,
        ).toMatch(optionalPattern);
      }
    });

    /**
     * Cross-reference with Angular's HttpResourceRequest interface.
     *
     * HttpResourceRequest (used by httpResource) shares the same
     * fetch-style network options as HttpClient methods. This test
     * ensures our template stays aligned with both APIs.
     */
    const ANGULAR_HTTP_RESOURCE_REQUEST_OPTIONS = [
      'cache',
      'context',
      'credentials',
      'headers',
      'integrity',
      'keepalive',
      'mode',
      'params',
      'priority',
      'redirect',
      'referrer',
      'referrerPolicy',
      'reportProgress',
      'timeout',
      'transferCache',
      'withCredentials',
    ] as const;

    it('covers all HttpResourceRequest network options', () => {
      for (const prop of ANGULAR_HTTP_RESOURCE_REQUEST_OPTIONS) {
        expect(
          templateProperties,
          `Missing HttpResourceRequest option: "${prop}". ` +
            `Our HttpClientOptions template should be a superset of HttpResourceRequest network options.`,
        ).toContain(prop);
      }
    });
  });

  describe('THIRD_PARAMETER_TEMPLATE', () => {
    it('defines a ThirdParameter utility type', () => {
      expect(THIRD_PARAMETER_TEMPLATE).toContain('type ThirdParameter<T');
    });

    it('extracts the third parameter from a function type', () => {
      expect(THIRD_PARAMETER_TEMPLATE).toContain('args: infer P');
      expect(THIRD_PARAMETER_TEMPLATE).toContain('config: any');
      expect(THIRD_PARAMETER_TEMPLATE).toContain('httpClient: any');
    });

    it('returns never when function has fewer than 3 params', () => {
      expect(THIRD_PARAMETER_TEMPLATE).toContain(': never');
    });
  });
});
