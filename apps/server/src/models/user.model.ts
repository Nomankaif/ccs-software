import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    paused: { type: Boolean, default: false },
    deletedAt: { type: Date },
    sessionVersion: { type: Number, default: 0 },
    role: { type: String, enum: ["student", "admin", "subadmin", "writer"], default: "student" }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", userSchema);
