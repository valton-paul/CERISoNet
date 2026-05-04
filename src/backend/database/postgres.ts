import { Pool } from 'pg';
import config from '../config/config';

let pool: Pool | null = null;

export async function connectPostgres(): Promise<Pool> {
  if (pool) return pool;

  pool = new Pool({
    host: config.databases.postgres.host,
    port: config.databases.postgres.port,
    user: config.databases.postgres.user,
    password: config.databases.postgres.password,
    database: config.databases.postgres.database,
    ssl: config.databases.postgres.ssl === 'true',
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
