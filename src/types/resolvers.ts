import { GeneratorImport, GeneratorSchema } from './generator';

export type ResolverValue = {
  value: string;
  isEnum: boolean;
  type: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
};
