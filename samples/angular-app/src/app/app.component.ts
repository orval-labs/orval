import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { PetsApiService } from '../api/endpoints/pets/pets.service';
import { Pet } from '../api/model';

@Component({
  selector: 'app-root',
  template: `
    <div className="App">
      <header className="App-header">
        <img src="../assets/logo.png" className="App-logo" alt="logo" />
        <p *ngFor="let pet of pets$ | async">{{ pet.name }}</p>
      </header>
    </div>
  `,
})
export class AppComponent implements OnInit {
  pets$: Observable<Pet[]>;
  constructor(private readonly petsApiService: PetsApiService) {}

  ngOnInit() {
    this.pets$ = this.petsApiService.listPets();
  }
}
