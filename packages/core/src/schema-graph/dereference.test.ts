import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import { dereferenceWithPolicy, type SchemaWalkReporter } from './dereference';
import { createWarnOnceReporter } from './reporter';

const createReporter = (): SchemaWalkReporter => ({
  library: 'effect',
  warn: vi.fn(),
  verbose: vi.fn(),
});

const context = createTestContextSpec({
  spec: {
    openapi: '3.1.0',
    info: { title: 'test', version: '1' },
    paths: {},
    components: {
      schemas: {
        Node: {
          type: 'object',
          properties: { next: { $ref: '#/components/schemas/Node' } },
        },
        Pet: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
  },
});

describe('dereferenceWithPolicy', () => {
  it('reports a circular ref through the reporter', () => {
    const reporter = createReporter();
    dereferenceWithPolicy(
      { $ref: '#/components/schemas/Node' },
      context,
      undefined,
      { suggestReusable: false, reporter },
    );
    expect(reporter.warn).toHaveBeenCalledWith(
      'Circular $ref "#/components/schemas/Node" is validated as unknown.',
      'a schema > #/components/schemas/Node > #/components/schemas/Node',
      undefined,
    );
  });

  it('reports an unresolvable ref with the schema label', () => {
    const reporter = createReporter();
    dereferenceWithPolicy(
      { $ref: '#/components/schemas/Missing' },
      context,
      undefined,
      { label: 'getPet response', suggestReusable: false, reporter },
    );
    expect(reporter.warn).toHaveBeenCalledWith(
      'Unresolvable $ref "#/components/schemas/Missing" is validated as unknown.',
      'getPet response > #/components/schemas/Missing',
    );
  });

  describe('in error mode', () => {
    const strict = () => {
      const { reporter, setUnsupportedMode } = createWarnOnceReporter(
        'valibot',
        { warn: vi.fn(), verbose: vi.fn() },
      );
      setUnsupportedMode('error');
      return reporter;
    };
    const keepNothing = () => false;

    it.each([
      ['without a policy', undefined],
      ['with a policy', keepNothing],
    ])('throws on a circular ref %s', (_name, policy) => {
      expect(() =>
        dereferenceWithPolicy(
          { $ref: '#/components/schemas/Node' },
          context,
          policy,
          {
            label: 'getNode response',
            suggestReusable: false,
            reporter: strict(),
          },
        ),
      ).toThrow(
        /^\[orval\/valibot\] Circular \$ref .* At getNode response > #\/components\/schemas\/Node/,
      );
    });

    it.each([
      ['without a policy', undefined],
      ['with a policy', keepNothing],
    ])(
      'fails on a cut cycle with a reusable schemas hint %s',
      (_name, policy) => {
        expect(() =>
          dereferenceWithPolicy(
            { $ref: '#/components/schemas/Node' },
            context,
            policy,
            { suggestReusable: true, reporter: strict() },
          ),
        ).toThrow(
          'Set `override.valibot.generateReusableSchemas` to keep the cycle.',
        );
      },
    );

    it('still throws after a warn-mode run cached the expansion', () => {
      const { reporter, setUnsupportedMode } = createWarnOnceReporter(
        'valibot',
        { warn: vi.fn(), verbose: vi.fn() },
      );
      const run = () =>
        dereferenceWithPolicy(
          { $ref: '#/components/schemas/Node' },
          context,
          undefined,
          { suggestReusable: false, reporter },
        );
      run();
      setUnsupportedMode('error');
      expect(run).toThrow(/Circular \$ref/);
    });

    it('names a component once at the start of the path', () => {
      expect(() =>
        dereferenceWithPolicy(
          { $ref: '#/components/schemas/Node' },
          context,
          keepNothing,
          {
            label: '#/components/schemas/Node',
            suggestReusable: false,
            reporter: strict(),
          },
        ),
      ).toThrow(
        'At #/components/schemas/Node > #/components/schemas/Node. Set',
      );
    });

    it.each([
      ['without a policy', undefined],
      ['with a policy', keepNothing],
    ])('throws on an unresolvable ref %s', (_name, policy) => {
      expect(() =>
        dereferenceWithPolicy(
          { $ref: '#/components/schemas/Missing' },
          context,
          policy,
          {
            label: 'getPet response',
            suggestReusable: false,
            reporter: strict(),
          },
        ),
      ).toThrow(
        /Unresolvable \$ref .* At getPet response > #\/components\/schemas\/Missing\. Set `override\.valibot\.unsupported` to 'warn'/,
      );
    });
  });

  it('names the library and its option in the node limit error', () => {
    expect(() =>
      dereferenceWithPolicy(
        { $ref: '#/components/schemas/Pet' },
        context,
        undefined,
        { limit: 1, suggestReusable: true, reporter: createReporter() },
      ),
    ).toThrow(
      /^\[orval\/effect\] .* Set override\.effect\.generateReusableSchemas to true/,
    );
  });
});
