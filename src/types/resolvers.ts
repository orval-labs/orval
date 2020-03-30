import { GeneratorSchema } from './generator';

export type ResolverValue = {
  value: string;
  isEnum: boolean;
  type: string;
  imports: string[];
  schemas: GeneratorSchema[];
};
