import { Pool } from 'pg';
import config from '../config/config';

let pool: Pool | null = null;

export async function connectPostgres(): Promise<Pool> {
  if (pool) return pool;

  const pg = config.databases.postgres;
  const socketDir = pg.unixSocketDir;

  /** Socket Unix (pedago) : `host` = répertoire du socket, pas de SSL. */
  pool = socketDir
    ? new Pool({
        host: socketDir,
        port: pg.port,
        user: pg.user,
        database: pg.database,
        ...(pg.password ? { password: pg.password } : {}),
      })
    : new Pool({
        host: pg.host,
        port: pg.port,
        user: pg.user,
        password: pg.password,
        database: pg.database,
        ssl: pg.ssl,
      });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1 FROM fredouil.compte');
    client.release();
    console.log('Connecté à PostgreSQL');
  } catch (err) {
    console.error('Erreur connexion PostgreSQL:', err);
    throw err;
  }

  return pool;
}

export function getPostgres(): Pool {
  if (!pool) throw new Error('PostgreSQL non initialisé.');
  return pool;
}
