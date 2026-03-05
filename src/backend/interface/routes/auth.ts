import { Router, Request, Response } from "express";
import { getPostgres } from "../../database";

const authRouter = Router();

authRouter.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Le nom d'utilisateur et le mot de passe sont requis",
      });
  }

  try {
    const pool = getPostgres();

    const result = await pool.query(
      `SELECT 1 FROM fredouil.users WHERE identifiant = $1 AND motpasse = $2 LIMIT 1`,
      [username, password]
    );

    if (result.rowCount && result.rowCount > 0) {
      return res
        .status(200)
        .json({ success: true, message: "Connexion réussie" });
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

export default authRouter;
