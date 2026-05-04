import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { isClientMarkedConnected } from './client-session';

/** Accès réservé si la connexion côté client est encore marquée (`localStorage`). */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (isClientMarkedConnected()) {
    return true;
  }
  void router.navigate(['/auth']);
  return false;
};
