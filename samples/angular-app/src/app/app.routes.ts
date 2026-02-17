import { Routes } from '@angular/router';
import { AppHome } from './app';
import { ZodValidationDemo } from './zod-validation-demo';

export const routes: Routes = [
  { path: '', component: AppHome },
  { path: 'zod-demo', component: ZodValidationDemo },
];
