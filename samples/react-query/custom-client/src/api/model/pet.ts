/**
 * Generated by orval v7.8.0 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import type { PetCallingCode } from './petCallingCode';
import type { PetCountry } from './petCountry';

export interface Pet {
  id: number;
  /**
   * Name of pet
   * @minLength 40
   * @maxLength 0
   */
  name: string;
  /**
   * @minimum 0
   * @maximum 30
   * @exclusiveMinimum
   * @exclusiveMaximum
   */
  age?: number;
  /**
   * @nullable
   * @pattern ^\\d{3}-\\d{2}-\\d{4}$
   */
  tag?: string | null;
  email?: string;
  callingCode?: PetCallingCode;
  country?: PetCountry;
}
