import { Router, Request, Response, NextFunction } from "express";

const authRouter = Router();

authRouter.post("/login", (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Le nom d'utilisateur et le mot de passe sont requis" });
  }

  console.log("username: " + username)
  console.log("password: " + password)
  res.send("Connexion réussie");
});

export default authRouter;
