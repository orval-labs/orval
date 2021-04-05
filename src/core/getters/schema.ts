import { SchemaObject } from 'openapi3-ts';
import { useContext } from '../../utils/context';

export const getSchema = (
  name: string,
  schemas: { [key: string]: SchemaObject },
  specKey?: string,
) => {
  if (specKey) {
    const [context] = useContext();
    const specKeySchemas = Object.entries(
      context.specs[specKey].spec.components?.schemas || [],
    ).reduce((acc, [name, type]) => ({ ...acc, [name]: type }), {}) as {
      [key: string]: SchemaObject;
    };

    return specKeySchemas[name];
  }

  return schemas[name];
};
