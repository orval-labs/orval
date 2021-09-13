import { Inject, Injectable } from '@angular/core';
import { setupWorker, SetupWorkerApi } from 'msw';
import { getPetsMSW } from '../endpoints/pets/pets.msw';
import { MOCKED_API } from './mock.token';
import { MockedApi } from './mock.type';

@Injectable()
export class MockService {
  worker: SetupWorkerApi;

  constructor(@Inject(MOCKED_API) private mockedApi: MockedApi) {}

  loadMock() {
    const mocks = [...(this.mockedApi.pet ? getPetsMSW() : [])];
    this.worker = setupWorker(...mocks);
    this.worker.start();
  }
}
