/**
 * Origine dynamique pour éviter les erreurs `ERR_CONNECTION_REFUSED`
 * quand l'app est servie derrière un proxy (port backend non exposé publiquement).
 */
const ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://pedago.univ-avignon.fr:3121';

/** API sur la même origine que l'app. */
export const API_BASE_URL = `${ORIGIN}/api`;

/** Socket.io sur la même origine que l'app. */
export const SOCKET_ORIGIN = ORIGIN;
