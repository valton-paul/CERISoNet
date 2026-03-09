import { MongoClient, Db } from 'mongodb';
import config from '../config/config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<Db> {
  if (db) return db;

  const url = `mongodb://${config.databases.mongodb.user}:${config.databases.mongodb.password}@${config.databases.mongodb.host}:${config.databases.mongodb.port}/${config.databases.mongodb.database}`;
  console.log(url);
  client = new MongoClient(url);

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
  if (!db) throw new Error('MongoDB non initialisé.');
  return db;
}
