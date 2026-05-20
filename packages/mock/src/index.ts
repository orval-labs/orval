import type {
  FakerMockOptions,
  GenerateMockImports,
  GeneratorOptions,
  GeneratorVerbOptions,
  GlobalMockOptions,
  MswMockOptions,
} from '@orval/core';
import { OutputMockType } from '@orval/core';

import { generateFaker, generateFakerImports } from './faker';
import { generateMSW, generateMSWImports } from './msw';

export const DEFAULT_MSW_OPTIONS: MswMockOptions = {
  type: OutputMockType.MSW,
  useExamples: false,
};

export const DEFAULT_FAKER_OPTIONS: FakerMockOptions = {
  type: OutputMockType.FAKER,
  useExamples: false,
};

/**
 * Returns the default GlobalMockOptions for a given mock type. Used when
 * normalizing user-provided entries in `output.mocks.generators` so callers
 * can omit the per-type defaults.
 */
export const getDefaultMockOptionsForType = (
  type: GlobalMockOptions['type'],
): GlobalMockOptions => {
  switch (type) {
    case OutputMockType.FAKER: {
      return DEFAULT_FAKER_OPTIONS;
    }
    case OutputMockType.MSW: {
      return DEFAULT_MSW_OPTIONS;
    }
  }
};

/**
 * Dispatches mock-file imports generation to the appropriate generator based
 * on the `OutputMockType` discriminator on the mock options.
 */
export const generateMockImports: GenerateMockImports = (importOptions) => {
  switch (importOptions.options?.type) {
    case OutputMockType.FAKER: {
      return generateFakerImports(importOptions);
    }
    default: {
      return generateMSWImports(importOptions);
    }
  }
};

/**
 * Dispatches per-operation mock generation to the appropriate generator
 * based on the `OutputMockType` discriminator. Each entry in
 * `output.mocks.generators` is dispatched here individually.
 */
export function generateMock(
  generatorVerbOptions: GeneratorVerbOptions,
  generatorOptions: Omit<GeneratorOptions, 'mock'> & {
    mock: GlobalMockOptions;
  },
) {
  switch (generatorOptions.mock.type) {
    case OutputMockType.FAKER: {
      return generateFaker(generatorVerbOptions, generatorOptions);
    }
    default: {
      return generateMSW(generatorVerbOptions, generatorOptions);
    }
  }
}

export { generateFaker, generateFakerImports } from './faker';
export { generateMSW, generateMSWImports } from './msw';
