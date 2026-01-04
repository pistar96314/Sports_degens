import { Router } from "express";
import {
  register,
  login,
  createCaptchaChallenge,
  verifyCaptchaChallenge,
} from "../../controllers/authController";
import { validate } from "../../middleware/validate";
import {
  registerSchema,
  loginSchema,
  captchaChallengeSchema,
  captchaVerifySchema,
} from "./schemas";
import { rateLimit } from "../../middleware/rateLimit";

const router = Router();

// Public routes
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

// v02: captcha scaffold
router.post(
  "/captcha/challenge",
  rateLimit({ max: 60 }),
  validate(captchaChallengeSchema),
  createCaptchaChallenge
);
router.post(
  "/captcha/verify",
  rateLimit({ max: 60 }),
  validate(captchaVerifySchema),
  verifyCaptchaChallenge
);

// TODO: OAuth routes (to be implemented later)
// router.get('/discord', discordAuth);
// router.get('/discord/callback', discordCallback);
// router.get('/google', googleAuth);
// router.get('/google/callback', googleCallback);
// router.get('/steam', steamAuth);
// router.get('/steam/callback', steamCallback);

export default router;
