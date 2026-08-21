import { Router } from "express";
import { credentialsSchema } from "@ccs/validation";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authRateLimit } from "../middleware/rate-limit.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimit, validateBody(credentialsSchema), authController.register);
authRouter.post("/login", authRateLimit, validateBody(credentialsSchema), authController.login);
authRouter.get("/me", requireAuth, authController.getCurrentUser);
authRouter.post("/logout", authController.logout);
