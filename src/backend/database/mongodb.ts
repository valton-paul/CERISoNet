import session from "express-session";
import connectMongoDBSession from "connect-mongodb-session";
import config from "../config/config";

const MongoDBStore = connectMongoDBSession(session);

export const store = new MongoDBStore({
  uri: config.databases.mongodb.url,
  collection: config.databases.mongodb.collection,
});

export const connectMongoDB = async () => {
  await store.client.connect();
  console.log("Connecté à MongoDB");
};

export const getMongoDB = async () => {
  return store.client;
};
