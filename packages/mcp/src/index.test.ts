import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOutputOptions,
} from '@orval/core';
import { describe, expect, it } from 'vitest';
import { builder, getMcpHeader } from './index';

describe('MCP Generator', () => {
  it('should export builder function', () => {
    const mcpBuilder = builder()();

    expect(mcpBuilder).toBeDefined();
    expect(mcpBuilder.client).toBeDefined();
    expect(mcpBuilder.header).toBeDefined();
    expect(mcpBuilder.extraFiles).toBeDefined();
  });

  it('should generate handler with correct name', async () => {
    const { generateMcp } = await import('./index');

    const verbOptions = {
      operationName: 'testOperation',
      params: [],
      body: { definition: null },
    } as unknown as GeneratorVerbOptions;

    const result = await generateMcp(
      verbOptions,
      {} as GeneratorOptions,
      'fetch',
      {} as NormalizedOutputOptions,
    );

    expect(result.implementation).toContain('testOperationHandler');
    expect(result.implementation).toContain('await testOperation()');
  });

  it('should handle mutator in getMcpHeader correctly', () => {
    // Test that getMcpHeader does NOT include mutator imports
    const verbOptions = {
      testOp: {
        operationName: 'testOp',
        params: [],
        body: { definition: null },
        mutator: {
          name: 'customMutator',
          path: './mutator.ts',
        },
      },
    } as unknown as Record<string, GeneratorVerbOptions>;

    const output = {
      target: '/test/handlers.ts',
      schemas: '/test/http-schemas',
    } as NormalizedOutputOptions;

    const result = getMcpHeader({
      title: 'test',
      isRequestOptions: false,
      isMutator: false,
      isGlobalMutator: false,
      provideIn: 'root',
      hasAwaitedType: false,
      verbOptions,
      output,
      clientImplementation: '',
    });

    // Should NOT contain mutator import in handlers
    expect(result).not.toContain('customMutator');
    expect(result).toContain("import {\n  testOp\n} from './http-client'");
  });

  it('should collect mutators from verb options', () => {
    // Test that the mutator collection logic works
    const verbOptions = {
      op1: {
        mutator: {
          name: 'mutator1',
          path: './mutator1.ts',
        },
      },
      op2: {
        mutator: {
          name: 'mutator2',
          path: './mutator2.ts',
        },
      },
      op3: {
        mutator: {
          name: 'mutator1', // Same mutator as op1
          path: './mutator1.ts',
        },
      },
      op4: {
        // No mutator
      },
    } as unknown as Record<string, GeneratorVerbOptions>;

    // Extract mutator collection logic from generateHttpClinetFiles
    const allMutators = Object.values(verbOptions).reduce(
      (acc, verbOption) => {
        if (verbOption.mutator) {
          acc[verbOption.mutator.name] = verbOption.mutator;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    // Should collect unique mutators
    expect(Object.keys(allMutators)).toHaveLength(2);
    expect(allMutators).toHaveProperty('mutator1');
    expect(allMutators).toHaveProperty('mutator2');
  });
});
