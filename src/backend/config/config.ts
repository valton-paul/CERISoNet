import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/** Racine du dépôt (fonctionne en dev `src/backend/...` et après build `dist/back/...`). */
const projectRoot = path.resolve(__dirname, '../../..');

// Toujours charger `.env` à la racine du projet (pas seulement selon `process.cwd()`).
dotenv.config({ path: path.join(projectRoot, '.env') });

const config = {
  port: Number(process.env.PORT_HTTP || 3120),
  port_https: Number(process.env.PORT_HTTPS || 3121),
  nodeEnv: process.env.NODE_ENV || 'development',
  databases: {
    postgres: {
      host: process.env.POSTGRES_URL,
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      /**
       * Sur pedago : même usage que `psql etd` (socket Unix, sans TCP / sans mot de passe en peer).
       * Répertoire contenant le socket (souvent `/var/run/postgresql` ; sinon `SHOW unix_socket_directories;` dans psql).
       */
      unixSocketDir: (() => {
        const d = process.env.POSTGRES_UNIX_SOCKET_DIR?.trim();
        return d && d.startsWith('/') ? d : undefined;
      })(),
      /**
       * Connexion TCP uniquement : SSL si demandé (cert serveur souvent auto-signé).
       */
      ssl:
        process.env.POSTGRES_SSL === 'true' || process.env.POSTGRES_SSL === '1'
          ? {
              rejectUnauthorized:
                process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === 'true',
            }
          : undefined,
    },
    mongodb: {
      url: (process.env.MONGO_URL || '').trim(),
      collection:
        process.env.MONGO_COLLECTION ||
        `MySession${process.env.PORT_HTTPS || 3121}`,
      database: process.env.MONGO_DATABASE,
      postsCollection: process.env.MONGO_POSTS_COLLECTION,
    },
  },
  certs: {
    key: fs.readFileSync(path.join(projectRoot, 'src/backend/certs/key.pem')),
    cert: fs.readFileSync(path.join(projectRoot, 'src/backend/certs/cert.pem')),
  },
  /** Build Angular : `ng build` → `dist/front/browser`. */
  frontendPath: path.join(projectRoot, 'dist/front/browser'),
};

if (
  !config.databases.mongodb.url.startsWith('mongodb://') &&
  !config.databases.mongodb.url.startsWith('mongodb+srv://')
) {
  throw new Error(
    `MONGO_URL manquant ou invalide dans .env (attendu : mongodb://… ou mongodb+srv://…). ` +
      `Fichier chargé : ${path.join(projectRoot, '.env')}`,
  );
}

export default config;
