import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fn0Param,
  fn1Param,
  fn2Param,
  fn3Param,
  fnCallback,
  fnNestedLambda2Param,
  lambda0Param,
  lambda1Param,
  lambda2Param,
  lambda3Param,
  nestedLambda0Param,
  nestedLambda1Param,
  nestedLambda2Param,
  nestedLambda3Param,
} from './__tests__/mutator-test-files/named-export-tests';
import { getMutatorInfo } from './mutator-info';

const basePath = path.join(import.meta.dirname, '__tests__/mutator-test-files');

describe('getMutatorInfo', () => {
  describe('default anonymous export', () => {
    it('should work for anonymous function with 0 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-function-0-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0 });
    });

    it('should work for anonymous function with 1 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-function-1-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 1 });
    });

    it('should work for anonymous function with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-function-2-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 2 });
    });

    it('should work for anonymous function with 3 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-function-3-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 3 });
    });

    it('should work for anonymous lambda with 0 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-lambda-0-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0 });
    });

    it('should work for anonymous lambda with 1 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-lambda-1-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 1 });
    });

    it('should work for anonymous lambda with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-lambda-2-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 2 });
    });

    it('should work for anonymous lambda with 3 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-lambda-3-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 3 });
    });

    it('should work for anonymous lambda returning lambda with 0 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-nested-lambda-0-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 0 });
    });

    it('should work for anonymous lambda returning lambda with 1 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-nested-lambda-1-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 1 });
    });

    it('should work for anonymous lambda returning lambda with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-nested-lambda-2-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 2 });
    });

    it('should work for anonymous lambda returning lambda with 3 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'default-anonymous-nested-lambda-3-args.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 3 });
    });
  });

  describe('named export', () => {
    it('should work for function with 0 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: fn0Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0 });
    });

    it('should work for function with 1 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: fn1Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 1 });
    });

    it('should work for function with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: fn2Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 2 });
    });

    it('should work for function with 3 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: fn3Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 3 });
    });

    it('should work for lambda with 0 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: lambda0Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0 });
    });

    it('should work for lambda with 1 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: lambda1Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 1 });
    });

    it('should work for lambda with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: lambda2Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 2 });
    });

    it('should work for lambda with 3 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: lambda3Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 3 });
    });

    it('should work for lambda returning lambda with 0 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: nestedLambda0Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 0 });
    });

    it('should work for lambda returning lambda with 1 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: nestedLambda1Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 1 });
    });

    it('should work for lambda returning lambda with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: nestedLambda2Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 2 });
    });

    it('should work for lambda returning lambda with 3 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: nestedLambda3Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 3 });
    });

    it('should work for callback function with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: fnCallback.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 2 });
    });

    it('should work for function returning lambda with 2 args', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'named-export-tests.ts'),
        {
          namedExport: fnNestedLambda2Param.name,
        },
      );
      expect(result).toEqual({ numberOfParams: 0, returnNumberOfParams: 2 });
    });
  });

  describe('external module', () => {
    it('should work even if there are imports that cannot be resolved in external modules', async () => {
      const result = await getMutatorInfo(
        path.join(basePath, 'external-module-tests', 'mutation.ts'),
      );
      expect(result).toEqual({ numberOfParams: 0 });
    });
  });
});
