import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

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
    },
    mongodb: {
      host: process.env.MONGO_HOST,
      port: Number(process.env.MONGO_PORT || 27017),
      user: process.env.MONGO_USER,
      password: process.env.MONGO_PASSWORD,
      database: process.env.MONGO_DATABASE,
    }
  },
  certs: {
    key: fs.readFileSync('src/backend/certs/key.pem'),
    cert: fs.readFileSync('src/backend/certs/cert.pem'),
  },
  frontendPath: path.join(__dirname, '../../../dist/front/browser'),
};

export default config;
