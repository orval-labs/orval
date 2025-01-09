/**
 * Generated by orval v7.4.1 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
export type CreatePetsBodyItem = {
  name: string;
  tag: string;
};

export type ListPetsParams = {
  /**
   * How many items to return at one time (max 100)
   */
  limit?: string;
};

export interface Error {
  code: number;
  message: string;
}

export interface Pet {
  id: number;
  name: string;
  tag: string;
}

export type Pets = Pet[];
