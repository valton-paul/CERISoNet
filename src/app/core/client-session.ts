/** Clés écrites à la connexion (`auth.ts`). */
const AUTH_STORAGE_KEYS = ['username', 'userId', 'mail', 'lastLogin', 'connected'] as const;

export function isClientMarkedConnected(): boolean {
  return localStorage.getItem('connected') === 'true';
}

export function clearClientAuthSession(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
