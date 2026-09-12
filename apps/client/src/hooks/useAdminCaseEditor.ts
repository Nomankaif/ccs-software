import { useMemo, useState } from "react";
import { caseDefinitionSchema, type CaseDefinitionInput } from "@ccs/validation";
import type { AdminCase, CatalogOrder, CaseStatus } from "../types";

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
  locationTransfers: [],
  history: { "History of Present Illness": "Enter the history of present illness." },
  vitals: {
    temperature: "37.0 C",
    pulse: "80/min",
    respirations: "16/min",
    bloodPressure: "120/80 mm Hg",
    oxygenSaturation: "98% on room air"
  },
  exam: { "General Appearance": "Enter examination findings." },
  initialClinicalStateId: "initial",
  clinicalStates: [
    {
      id: "initial",
      appearance: "The patient appears stable.",
      vitals: {
        temperature: "37.0 C",
        pulse: "80/min",
        respirations: "16/min",
        bloodPressure: "120/80 mm Hg",
        oxygenSaturation: "98% on room air"
      }
    }
  ],
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
  orderBehaviors: [
    {
      orderId: "cbc",
      classification: "neutral",
      processingMinutes: 30
    }
  ],
  transitionRules: [],
  endConditions: [],
  testScenarios: [],
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
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<CaseStatus | null>(null);
  const [validationError, setValidationError] = useState("");
  const validation = useMemo(() => caseDefinitionSchema.safeParse(definition), [definition]);
  const validationIssues = validation.success
    ? []
    : validation.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

  const updateField = <K extends keyof CaseDefinitionInput>(
    key: K,
    value: CaseDefinitionInput[K]
  ) => setDefinition((current) => ({ ...current, [key]: value }));

  const updateJsonField = <K extends "history" | "exam" | "orders" | "results" | "scoreRules" | "clinicalStates" | "orderBehaviors" | "transitionRules" | "locationTransfers" | "endConditions" | "testScenarios">(
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

  const addCatalogOrder = (order: CatalogOrder) => {
    setDefinition((current) => current.orders.some((item) => item.id === order.id)
      ? current
      : {
          ...current,
          orders: [
            ...current.orders,
            {
              id: order.id,
              name: order.name,
              aliases: order.aliases,
              category: order.category,
              route: order.route,
              dose: order.dose,
              frequency: order.frequency,
              duration: order.duration,
              priority: order.priority,
              resultDelayMinutes: order.resultDelayMinutes
            }
          ]
        });
  };

  return {
    isEditorOpen,
    definition,
    validationError,
    validationIssues,
    isDefinitionValid: validation.success,
    editingCaseId,
    editingStatus,
    toggleEditor: () => {
      if (isEditorOpen) return setEditorOpen(false);
      setDefinition(starterCase);
      setEditingCaseId(null);
      setEditingStatus(null);
      setValidationError("");
      setEditorOpen(true);
    },
    editCase: (entry: AdminCase) => {
      setDefinition(caseDefinitionSchema.parse(entry));
      setEditingCaseId(entry.id);
      setEditingStatus(entry.status);
      setValidationError("");
      setEditorOpen(true);
    },
    closeEditor: () => {
      setEditorOpen(false);
      setEditingCaseId(null);
      setEditingStatus(null);
    },
    updateField,
    updateJsonField,
    addCatalogOrder,
    parseImportFile,
    validateDefinition
  };
};
