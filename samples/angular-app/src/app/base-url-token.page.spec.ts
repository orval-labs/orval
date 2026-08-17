import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { providePetstoreBaseUrl } from '../api/base-url-token/petstore.base-url';
import { BaseUrlTokenPage } from './base-url-token.page';

// Page-level coverage for the override.angular.baseUrl DI feature (#3711):
// token-resolution mechanics (default value, normalization, resolver
// precedence) are already covered by base-url-token.spec.ts. This spec only
// checks that an application-level providePetstoreBaseUrl() redirects both
// consumption surfaces — the generated PetsService (HttpClient) and the
// generated listPetsResource() (httpResource) — to the same gateway-prefixed
// base URL, and that the flushed data renders.
//
// The provider below mirrors the real registration in app.config.ts; it has to
// live in the TestBed (root) injector rather than on the component, because
// the generated services are `providedIn: 'root'`.
describe('BaseUrlTokenPage', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BaseUrlTokenPage],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePetstoreBaseUrl('/gateway/petstore'),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders the resolved gateway-prefixed base URL', () => {
    const fixture = TestBed.createComponent(BaseUrlTokenPage);
    fixture.detectChanges();

    for (const req of httpMock.match('/gateway/petstore/v1/pets')) {
      req.flush([]);
    }

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('/gateway/petstore');
  });

  it('prefixes the PetsService (HttpClient) request with the application-provided base URL and renders it', async () => {
    const fixture = TestBed.createComponent(BaseUrlTokenPage);
    fixture.detectChanges();

    const requests = httpMock.match('/gateway/petstore/v1/pets');
    expect(requests.length).toBe(2);

    const [serviceReq, resourceReq] = requests;
    expect(serviceReq.request.method).toBe('GET');
    serviceReq.flush([{ id: 1, name: 'Rex', requiredNullableString: null }]);
    resourceReq.flush([{ id: 1, name: 'Rex', requiredNullableString: null }]);

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Rex');
  });

  it('prefixes the listPetsResource() (httpResource) request with the same base URL and renders it', async () => {
    const fixture = TestBed.createComponent(BaseUrlTokenPage);
    fixture.detectChanges();

    const requests = httpMock.match('/gateway/petstore/v1/pets');
    expect(requests.length).toBe(2);

    for (const req of requests) {
      req.flush([{ id: 2, name: 'Milo', requiredNullableString: null }]);
    }

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Status: resolved');
    expect(compiled.textContent).toContain('Milo');
  });
});
