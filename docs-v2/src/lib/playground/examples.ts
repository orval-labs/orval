import dedent from 'dedent';

import type { Example, ExampleCategory } from './types';

const SCHEMA = dedent(/* YAML */ `
  openapi: '3.0.0'
  info:
    version: 1.0.0
    title: Swagger Petstore
    license:
      name: MIT
  servers:
    - url: https://petstore3.swagger.io/api/v3/openapi.json
  paths:
    /pets:
      get:
        summary: List all pets
        operationId: listPets
        tags:
          - pets
        parameters:
          - name: limit
            in: query
            description: How many items to return at one time (max 100)
            required: false
            schema:
              type: string
        responses:
          '200':
            description: A paged array of pets
            headers:
              x-next:
                description: A link to the next page of responses
                schema:
                  type: string
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Pets'
          default:
            description: unexpected error
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Error'
      post:
        summary: Create a pet
        operationId: createPets
        tags:
          - pets
        requestBody:
          required: true
          content:
            application/json:
              schema:
                type: object
                required:
                  - 'name'
                  - 'tag'
                properties:
                  name:
                    type: string
                  tag:
                    type: string
        responses:
          '200':
            description: Created Pet
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Pet'
          default:
            description: unexpected error
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Error'
    /pets/{petId}:
      get:
        summary: Info for a specific pet
        operationId: showPetById
        tags:
          - pets
        parameters:
          - name: petId
            in: path
            required: true
            description: The id of the pet to retrieve
            schema:
              type: string
        responses:
          '200':
            description: Expected response to a valid request
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Pet'
          default:
            description: unexpected error
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Error'
  components:
    schemas:
      Pet:
        type: object
        required:
          - id
          - name
        properties:
          id:
            type: integer
            format: int64
          name:
            type: string
          tag:
            type: string
      Pets:
        type: array
        items:
          $ref: '#/components/schemas/Pet'
      Error:
        type: object
        required:
          - code
          - message
        properties:
          code:
            type: integer
            format: int32
          message:
            type: string
`);

export const EXAMPLES: Record<string, Example[]> = {
  'React Query': [
    {
      name: 'Basic',
      description:
        'This is the simplest example of generating output based on a specification.',
      tags: [],
      config: dedent(/* JSON */ `{
        "output": {
          "httpClient": "fetch",
          "client": "react-query",
          "target": "./src/generated/endpoints.ts",
          "mock": true
        },
        "input": {
          "target": "./schema.yaml"
        }
      }`),
      schema: SCHEMA,
    },
  ],
  Axios: [
    {
      name: 'Basic',
      description: 'Generate Axios client with type-safe functions.',
      tags: [],
      config: dedent(/* JSON */ `{
        "output": {
          "httpClient": "axios",
          "target": "./src/generated/endpoints.ts"
        },
        "input": {
          "target": "./schema.yaml"
        }
      }`),
      schema: SCHEMA,
    },
  ],
  Fetch: [
    {
      name: 'Basic',
      description: 'Generate native fetch client.',
      tags: [],
      config: dedent(/* JSON */ `{
        "output": {
          "httpClient": "fetch",
          "target": "./src/generated/endpoints.ts"
        },
        "input": {
          "target": "./schema.yaml"
        }
      }`),
      schema: SCHEMA,
    },
  ],
  Angular: [
    {
      name: 'Basic',
      description: 'Generate Angular HttpClient services.',
      tags: [],
      config: dedent(/* JSON */ `{
        "output": {
          "httpClient": "angular",
          "client": "angular",
          "target": "./src/generated/endpoints.ts"
        },
        "input": {
          "target": "./schema.yaml"
        }
      }`),
      schema: SCHEMA,
    },
  ],
  SWR: [
    {
      name: 'Basic',
      description: 'Generate SWR hooks for data fetching.',
      tags: [],
      config: dedent(/* JSON */ `{
        "output": {
          "httpClient": "fetch",
          "client": "swr",
          "target": "./src/generated/endpoints.ts"
        },
        "input": {
          "target": "./schema.yaml"
        }
      }`),
      schema: SCHEMA,
    },
  ],
  Zod: [
    {
      name: 'With Validation',
      description: 'Generate Zod schemas for runtime validation.',
      tags: ['validation'],
      config: dedent(/* JSON */ `{
        "output": {
          "httpClient": "fetch",
          "client": "zod",
          "target": "./src/generated/endpoints.ts"
        },
        "input": {
          "target": "./schema.yaml"
        }
      }`),
      schema: SCHEMA,
    },
  ],
};

export const getGroupedExamples = (): ExampleCategory[] =>
  Object.entries(EXAMPLES).map(([catName, category]) => ({
    label: catName,
    options: category.map((example, index) => ({
      ...example,
      selectId: `${catName}__${index}`,
    })),
  }));

export const DEFAULT_EXAMPLE = {
  catName: 'React Query',
  index: 0,
} as const;

export const getDefaultExample = () =>
  EXAMPLES[DEFAULT_EXAMPLE.catName][DEFAULT_EXAMPLE.index];
