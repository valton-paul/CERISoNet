import express from "express";
import https from "https";
import path from "path";
import cors from "cors";
import config from "./config/config";
import router from "./interface/routes/router";
import helmet from "helmet";
import { connectPostgres, connectMongoDB, disconnectPostgres, disconnectMongoDB } from "./database";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json()); // middleware pour parser le JSON dans les requêtes entrantes
app.use(express.urlencoded({ extended: true }));
app.use(helmet()); // simple middleware de sécurité (rajoute des headers)

app.use("/api", router);

// fichier statique d'Angular (express => tient débrouille toi Angular)
app.use(express.static(config.frontendPath, {
  index: false, // ne pas servir automatiquement
  fallthrough: true // Permettre d'aller au middleware suivant sans interrompre le flux
}));

// toutes les routes GET non-API servent index.html (Angular)
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(config.frontendPath, "index.html"), (err) => {
    if (err) {
      res.status(500).send("Error loading application");
    }
  });
});

const httpsOptions = {
  key: config.certs.key,
  cert: config.certs.cert,
};

const server = https.createServer(httpsOptions, app);

async function startServer() {
  try {
    await connectPostgres();
    await connectMongoDB();
  } catch (err) {
    console.error('Impossible de démarrer les connexions BDD:', err);
    process.exit(1);
  }

  server.listen(config.port_https, () => {
    console.log(`Server HTTPS is running on port ${config.port_https}`);
  });
}

function gracefulShutdown() {
  server.close(() => {
    disconnectPostgres().then(() => disconnectMongoDB()).then(() => process.exit(0));
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();
