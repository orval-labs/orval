import type { NormalizedOutputOptions, OpenApiDocument } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { generateValibotSchemasInline } from './schemas-inline';

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'test', version: '1' },
  paths: {},
  components: {
    schemas: {
      Pet: {
        type: 'object',
        properties: { owner: { $ref: '#/components/schemas/Owner' } },
      },
      Owner: { type: 'object', properties: { name: { type: 'string' } } },
    },
  },
};

const outputWith = (suffix: string): NormalizedOutputOptions =>
  createTestContextSpec({
    spec,
    output: {
      override: {
        components: { schemas: { suffix } },
        valibot: { generateReusableSchemas: true },
      },
    },
  }).output;

const inlineWith = (suffix: string): string =>
  generateValibotSchemasInline({ spec, target: '' }, outputWith(suffix), false);

describe('generateValibotSchemasInline', () => {
  it('follows the naming options when one spec is reused', () => {
    for (const suffix of ['A', 'B', 'A']) {
      const code = inlineWith(suffix);
      expect(code).toContain(`export const Pet${suffix} =`);
      expect(code).toContain(`export const Owner${suffix} =`);
      expect(code).toContain(`owner: v.optional(Owner${suffix})`);
    }
  });

  it('imports the decode functions the constants reference', () => {
    const output = createTestContextSpec({
      output: {
        override: {
          formatType: {
            'date-time': {
              type: 'Day',
              decode: 'toDay',
              decodeImport: { name: 'toDay', importPath: './day' },
            },
            uuid: {
              type: 'Id',
              decode: 'toId',
              decodeImport: { name: 'toId', importPath: './id' },
            },
          },
          valibot: { generateReusableSchemas: true },
        },
      },
    }).output;
    const mapped: OpenApiDocument = {
      ...spec,
      components: { schemas: { At: { type: 'string', format: 'date-time' } } },
    };
    const inline = (precedingContent?: string) =>
      generateValibotSchemasInline(
        { spec: mapped, target: '' },
        output,
        true,
        precedingContent,
      );
    const toDayImport = "import { toDay } from './day';";

    expect(inline()).toContain(
      `import * as v from 'valibot';\n${toDayImport}\n\nexport const At =`,
    );
    expect(inline()).not.toContain('toId');
    expect(inline(`${toDayImport}\n`)).not.toContain(toDayImport);
  });
});
