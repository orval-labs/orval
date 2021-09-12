import { InfoObject } from 'openapi3-ts';
import { NormalizedOutputOptions } from '.';
import { GeneratorOperations, GeneratorSchema } from './generator';

export type WriteSpecsProps = {
  operations: GeneratorOperations;
  schemas: Record<string, GeneratorSchema[]>;
  info: InfoObject;
  rootSpecKey: string;
};

export type WriteModeProps = {
  operations: GeneratorOperations;
  schemas: Record<string, GeneratorSchema[]>;
  info: InfoObject;
  output: NormalizedOutputOptions;
  workspace: string;
  specsName: Record<string, string>;
  header: string;
};
