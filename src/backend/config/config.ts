import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const config = {
  port: Number(process.env.PORT_HTTP || 3120),
  port_https: Number(process.env.PORT_HTTPS || 3121),
  nodeEnv: process.env.NODE_ENV || 'development',
  certs: {
    key: fs.readFileSync('src/certs/key.pem'),
    cert: fs.readFileSync('src/certs/cert.pem'),
  },
  frontendPath: path.join(__dirname, '../../frontend'),
};

export default config;
