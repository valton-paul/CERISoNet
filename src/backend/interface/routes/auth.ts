import { Router, Request, Response } from "express";
import { getPostgres } from "../../database/postgres";
import crypto from "crypto";
import { Session } from "express-session";

const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response) => {
  const { mail, password } = req.body;

  if (!mail || !password) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Le mail et le mot de passe sont requis",
      });
  }

  try {
    const passwordHash = crypto.createHash("sha1").update(password).digest("hex");

    const pool = getPostgres();

    const result = await pool.query(
      `SELECT id, mail, pseudo FROM fredouil.compte WHERE mail = $1 AND motpasse = $2 LIMIT 1`,
      [mail, passwordHash]
    );

    if (result.rowCount && result.rowCount > 0 && result.rows[0]) {
      const session = req.session as Session & {
        isConnected: boolean;
        userId: number;
        pseudo: string;
        mail: string;
        lastLogin: string;
      };
      session.isConnected = true;
      session.userId = result.rows[0].id as number;
      session.pseudo = result.rows[0].pseudo;
      session.mail = result.rows[0].mail;
      session.lastLogin = new Date().toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
      });

      req.session.save((err) => {
        if (err) {
          console.error("Erreur lors de la sauvegarde de la session :", err);
          return res
            .status(500)
            .json({ success: false, error: "Erreur de session" });
        }

        return res
          .status(200)
          .json({
            success: true,
            message: "Connexion réussie",
            username: session.pseudo,
            userId: session.userId,
            mail: session.mail,
            lastLogin: session.lastLogin,
          });
      });

      return;
    }

    return res
      .status(401)
      .json({ success: false, error: "Identifiant ou mot de passe incorrect" });
  } catch (err) {
    console.error("Erreur lors de la tentative de connexion:", err);
    return res
      .status(500)
      .json({ success: false, error: "Erreur interne du serveur" });
  }
});

authRouter.get("/me", (req: Request, res: Response) => {
  const session = req.session as Session & {
    isConnected: boolean;
    userId: number;
    pseudo: string;
    mail: string;
    lastLogin: string;
  };

  if (session?.isConnected) {
    return res.status(200).json({
      connected: true,
      username: session.pseudo,
      userId: session.userId,
      mail: session.mail,
      lastLogin: session.lastLogin,
    });
  }

  return res.status(200).json({ connected: false });
});

authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Erreur lors de la destruction de session :", err);
      return res.status(500).json({ error: "Impossible de se déconnecter" });
    }
    return res.status(200).json({ ok: true });
  });
});

export default authRouter;
