import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { PetsService } from '../api/endpoints/pets/pets.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="App">
      <h1>Hello, {{ title() }}</h1>
      <header class="App-header">
        <img src="logo.svg" class="App-logo" alt="logo" />
        @for (pet of pets$ | async; track pet) {
          <p>{{ pet.name }}</p>
        }
      </header>
      <h2>Content Type Overload Tests (Issue #2243)</h2>
      <p>Check browser console for test results</p>
    </div>
  `,
})
export class App implements OnInit {
  private readonly petService = inject(PetsService);
  protected readonly pets$ = this.petService.listPets();
  protected readonly title = signal('angular-app');

  ngOnInit() {
    this.petService.showPetById('1', 'text/plain').subscribe({
      next: (result) =>
        console.log('[text/plain] Result:', result, '| Type:', typeof result),
      error: (err) => console.error('[text/plain] Error:', err),
    });

    this.petService.showPetById('1', 'application/xml').subscribe({
      next: (result) =>
        console.log(
          '[application/xml] Result:',
          result,
          '| Type:',
          typeof result,
        ),
      error: (err) => console.error('[application/xml] Error:', err),
    });

    this.petService.showPetById('1', 'application/json').subscribe({
      next: (result) =>
        console.log(
          '[application/json] Result:',
          result,
          '| Type:',
          typeof result,
        ),
      error: (err) => console.error('[application/json] Error:', err),
    });

    this.petService.showPetById('1').subscribe({
      next: (result) =>
        console.log('[default] Result:', result, '| Type:', typeof result),
      error: (err) => console.error('[default] Error:', err),
    });
  }
}
