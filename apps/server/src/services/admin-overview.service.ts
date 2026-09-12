import argon2 from "argon2";
import { UserModel } from "../models/user.model.js";
import { AttemptModel } from "../models/attempt.model.js";
import { CaseModel } from "../models/case.model.js";
import { AuditEventModel } from "../models/audit-event.model.js";
import { CaseReviewModel } from "../models/case-review.model.js";
import { AppError } from "../errors/app-error.js";
import { RefreshSessionModel } from "../models/index.js";
import { isValidObjectId } from "mongoose";

export const escapeSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageSize = 25;

export async function listUsers(q: string, role: string, page: number) {
  const filter = { deletedAt: null, ...(q ? { email: { $regex: escapeSearch(q), $options: "i" } } : {}),
    role: role === "employees" ? { $in: ["admin", "subadmin", "writer"] } : role || "student" };
  const total = await UserModel.countDocuments(filter);
  const users = await UserModel.find(filter).select("email role createdAt paused").sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize).limit(pageSize).lean();
  return { users, total, page, pageSize };
}

export async function createUser(input: { email: string; password: string; role: "student" | "subadmin" | "writer" }) {
  try {
    const user = await UserModel.create({ email: input.email, role: input.role,
      passwordHash: await argon2.hash(input.password) });
    return { _id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AppError(409, "Email already registered");
    throw error;
  }
}

export async function changeEmployee(id: string, actorId: string, action: "pause" | "resume" | "delete") {
  if (!isValidObjectId(id)) throw new AppError(400, "Invalid employee ID");
  if (id === actorId) throw new AppError(400, "You cannot pause or delete your own account");
  // Root administrators are protected; this screen manages provisioned employees.
  const employee = await UserModel.findOneAndUpdate(
    { _id: id, role: { $in: ["subadmin", "writer"] }, deletedAt: null },
    { $set: action === "delete" ? { deletedAt: new Date(), paused: true } : { paused: action === "pause" },
      $inc: { sessionVersion: 1 } },
    { new: true }
  );
  if (!employee) throw new AppError(404, "Employee not found or account is protected");
  await RefreshSessionModel.deleteMany({ userId: id });
  return { _id: employee.id, email: employee.email, role: employee.role, paused: employee.paused, createdAt: employee.createdAt };
}

export async function analytics(days: number) {
  const since = new Date(Date.now() - days * 86400_000);
  const match = { createdAt: { $gte: since } };
  const statuses = await AttemptModel.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  const cases = await AttemptModel.aggregate([
    { $match: match },
    { $group: { _id: "$caseVersionId", title: { $first: "$caseSnapshot.title" }, version: { $first: "$caseSnapshot.version" },
      attempts: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ["$status", ["completed", "expired"]] }, 1, 0] } },
      averageScore: { $avg: { $cond: [{ $in: ["$status", ["completed", "expired"]] }, "$scoreReport.total", null] } } } },
    { $sort: { attempts: -1, _id: 1 } }
  ]);
  const users = await UserModel.countDocuments();
  const publishedCases = await CaseModel.countDocuments({ status: "published" });
  return { days, users, publishedCases, statuses, cases };
}

export async function auditLog(q: string, page: number) {
  const pipeline: import("mongoose").PipelineStage[] = [
    { $project: { actorId: 1, action: 1, resource: 1, status: 1, createdAt: 1, source: { $literal: "admin" } } },
    { $unionWith: { coll: CaseReviewModel.collection.name, pipeline: [
      { $project: { actorId: "$reviewerId", action: "$action", resource: { $concat: ["Case review: ", "$slug", " v", { $toString: "$version" }] },
        createdAt: 1, source: { $literal: "review" } } }
    ] } },
    { $lookup: { from: UserModel.collection.name, localField: "actorId", foreignField: "_id", as: "actor", pipeline: [{ $project: { email: 1 } }] } },
    { $set: { actorEmail: { $ifNull: [{ $arrayElemAt: ["$actor.email", 0] }, "Unknown user"] } } },
    { $project: { actor: 0 } },
    ...(q ? [{ $match: { $or: ["actorEmail", "resource", "action"].map(key => ({ [key]: { $regex: escapeSearch(q), $options: "i" } })) } }] : []),
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: { events: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }], count: [{ $count: "total" }] } }
  ];
  const [result] = await AuditEventModel.aggregate(pipeline);
  return { events: result.events, total: result.count[0]?.total ?? 0, page, pageSize };
}
