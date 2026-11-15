import type { allLocales } from '@faker-js/faker';
import type { McpServerOptions as McpSdkServerOptions } from '@modelcontextprotocol/server';
import type { escapePath as escapeGlobPath } from 'tinyglobby';
import { describe, expectTypeOf, it } from 'vite-plus/test';

import type {
  CommonMockOptions,
  McpOptions,
  NormalizedMcpOptions,
} from './types';
import type { escapePath } from './utils/file';

describe('optional generator configuration types', () => {
  it('preserves the glob escaping helper signature', () => {
    expectTypeOf<typeof escapePath>().toEqualTypeOf<typeof escapeGlobPath>();
  });

  it('preserves the supported Faker locale union', () => {
    // Faker 10.5/10.6 added these locales after the development version. Keep
    // configurations using those supported releases valid without widening
    // the locale option to arbitrary strings.
    expectTypeOf<CommonMockOptions['locale']>().toEqualTypeOf<
      keyof typeof allLocales | 'mn_MN_cyrl' | 'en_NP' | undefined
    >();
  });

  it('preserves the MCP SDK cache hint configuration', () => {
    expectTypeOf<McpOptions['cacheHints']>().toEqualTypeOf<
      McpSdkServerOptions['cacheHints']
    >();
    expectTypeOf<NormalizedMcpOptions['cacheHints']>().toEqualTypeOf<
      McpSdkServerOptions['cacheHints']
    >();
  });
});
