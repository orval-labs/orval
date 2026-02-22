import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ZodValidationDemo } from './zod-validation-demo';

describe('ZodValidationDemo', () => {
  let httpMock: HttpTestingController;

  const validPet = {
    id: 1,
    name: 'Buddy',
    tag: 'dog',
    requiredNullableString: null,
  };

  const flushPendingGetRequests = () => {
    httpMock
      .match(() => true)
      .forEach((req) => {
        if (req.cancelled || req.request.method !== 'GET') {
          return;
        }

        if (req.request.url.includes('/search')) {
          req.flush([validPet]);
          return;
        }

        if (req.request.url.includes('/pets/')) {
          req.flush(validPet);
        }
      });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZodValidationDemo],
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

  it('should create the component', () => {
    const fixture = TestBed.createComponent(ZodValidationDemo);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render the demo sections', () => {
    const fixture = TestBed.createComponent(ZodValidationDemo);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Runtime Validation',
    );
    expect(compiled.querySelectorAll('.panel').length).toBe(4);

    flushPendingGetRequests();
  });

  it('should display pets from validated searchPets response', async () => {
    const fixture = TestBed.createComponent(ZodValidationDemo);
    fixture.detectChanges();

    // Find all requests to /search and respond to them
    const searchRequests = httpMock.match((req) => req.url.includes('/search'));
    expect(searchRequests.length).toBeGreaterThanOrEqual(1);

    // Respond to the first (body) request with valid data
    searchRequests[0].flush([
      { id: 1, name: 'Rex', tag: 'dog', requiredNullableString: null },
      { id: 2, name: 'Felix', requiredNullableString: null },
    ]);

    // Respond to remaining search requests (events, response observe modes)
    for (let i = 1; i < searchRequests.length; i++) {
      searchRequests[i].flush([
        { id: 1, name: 'Rex', tag: 'dog', requiredNullableString: null },
      ]);
    }

    // Flush the showPetById request
    const showRequests = httpMock.match((req) => req.url.includes('/pets/'));
    for (const req of showRequests) {
      req.flush({
        id: 1,
        name: 'Rex',
        tag: 'dog',
        requiredNullableString: null,
      });
    }

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const listItems = compiled.querySelectorAll('.panel:first-child li');
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain('Rex');
    expect(listItems[1].textContent).toContain('Felix');
  });

  it('should show single pet from validated showPetById response', async () => {
    const fixture = TestBed.createComponent(ZodValidationDemo);
    fixture.detectChanges();

    // Respond to showPetById (application/json)
    const showRequests = httpMock.match((req) => req.url.includes('/pets/'));
    expect(showRequests.length).toBeGreaterThanOrEqual(1);
    showRequests[0].flush({
      id: 1,
      name: 'Buddy',
      tag: 'golden',
      requiredNullableString: null,
    });

    flushPendingGetRequests();

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const preElement = compiled.querySelector('pre');
    expect(preElement).toBeTruthy();
    expect(preElement!.textContent).toContain('Buddy');
  });

  it('should handle create pet button click', async () => {
    const fixture = TestBed.createComponent(ZodValidationDemo);
    fixture.detectChanges();

    flushPendingGetRequests();

    // Click the Create Pet button
    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();

    // Respond to POST /pets
    const createReq = httpMock.expectOne('/pets');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({ name: 'Buddy', tag: 'dog' });
    createReq.flush(null);

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pet created successfully');
  });
});
