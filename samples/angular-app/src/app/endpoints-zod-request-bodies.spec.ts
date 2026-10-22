import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { z } from 'zod';

import { PetsService } from '../api/endpoints-zod-request-bodies/pets/pets.service';

/**
 * Runtime behaviour of `runtimeValidation: { requestBodies: true }` (#4145):
 * JSON request bodies are parsed with the generated Zod schema before the
 * request is sent, and a failure errors the observable without sending one.
 */
describe('endpoints-zod-request-bodies PetsService (runtimeValidation.requestBodies)', () => {
  let service: PetsService;
  let httpMock: HttpTestingController;

  const validPet = {
    id: 1,
    name: 'Rex',
    tag: 'dog',
    requiredNullableString: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PetsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends the parsed body, with schema defaults applied', async () => {
    const result = firstValueFrom(
      service.createPets({ name: 'Rex', tag: 'dog' }, 1),
    );

    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === '/v1/pets',
    );
    // `status` has a schema default, so the parsed (output) value carries it.
    expect(req.request.body).toEqual({
      name: 'Rex',
      tag: 'dog',
      status: 'available',
    });
    req.flush(null);

    await result;
  });

  it('errors the observable and sends nothing when the body is invalid', async () => {
    const error = await new Promise<unknown>((resolve, reject) => {
      service.createPets({ name: '', tag: 'dog' }, 1).subscribe({
        next: (value) =>
          reject(new Error(`expected error, got ${JSON.stringify(value)}`)),
        error: resolve,
      });
    });

    expect(error).toBeInstanceOf(z.ZodError);
    httpMock.expectNone(() => true);
  });

  it('does not parse until subscribed', () => {
    expect(() => service.createPets({ name: '', tag: 'dog' }, 1)).not.toThrow();
    httpMock.expectNone(() => true);
  });

  it('parses before the multi-content Accept dispatch', async () => {
    const error = await new Promise<unknown>((resolve, reject) => {
      service
        .updatePetById('1', { ...validPet, id: 0 }, 'application/json', 1)
        .subscribe({
          next: (value) =>
            reject(new Error(`expected error, got ${JSON.stringify(value)}`)),
          error: resolve,
        });
    });

    expect(error).toBeInstanceOf(z.ZodError);
    httpMock.expectNone(() => true);
  });

  it('sends an omitted optional body as-is', async () => {
    const result = firstValueFrom(
      service.patchPetById('1', undefined, 'application/json', 1),
    );

    const req = httpMock.expectOne(
      (r) => r.method === 'PATCH' && r.url === '/v1/pets/1/update',
    );
    expect(req.request.body).toBeNull();
    req.flush({ ...validPet, status: 'available' });

    await result;
  });

  it('sends a binary body unparsed', async () => {
    const file = new Blob(['image'], { type: 'application/octet-stream' });
    const result = firstValueFrom(service.uploadFile(1, file, 1));

    const req = httpMock.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toBe(file);
    req.flush(null);

    await result;
  });
});
