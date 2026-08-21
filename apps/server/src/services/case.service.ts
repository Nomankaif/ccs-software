import { caseDefinitionSchema, type CaseDefinitionInput } from "@ccs/validation";
import { AppError } from "../errors/app-error.js";
import { CaseModel } from "../models/index.js";

const requireCase = async (id: string) => {
  const entry = await CaseModel.findById(id);
  if (!entry) throw new AppError(404, "Case not found");
  return entry;
};

export const listPublishedCases = async () => {
  const cases = await CaseModel.find({ status: "published" }).sort({ "definition.title": 1 }).lean();
  return cases.map((entry) => ({ id: entry._id, version: entry.version, ...entry.definition }));
};

export const getPublishedCase = async (id: string) => {
  const entry = await CaseModel.findOne({ _id: id, status: "published" }).lean();
  if (!entry) throw new AppError(404, "Case not found");
  return { id: entry._id, version: entry.version, ...entry.definition };
};

export const listAdminCases = async () => {
  const cases = await CaseModel.find().sort({ updatedAt: -1 }).lean();
  return cases.map((entry) => ({
    id: entry._id,
    version: entry.version,
    status: entry.status,
    updatedAt: entry.updatedAt,
    ...entry.definition
  }));
};

export const createCaseVersion = async (definition: CaseDefinitionInput, userId: string) => {
  const latest = await CaseModel.findOne({ slug: definition.slug }).sort({ version: -1 }).lean();
  return CaseModel.create({
    slug: definition.slug,
    version: (latest?.version ?? 0) + 1,
    definition,
    createdBy: userId
  });
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

export const publishCaseVersion = async (id: string) => {
  const entry = await requireCase(id);
  const result = caseDefinitionSchema.safeParse(entry.definition);
  if (!result.success) {
    throw new AppError(422, "Case is invalid", { issues: result.error.issues });
  }

  await CaseModel.updateMany(
    { slug: entry.slug, status: "published", _id: { $ne: entry._id } },
    { status: "retired", retiredAt: new Date() }
  );
  entry.status = "published";
  entry.publishedAt = new Date();
  await entry.save();
  return entry;
};

export const retireCaseVersion = async (id: string) => {
  const entry = await CaseModel.findByIdAndUpdate(
    id,
    { status: "retired", retiredAt: new Date() },
    { new: true }
  );
  if (!entry) throw new AppError(404, "Case not found");
  return entry;
};
