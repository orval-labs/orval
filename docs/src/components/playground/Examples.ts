import dedent from 'dedent';

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
          - name: testId
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
        oneOf:
          - $ref: '#/components/schemas/Dog'
          - $ref: '#/components/schemas/Cat'
        properties:
          '@id':
            type: string
            format: iri-reference
          id:
            type: integer
            format: int64
          name:
            type: string
          tag:
            type: string
          email:
            type: string
            format: email
          callingCode:
            type: string
            enum: ['+33', '+420', '+33'] # intentional duplicated value
          country:
            type: string
            enum: ["People's Republic of China", 'Uruguay']
      Dog:
        type: object
        oneOf:
          - $ref: '#/components/schemas/Labradoodle'
          - $ref: '#/components/schemas/Dachshund'
        required: ['type']
        properties:
          barksPerMinute:
            type: integer
          type:
            type: string
            enum:
              - dog
        discriminator:
          propertyName: breed
          mapping:
            Labradoodle: '#/components/schemas/Labradoodle'
            Dachshund: '#/components/schemas/Dachshund'
      Labradoodle:
        type: object
        required: ['cuteness']
        properties:
          cuteness:
            type: integer
      Dachshund:
        type: object
        required: ['length']
        properties:
          length:
            type: integer
      Cat:
        type: object
        required: ['type']
        properties:
          petsRequested:
            type: integer
          type:
            type: string
            enum:
              - cat
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

export const EXAMPLES = {
  ReactQuery: [
    {
      name: 'Basic',
      description: `This is the simplest example of generating output based on a specification.`,
      tags: [],
      config: dedent(/* JSON */ `{
          "output": {
            "client": "react-query",
            "target": "./src/generated/endpoints.ts",
            "mock": true
          },
          "input": {
            "target": "./schema.yaml"
          }
        }
      `),
      schema: SCHEMA,
    },
  ],
};
