import { Router } from "express";
import { register, login, getMe, getCsrfToken, refreshSession, logout, revokeAllSessions, getSessions, beginMfaSetup, confirmMfaSetup } from "../controllers/auth.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/mfa/setup", beginMfaSetup);
router.post("/mfa/confirm", confirmMfaSetup);
router.post("/refresh", refreshSession);
router.get("/csrf", getCsrfToken);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);
router.get("/sessions", authenticate, getSessions);
router.delete("/sessions", authenticate, revokeAllSessions);

export default router;
