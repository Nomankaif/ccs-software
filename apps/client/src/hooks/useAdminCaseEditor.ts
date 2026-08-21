import { useState } from "react";
import { caseDefinitionSchema, type CaseDefinitionInput } from "@ccs/validation";

const starterCase: CaseDefinitionInput = {
  slug: "new-clinical-case",
  title: "New clinical case",
  specialty: "Internal Medicine",
  difficulty: "Intermediate",
  durationMinutes: 18,
  finalOrderMinutes: 2,
  opening: "Enter a complete patient opening presentation with the reason for the encounter.",
  appearance: "The patient appears stable.",
  startingLocation: "Office",
  allowedLocations: ["Office", "Emergency Department", "Inpatient Unit", "ICU", "Home"],
  history: { "History of Present Illness": "Enter the history of present illness." },
  vitals: {
    temperature: "37.0 C",
    pulse: "80/min",
    respirations: "16/min",
    bloodPressure: "120/80 mm Hg",
    oxygenSaturation: "98% on room air"
  },
  exam: { "General Appearance": "Enter examination findings." },
  orders: [
    {
      id: "cbc",
      name: "CBC with differential",
      aliases: ["complete blood count"],
      category: "Laboratory",
      resultDelayMinutes: 30
    }
  ],
  results: [{ orderId: "cbc", category: "Lab Reports", value: "Enter the result." }],
  scoreRules: [
    {
      id: "cbc",
      label: "CBC",
      domain: "Diagnosis",
      actionType: "order",
      match: "cbc",
      points: 10,
      rationale: "Enter the rationale."
    }
  ],
  feedback: "Enter the clinician-authored feedback shown after the case."
};

const formatIssues = (issues: Array<{ path: PropertyKey[]; message: string }>) =>
  issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ");

export const useAdminCaseEditor = () => {
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [definition, setDefinition] = useState<CaseDefinitionInput>(starterCase);
  const [validationError, setValidationError] = useState("");

  const updateField = <K extends keyof CaseDefinitionInput>(
    key: K,
    value: CaseDefinitionInput[K]
  ) => setDefinition((current) => ({ ...current, [key]: value }));

  const updateJsonField = <K extends "history" | "exam" | "orders" | "results" | "scoreRules">(
    key: K,
    value: string
  ) => {
    try {
      updateField(key, JSON.parse(value));
      setValidationError("");
    } catch {
      setValidationError(`${key} must be valid JSON`);
    }
  };

  const parseImportFile = async (file: File) => {
    try {
      const value: unknown = JSON.parse(await file.text());
      const parsed = Array.isArray(value)
        ? value.map((entry) => caseDefinitionSchema.parse(entry))
        : caseDefinitionSchema.parse(value);
      setValidationError("");
      return parsed;
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Invalid JSON");
      return null;
    }
  };

  const validateDefinition = () => {
    const parsed = caseDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      setValidationError(formatIssues(parsed.error.issues));
      return null;
    }
    setValidationError("");
    return parsed.data;
  };

  return {
    isEditorOpen,
    definition,
    validationError,
    toggleEditor: () => setEditorOpen((current) => !current),
    closeEditor: () => setEditorOpen(false),
    updateField,
    updateJsonField,
    parseImportFile,
    validateDefinition
  };
};
