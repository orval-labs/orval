import {InfoObject} from 'openapi3-ts';
import {GeneratorApiResponse, GeneratorSchema} from './generator';

export type WriteSpecsProps = GeneratorApiResponse & {
  schemas: GeneratorSchema[];
  info: InfoObject;
};
