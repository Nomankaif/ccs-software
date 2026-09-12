import mongoose, { Schema } from "mongoose";

const auditEventSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  status: { type: Number, required: true }
}, { timestamps: true });
auditEventSchema.index({ createdAt: -1 });
export const AuditEventModel = mongoose.model("AuditEvent", auditEventSchema);
