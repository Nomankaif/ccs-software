import mongoose, { Schema } from "mongoose";

const caseReviewSchema = new Schema(
  {
    caseVersionId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    slug: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    action: {
      type: String,
      enum: ["submitted", "approved", "changes_requested"],
      required: true
    },
    comment: { type: String, default: "" },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const CaseReviewModel = mongoose.model("CaseReview", caseReviewSchema);
