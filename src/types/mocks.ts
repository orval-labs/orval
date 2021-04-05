import { GeneratorImport } from './generator';

export interface MockDefinition {
  value: string | string[] | { [key: string]: MockDefinition };
  enums?: string[];
  imports: GeneratorImport[];
  name: string;
  overrided?: boolean;
  properties?: string[];
}
