import argon2 from "argon2";
import { demoCase } from "../data/demo-case.js";
import { CaseModel, UserModel } from "../models/index.js";
import { ensureCatalogOrders } from "./order-catalog.service.js";

const ensureUser = async (email: string, role: "admin" | "student") => {
  const existing = await UserModel.findOne({ email });
  if (existing) return existing;
  return UserModel.create({ email, passwordHash: await argon2.hash("password"), role });
};

export const seedDevelopmentData = async () => {
  const admin = await ensureUser("admin@example.com", "admin");
  await ensureUser("student@example.com", "student");
  await ensureCatalogOrders(demoCase.orders, admin.id);

  if (!(await CaseModel.exists({ slug: demoCase.slug, status: "published" }))) {
    await CaseModel.create({
      slug: demoCase.slug,
      version: 1,
      status: "published",
      definition: demoCase,
      createdBy: admin._id,
      lastEditedBy: admin._id,
      approvedBy: admin._id,
      approvedAt: new Date(),
      publishedAt: new Date()
    });
  }
};
