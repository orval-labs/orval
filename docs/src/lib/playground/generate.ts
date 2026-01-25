import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';

import type { GenerateInput, GenerateOutput } from './types';

export interface OrvalPlaygroundConnector {
  generate(input: GenerateInput, ip: string | null): Promise<GenerateOutput[]>;
}

export const generateCode = createServerOnlyFn(
  (input: GenerateInput, ip: string | null): Promise<GenerateOutput[]> => {
    return (
      env.ORVAL_PLAYGROUND as unknown as OrvalPlaygroundConnector
    ).generate(input, ip);
  },
);

export const generatePlaygroundCode = createServerFn({ method: 'POST' })
  .inputValidator((input: GenerateInput) => input)
  .handler(async ({ data: input }): Promise<GenerateOutput[]> => {
    try {
      const request = getRequest();
      const ip = request.headers.get('cf-connecting-ip');
      const result = await generateCode(input, ip);
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to generate code: ${message}`);
    }
  });
