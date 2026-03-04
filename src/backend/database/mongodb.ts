import { MongoClient, Db } from 'mongodb';
import config from '../config/config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(config.databases.mongodb);

  try {
    await client.connect();
    db = client.db();
    await db.command({ ping: 1 });
    console.log('MongoDB connecté');
  } catch (err) {
    console.error('Erreur connexion MongoDB:', err);
    throw err;
  }

  return db;
}

export function getMongoDB(): Db {
  if (!db) throw new Error('MongoDB non initialisé. Appeler connectMongoDB() au démarrage.');
  return db;
}

export async function disconnectMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB déconnecté');
  }
}
