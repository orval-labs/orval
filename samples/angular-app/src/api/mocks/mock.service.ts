import { Inject, Injectable } from '@angular/core';
import { setupWorker } from 'msw/browser';
import { getPetsMSW } from '../endpoints/pets/pets.msw';
import { MOCKED_API } from './mock.token';
import { MockedApi } from './mock.type';

@Injectable()
export class MockService {
  worker: ReturnType<typeof setupWorker>;

  constructor(@Inject(MOCKED_API) private mockedApi: MockedApi) {}

  loadMock() {
    const mocks = [...(this.mockedApi.pet ? getPetsMSW() : [])];
    this.worker = setupWorker(...mocks);
    this.worker.start();
  }
}
