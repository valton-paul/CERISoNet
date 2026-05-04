import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth').then(m => m.AuthComponent)
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home').then(m => m.HomeComponent)
  },
  {
    path: '',
    redirectTo: '/auth',
    pathMatch: 'full'
  }
];
