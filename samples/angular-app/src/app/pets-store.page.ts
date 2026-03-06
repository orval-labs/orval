import { AsyncPipe, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { PetsService } from '../api/endpoints/pets/pets.service';

@Component({
  selector: 'app-pets-store-page',
  imports: [AsyncPipe, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pets-store.page.html',
  styleUrls: ['./pets-store.page.css'],
})
export class PetsStorePage implements OnInit {
  private readonly petService = inject(PetsService);

  protected readonly pets$ = this.petService.listPets();
  protected readonly title = signal('Pet Store');

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
