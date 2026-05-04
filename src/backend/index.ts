import express from "express";
import https from "https";
import path from "path";
import cors from "cors";
import { Server } from "socket.io";
import config from "./config/config";
import router from "./interface/routes/router";
import helmet from "helmet";
import session from "express-session";
import { connectPostgres } from "./database/postgres";
import { connectMongoDB, store} from "./database/mongodb";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Le build Angular charge le CSS principal en media="print" puis bascule via onload.
// Helmet impose script-src-attr 'none' par défaut, ce qui bloque onload → page sans styles.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Autorise les images distantes (URLs http/https) dans les posts.
        "img-src": ["'self'", "data:", "https:", "http:"],
        "script-src-attr": ["'unsafe-inline'"],
      },
    },
  })
);

app.use(
  session({
    secret: "session-secret",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 1, // 1 heure
      secure: true,
    },
  })
);

app.use("/api", router);

// fichier statique d'Angular (express => tient débrouille toi Angular)
app.use(express.static(config.frontendPath, {
  index: false, // ne pas servir automatiquement vers le fichier index.html
  fallthrough: true // Permettre d'aller au middleware suivant sans interrompre le flux
}));

// toutes les routes GET non-API servent index.html (Angular)
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(config.frontendPath, "index.html"), (err) => {
    if (err) {
      res.status(500).send("Error de chargement de l'application frontend");
    }
  });
});

const httpsOptions = {
  key: config.certs.key,
  cert: config.certs.cert,
};

const server = https.createServer(httpsOptions, app);

const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

io.on("connection", (socketClient) => {
  socketClient.on("activite", (data: { kind?: string; postId?: string }) => {
    if (data?.kind === "publish") {
      socketClient.emit(
        "infoSocket",
        "Tu as publié — le serveur te répond ici via WebSocket (événement infoSocket).",
      );
    }
  });
});

app.set("io", io);

async function startServer() {
  try {
    await connectPostgres();
    await connectMongoDB();
  } catch (err) {
    console.error('Impossible de démarrer les connexions BDD:', err);
    process.exit(1);
  }

  server.listen(config.port_https, () => {
    console.log(`Server HTTPS démarré sur le port ${config.port_https}`);
  });
}

startServer();
