import express from "express";
import https from "https";
import path from "path";
import config from "./config/config";
import router from "./interface/routes/router";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Fichiers statiques et fallback pour le routing Angular
app.use(express.static(config.frontendPath));
app.get("/", (req, res) => {
  res.sendFile(path.join(config.frontendPath, "index.html"));
});

const httpsOptions = {
  key: config.certs.key,
  cert: config.certs.cert,
};

const server = https.createServer(httpsOptions, app);

server.listen(config.port_https, () => {
  console.log(`Server HTTPS is running on port ${config.port_https}`);
});
