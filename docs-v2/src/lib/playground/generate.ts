import { createServerFn } from '@tanstack/react-start';

import { generateCode } from '@/lib/orval-playground';

import type { GenerateInput, GenerateOutput } from './types';

export const generatePlaygroundCode = createServerFn({ method: 'POST' })
  .inputValidator((input: GenerateInput) => input)
  .handler(async ({ data: input }): Promise<GenerateOutput[]> => {
    try {
      const result = await generateCode(input);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to generate code: ${message}`);
    }
  });
