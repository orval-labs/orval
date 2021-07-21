import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { PetsService } from '../api/endpoints/pets/pets.service';
import { Pet } from '../api/model';

@Component({
  selector: 'app-root',
  template: `
    <div class="App">
      <header class="App-header">
        <img src="../assets/logo.svg" class="App-logo" alt="logo" />
        <p *ngFor="let pet of pets$ | async">{{ pet.name }}</p>
      </header>
    </div>
  `,
})
export class AppComponent implements OnInit {
  pets$: Observable<Pet[]>;
  constructor(private readonly petsService: PetsService) {}

  ngOnInit() {
    this.pets$ = this.petsService.listPets();
  }
}
