import { caseDefinitionSchema, type CaseDefinitionInput } from "@ccs/validation";
import { AppError } from "../errors/app-error.js";
import { defineAbility, caseSubject, type UserRole } from "@ccs/domain";
import { CaseModel, CaseReviewModel } from "../models/index.js";
import { ensureCatalogOrders, resolveCatalogOrders } from "./order-catalog.service.js";
import { evaluateCaseQuality } from "./case-quality.service.js";

export type CaseWorkflowStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published" | "retired";

export const caseEditMode = (_status: CaseWorkflowStatus) => "update";

export const canIndependentlyReview = (lastEditorId: string, reviewerId: string) =>
  lastEditorId !== reviewerId;

const requireCase = async (id: string) => {
  const entry = await CaseModel.findById(id);
  if (!entry || entry.deletedAt) throw new AppError(404, "Case not found");
  return entry;
};

const studentCaseProjection = [
  "_id",
  "version",
  "definition.slug",
  "definition.title",
  "definition.specialty",
  "definition.difficulty",
  "definition.durationMinutes",
  "definition.finalOrderMinutes",
  "definition.opening"
].join(" ");

export const serializeStudentCaseSummary = (entry: any) => ({
  id: String(entry._id),
  version: entry.version,
  slug: entry.definition.slug,
  title: entry.definition.title,
  specialty: entry.definition.specialty,
  difficulty: entry.definition.difficulty,
  durationMinutes: entry.definition.durationMinutes,
  finalOrderMinutes: entry.definition.finalOrderMinutes,
  opening: entry.definition.opening
});

export const listPublishedCases = async () => {
  const cases = await CaseModel.find({ status: "published", deletedAt: null })
    .select(studentCaseProjection)
    .sort({ "definition.title": 1 })
    .lean();
  return cases.map(serializeStudentCaseSummary);
};

export const getPublishedCase = async (id: string) => {
  const entry = await CaseModel.findOne({ _id: id, status: "published", deletedAt: null })
    .select(studentCaseProjection)
    .lean();
  if (!entry) throw new AppError(404, "Case not found");
  return serializeStudentCaseSummary(entry);
};

export const listAdminCases = async () => {
  const cases = await CaseModel.find({ deletedAt: null }).sort({ version: -1, updatedAt: -1 }).lean();
  return latestCases(cases).map(serializeAdminCase);
};

export function latestCases<T extends { slug: string; version: number; updatedAt?: Date }>(entries: T[]): T[] {
  const latest = new Map<string, T>();
  for (const entry of entries) {
    if (!latest.has(entry.slug) || latest.get(entry.slug)!.version < entry.version) latest.set(entry.slug, entry);
  }
  return [...latest.values()].sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0));
}

export const serializeAdminCase = (entry: any) => ({
    id: entry._id,
    version: entry.version,
    status: entry.status,
    updatedAt: entry.updatedAt,
    createdBy: entry.createdBy ? String(entry.createdBy) : undefined,
    lastEditedBy: entry.lastEditedBy ? String(entry.lastEditedBy) : String(entry.createdBy),
    submittedAt: entry.submittedAt,
    approvedAt: entry.approvedAt,
    approvedBy: entry.approvedBy ? String(entry.approvedBy) : undefined,
    publishedAt: entry.publishedAt,
    retiredAt: entry.retiredAt,
    ...entry.definition
  });

const normalizeDefinition = async (definition: CaseDefinitionInput, userId: string) => {
  await ensureCatalogOrders(definition.orders, userId);
  return { ...definition, orders: await resolveCatalogOrders(definition.orders) };
};

export const createCaseVersion = async (definition: CaseDefinitionInput, userId: string) => {
  const latest = await CaseModel.findOne({ slug: definition.slug }).sort({ version: -1 }).lean();
  if (latest && !latest.deletedAt) throw new AppError(409, "A case with this slug already exists. Edit the existing case instead.");
  const normalizedDefinition = await normalizeDefinition(definition, userId);
  return CaseModel.create({
    slug: definition.slug,
    version: (latest?.version ?? 0) + 1,
    definition: normalizedDefinition,
    createdBy: userId,
    lastEditedBy: userId
  });
};

export const updateCaseVersion = async (
  id: string,
  definition: CaseDefinitionInput,
  userId: string,
  role: UserRole
) => {
  const entry = await requireCase(id);
  if (!defineAbility(role).can("update", caseSubject(entry.status))) throw new AppError(403, "Case writers can edit draft cases only");
  if (definition.slug !== entry.slug) {
    throw new AppError(400, "A saved case slug cannot change");
  }
  entry.definition = await normalizeDefinition(definition, userId);
  entry.lastEditedBy = userId as any;
  entry.status = "draft";
  entry.submittedAt = undefined;
  entry.approvedAt = undefined;
  entry.approvedBy = undefined;
  entry.publishedAt = undefined;
  entry.retiredAt = undefined;
  await entry.save();
  await CaseModel.updateMany({ slug: entry.slug, _id: { $ne: entry._id }, status: "published" }, { status: "retired", retiredAt: new Date() });
  return entry;
};

export const importCaseVersions = async (
  input: CaseDefinitionInput | CaseDefinitionInput[],
  userId: string
) => {
  const definitions = Array.isArray(input) ? input : [input];
  const created = [];
  for (const definition of definitions) {
    created.push(await createCaseVersion(definition, userId));
  }
  return created;
};

export const validateCaseVersion = async (id: string) => {
  const entry = await requireCase(id);
  return caseDefinitionSchema.safeParse(entry.definition);
};

export const submitCaseForReview = async (id: string, userId: string, comment = "") => {
  const entry = await requireCase(id);
  if (!["draft", "changes_requested"].includes(entry.status)) {
    throw new AppError(409, "Only an editable draft can be submitted for review");
  }
  const result = caseDefinitionSchema.safeParse(entry.definition);
  if (!result.success) {
    throw new AppError(422, "Case is invalid", { issues: result.error.issues });
  }
  const quality = evaluateCaseQuality(result.data);
  if (!quality.ready) throw new AppError(422, "Case failed publication-readiness validation", { quality });
  entry.status = "in_review";
  entry.submittedAt = new Date();
  await entry.save();
  await CaseReviewModel.create({
    caseVersionId: entry._id,
    slug: entry.slug,
    version: entry.version,
    action: "submitted",
    comment,
    reviewerId: userId
  });
  return entry;
};

export const reviewCaseVersion = async (
  id: string,
  reviewerId: string,
  decision: "approved" | "changes_requested",
  comment: string
) => {
  const entry = await requireCase(id);
  if (entry.status !== "in_review") throw new AppError(409, "Case is not awaiting review");
  const lastEditorId = String(entry.lastEditedBy ?? entry.createdBy);
  if (!canIndependentlyReview(lastEditorId, reviewerId)) {
    throw new AppError(403, "The last editor cannot review this case version");
  }
  if (decision === "changes_requested" && comment.trim().length < 3) {
    throw new AppError(400, "A reviewer comment is required when requesting changes");
  }
  entry.status = decision;
  if (decision === "approved") {
    entry.approvedAt = new Date();
    entry.approvedBy = reviewerId as any;
  }
  await entry.save();
  await CaseReviewModel.create({
    caseVersionId: entry._id,
    slug: entry.slug,
    version: entry.version,
    action: decision,
    comment,
    reviewerId
  });
  return entry;
};

export const publishCaseVersion = async (id: string) => {
  const entry = await requireCase(id);
  const result = caseDefinitionSchema.safeParse(entry.definition);
  if (!result.success) throw new AppError(422, "Case is invalid", { issues: result.error.issues });
  const quality = evaluateCaseQuality(result.data);
  if (!quality.ready) throw new AppError(422, "Case failed publication-readiness validation", { quality });

  await CaseModel.updateMany(
    { slug: entry.slug, status: "published", _id: { $ne: entry._id } },
    { status: "retired", retiredAt: new Date() }
  );
  entry.status = "published";
  entry.publishedAt = new Date();
  entry.retiredAt = undefined;
  await entry.save();
  return entry;
};

export const retireCaseVersion = async (id: string) => {
  const entry = await requireCase(id);
  if (entry.status !== "published") throw new AppError(409, "Only a published case can be retired");
  entry.status = "retired";
  entry.retiredAt = new Date();
  await entry.save();
  await CaseModel.updateMany({ slug: entry.slug, status: "published" }, { status: "retired", retiredAt: new Date() });
  return entry;
};

export const deleteCase = async (id: string) => {
  const entry = await requireCase(id);
  // Attempts carry frozen case snapshots and must remain available after deletion.
  await CaseModel.updateMany({ slug: entry.slug, deletedAt: null }, {
    $set: { deletedAt: new Date(), status: "retired", retiredAt: new Date() }
  });
};

export const getCaseVersionHistory = async (id: string) => {
  const entry = await requireCase(id);
  const [versions, reviews] = await Promise.all([
    CaseModel.find({ slug: entry.slug }).sort({ version: -1 }).lean(),
    CaseReviewModel.find({ slug: entry.slug })
      .sort({ createdAt: 1 })
      .populate("reviewerId", "email")
      .lean()
  ]);
  return {
    slug: entry.slug,
    versions: versions.map(serializeAdminCase),
    reviews: reviews.map((review: any) => ({
      id: String(review._id),
      caseVersionId: String(review.caseVersionId),
      version: review.version,
      action: review.action,
      comment: review.comment,
      reviewerId: String(review.reviewerId?._id ?? review.reviewerId),
      reviewerEmail: review.reviewerId?.email,
      createdAt: review.createdAt
    }))
  };
};
