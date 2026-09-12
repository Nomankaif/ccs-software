import mongoose, { Schema } from "mongoose";

const caseSchema = new Schema(
  {
    slug: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: ["draft", "in_review", "changes_requested", "approved", "published", "retired"],
      default: "draft",
      index: true
    },
    definition: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
    retiredAt: Date,
    deletedAt: Date
  },
  { timestamps: true }
);

caseSchema.index({ slug: 1, version: 1 }, { unique: true });

export const CaseModel = mongoose.model("Case", caseSchema);
