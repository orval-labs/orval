import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { PetsService } from '../api/endpoints/pets/pets.service';
import { environment } from '../environments/environment';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, HttpClientModule, ...environment.modules],
  providers: [PetsService],
  bootstrap: [AppComponent],
})
export class AppModule {}
