import { APP_INITIALIZER, NgModule } from '@angular/core';
import { MockService } from './mock.service';
import { initMocks } from './mock.setup';
import { MOCKED_API } from './mock.token';
import { MockedApi } from './mock.type';

@NgModule({
  imports: [],
  exports: [],
  declarations: [],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initMocks,
      deps: [MockService],
      multi: true,
    },
    MockService,
  ],
})
export class MocksModule {
  static forRoot(
    mockedApi: MockedApi = {
      pet: true,
    },
  ) {
    return {
      ngModule: MocksModule,
      providers: [{ provide: MOCKED_API, useValue: mockedApi }],
    };
  }
}
