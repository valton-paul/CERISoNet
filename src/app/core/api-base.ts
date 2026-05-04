/** Origine de l’API HTTPS (même port que `PORT_HTTPS` du backend). */
export const API_BASE_URL = 'https://pedago.univ-avignon.fr:3121/api';

/** Même origine sans `/api` — Socket.io (cf. fiche WebSocket). */
export const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
