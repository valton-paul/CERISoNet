import { Router } from "express";
import authRouter from "./auth";
import postsRouter from "./posts";

const router = Router();

router.use("/auth", authRouter);
router.use("/posts", postsRouter);

export default router;
