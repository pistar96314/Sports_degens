import mongoose, { Schema, Document } from "mongoose";

export interface ICaptchaChallenge extends Document {
  id: number;
  user_id: string;
  session_id: string;
  created_at: Date;
  solved_at?: Date;
  success: boolean;
}

const CaptchaChallengeSchema = new Schema<ICaptchaChallenge>({
  id: { type: Number, required: true, unique: true },
  user_id: { type: String, required: true },
  session_id: { type: String, required: true },
  created_at: { type: Date, required: true },
  solved_at: { type: Date, required: false },
  success: { type: Boolean, required: true },
});

export const CaptchaChallenge = mongoose.model<ICaptchaChallenge>(
  "CaptchaChallenge",
  CaptchaChallengeSchema
);
