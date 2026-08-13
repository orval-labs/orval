import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { showPetByIdResource } from '../api/http-resource/pets/pets.service';
import { HttpResourcePage } from './http-resource.page';

describe('HttpResourcePage', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpResourcePage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders fetched httpResource data from the Angular testing backend', async () => {
    const fixture = TestBed.createComponent(HttpResourcePage);
    fixture.detectChanges();

    const listReq = httpMock.expectOne('/v1/pets');
    expect(listReq.request.method).toBe('GET');
    expect(listReq.request.headers.get('Accept')).toBe('application/json');
    listReq.flush([
      {
        id: 1,
        name: 'Rex',
        requiredNullableString: null,
      },
      {
        id: 2,
        name: 'Milo',
        requiredNullableString: null,
      },
    ]);

    const petReq = httpMock.expectOne('/v1/pets/1');
    expect(petReq.request.method).toBe('GET');
    expect(petReq.request.headers.get('Accept')).toBe('application/json');
    petReq.flush({
      id: 1,
      name: 'Rex',
      requiredNullableString: null,
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Status: resolved');
    expect(compiled.textContent).toContain('Rex');
    expect(compiled.textContent).toContain('Milo');
    expect(compiled.textContent).toContain('Rex (#1)');
  });

  it('renders backend errors without unsafe value() access', async () => {
    const fixture = TestBed.createComponent(HttpResourcePage);
    fixture.detectChanges();

    const listReq = httpMock.expectOne('/v1/pets');
    listReq.flush('Failed!', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    const petReq = httpMock.expectOne('/v1/pets/1');
    petReq.flush({
      id: 1,
      name: 'Rex',
      requiredNullableString: null,
    });

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Failed to load pets:');
    expect(compiled.textContent).toContain('Rex (#1)');
  });

  it('refetches multi-content resources when input signals change', async () => {
    const fixture = TestBed.createComponent(HttpResourcePage);
    fixture.detectChanges();

    httpMock
      .expectOne('/v1/pets')
      .flush([{ id: 1, name: 'Rex', requiredNullableString: null }]);
    httpMock
      .expectOne('/v1/pets/1')
      .flush({ id: 1, name: 'Rex', requiredNullableString: null });
    await fixture.whenStable();

    // Changing the path-param signal must refetch showPetByIdResource, even
    // though it is a multi-content-type resource (#3713). `whenStable()`
    // only resolves once in-flight HTTP requests are flushed, so flush
    // before awaiting it (mirrors the pattern used above).
    fixture.componentInstance['petId'].set('2');
    fixture.detectChanges();
    const petReq = httpMock.expectOne('/v1/pets/2');
    expect(petReq.request.headers.get('Accept')).toBe('application/json');
    petReq.flush({ id: 2, name: 'Milo', requiredNullableString: null });
    await fixture.whenStable();

    // Changing the shared `version` signal must refetch both resources.
    fixture.componentInstance['version'].set(2);
    fixture.detectChanges();
    httpMock.expectOne('/v2/pets').flush([]);
    httpMock
      .expectOne('/v2/pets/2')
      .flush({ id: 2, name: 'Milo', requiredNullableString: null });
    await fixture.whenStable();
  });
});

// Integration coverage for the emitted request-extension helper (#3710),
// driven end-to-end through Angular's reactive `httpResource` machinery and
// `HttpTestingController` rather than as a substring check of generated
// text (see tests/api-generation.spec.ts for the generation-shape check).
@Component({
  selector: 'app-request-extension-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class RequestExtensionHostComponent {
  readonly requestId = signal('req-1');
  readonly petId = signal('1');

  readonly resource = showPetByIdResource(this.petId, 'application/json', undefined, {
    headers: () => ({ 'x-request-id': this.requestId(), Accept: 'text/plain' }),
  });
}

describe('generated httpResource request extension (#3710)', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestExtensionHostComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('re-applies the generated Accept header, overriding an extension attempt to change it', async () => {
    const fixture = TestBed.createComponent(RequestExtensionHostComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne('/v1/pets/1');
    // The extension's `headers` function tries to set Accept: 'text/plain',
    // but the multi-content-type helper re-applies the generated Accept
    // header last, so JSON dispatch (and the header sent on the wire) must
    // still be 'application/json'.
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.headers.get('x-request-id')).toBe('req-1');

    req.flush({ id: 1, name: 'Rex', requiredNullableString: null });
    await fixture.whenStable();
  });

  it('reloads and re-reads the function-form headers when a signal they read changes', async () => {
    const fixture = TestBed.createComponent(RequestExtensionHostComponent);
    fixture.detectChanges();

    const firstReq = httpMock.expectOne('/v1/pets/1');
    expect(firstReq.request.headers.get('x-request-id')).toBe('req-1');
    firstReq.flush({ id: 1, name: 'Rex', requiredNullableString: null });
    await fixture.whenStable();

    fixture.componentInstance.requestId.set('req-2');
    fixture.detectChanges();

    // Do not `await fixture.whenStable()` here: stability cannot be reached
    // until the newly-issued request below is flushed, so awaiting it before
    // flushing would hang indefinitely.
    const secondReq = httpMock.expectOne('/v1/pets/1');
    expect(secondReq.request.headers.get('x-request-id')).toBe('req-2');
    secondReq.flush({ id: 1, name: 'Rex', requiredNullableString: null });
    await fixture.whenStable();
  });
});
