import mongoose, { Schema } from "mongoose";

const attemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caseVersionId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    caseSnapshot: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["active", "final_orders", "completed", "expired"],
      default: "active",
      index: true
    },
    realTimeEndsAt: { type: Date, required: true },
    finalOrdersStartsAt: { type: Date, required: true },
    simulatedMinute: { type: Number, default: 0 },
    location: { type: String, required: true },
    revision: { type: Number, default: 0 },
    orders: { type: [Schema.Types.Mixed], default: [] },
    results: { type: [Schema.Types.Mixed], default: [] },
    actions: { type: [Schema.Types.Mixed], default: [] },
    idempotencyKeys: { type: [String], default: [] },
    scoreReport: Schema.Types.Mixed,
    completedAt: Date
  },
  { timestamps: true, optimisticConcurrency: true }
);

export const AttemptModel = mongoose.model("Attempt", attemptSchema);
