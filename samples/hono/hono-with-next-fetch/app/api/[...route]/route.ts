/**
 * Generated by orval v7.0.1 🍺
 * Do not edit manually.
 * Swagger Petstore
 * OpenAPI spec version: 1.0.0
 */
import { Hono } from 'hono';

import { listPetsHandlers } from './handlers/listPets';
import { createPetsHandlers } from './handlers/createPets';
import { showPetByIdHandlers } from './handlers/showPetById';

const app = new Hono();

/**
 * @summary List all pets
 */

app.get('/pets', ...listPetsHandlers);

/**
 * @summary Create a pet
 */

app.post('/pets', ...createPetsHandlers);

/**
 * @summary Info for a specific pet
 */

app.get('/pets/:petId', ...showPetByIdHandlers);

export default app;
