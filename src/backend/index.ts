import express from "express";
import https from "https";
import path from "path";
import config from "./config/config";
import router from "./interface/routes/router";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes API en premier
app.use("/api", router);

app.use(express.static(config.frontendPath, {
  index: false, // Ne pas servir  automatiquement
  fallthrough: true // Permettre au middleware suivant de s'exécuter si le fichier n'existe pas
}));

// toutes les routes GET non-API servent index.html (Angular)
app.get(/^(?!\/api).*$/, (req, res) => {
  // Servir index.html pour que Angular gère le routing côté client
  res.sendFile(path.join(config.frontendPath, "index.html"), (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).send("Error loading application");
    }
  });
});

const httpsOptions = {
  key: config.certs.key,
  cert: config.certs.cert,
};

const server = https.createServer(httpsOptions, app);

server.listen(config.port_https, () => {
  console.log(`Server HTTPS is running on port ${config.port_https}`);
});
