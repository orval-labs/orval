import { env } from 'cloudflare:workers';

export interface GenerateInput {
  schema: string;
  config: string;
}

export interface GenerateOutput {
  content: string;
  filename: string;
}

export interface OrvalPlaygroundConnector {
  generate(input: GenerateInput): Promise<GenerateOutput[]>;
}

export const generateCode = (input: GenerateInput): Promise<GenerateOutput[]> => {
  return (env.ORVAL_PLAYGROUND as unknown as OrvalPlaygroundConnector).generate(input);
};
