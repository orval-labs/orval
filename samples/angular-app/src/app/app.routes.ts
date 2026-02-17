import { Routes } from '@angular/router';
import { App as AppHome } from './app';
import { ZodValidationDemo } from './zod-validation-demo';

export const routes: Routes = [
  { path: '', component: AppHome },
  { path: 'zod-demo', component: ZodValidationDemo },
];
