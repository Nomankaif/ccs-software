import mongoose, { Schema } from "mongoose";

const orderCatalogSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    aliases: { type: [String], default: [] },
    category: {
      type: String,
      enum: [
        "Medication",
        "Laboratory",
        "Imaging",
        "Other Tests",
        "Procedure",
        "Monitoring",
        "Consultation",
        "Counseling"
      ],
      required: true,
      index: true
    },
    route: { type: [String], default: undefined },
    dose: { type: [String], default: undefined },
    frequency: { type: [String], default: undefined },
    duration: { type: [String], default: undefined },
    priority: { type: [String], default: undefined },
    defaultResultDelayMinutes: Number,
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

orderCatalogSchema.index({ name: "text", aliases: "text", orderId: "text" });

export const OrderCatalogModel = mongoose.model("OrderCatalog", orderCatalogSchema);
