import { Pool } from 'pg';
import config from '../config/config';

let pool: Pool | null = null;

export async function connectPostgres(): Promise<Pool> {
  if (pool) return pool;

  pool = new Pool({
    connectionString: config.databases.postgres,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('PostgreSQL connecté');
  } catch (err) {
    console.error('Erreur connexion PostgreSQL:', err);
    throw err;
  }

  return pool;
}

export function getPostgres(): Pool {
  if (!pool) throw new Error('PostgreSQL non initialisé. Appeler connectPostgres() au démarrage.');
  return pool;
}

export async function disconnectPostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL déconnecté');
  }
}
