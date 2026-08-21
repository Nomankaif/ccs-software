import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false
});
