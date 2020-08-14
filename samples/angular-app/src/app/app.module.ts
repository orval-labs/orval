import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { PetsModule } from '../api/endpoints/pets/pets.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    PetsModule,
    HttpClientModule,
    ...environment.modules,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
