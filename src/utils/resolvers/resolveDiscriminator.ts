import { OpenAPIObject, SchemaObject } from 'openapi3-ts';

/**
 * Propagate every `discriminator.propertyName` mapping to the original ref
 *
 * Note: This method directly mutate the `specs` object.
 *
 * @param specs
 */
export const resolveDiscriminator = (specs: OpenAPIObject) => {
  if (specs.components && specs.components.schemas) {
    Object.values(specs.components.schemas).forEach((schema: SchemaObject) => {
      if (!schema.discriminator || !schema.discriminator.mapping) {
        return;
      }
      const { mapping, propertyName } = schema.discriminator;

      Object.entries(mapping).map(([name, ref]) => {
        if (!ref.startsWith('#/components/schemas/')) {
          throw new Error('Discriminator mapping outside of `#/components/schemas` is not supported');
        }
        if (
          !(specs?.components?.schemas?.[ref.slice('#/components/schemas/'.length)] as SchemaObject).properties![
            propertyName
          ]?.$ref
        ) {
          // @ts-ignore This is check on runtime
          specs.components.schemas[ref.slice('#/components/schemas/'.length)].properties![propertyName].enum = [name];
        }
      });
    });
  }
};
