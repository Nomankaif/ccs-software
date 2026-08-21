import type { CaseDefinitionInput } from "@ccs/validation";

export const demoCase: CaseDefinitionInput = {
  slug: "acute-chest-pain", title: "Acute chest discomfort", specialty: "Cardiovascular", difficulty: "Intermediate",
  durationMinutes: 18, finalOrderMinutes: 2,
  opening: "A 58-year-old man comes to the emergency department because of pressure-like chest discomfort and nausea that began 45 minutes ago.",
  appearance: "The patient appears anxious and diaphoretic.", startingLocation: "Emergency Department",
  allowedLocations: ["Emergency Department", "Inpatient Unit", "ICU", "Home"],
  history: {
    "History of Present Illness": "Pressure-like substernal discomfort began at rest 45 minutes ago and radiates to the left arm. Pain is 8/10. He reports nausea and sweating.",
    "Past Medical History": "Hypertension and hyperlipidemia. No prior surgery or hospitalizations.", Medications: "Lisinopril and atorvastatin.",
    Allergies: "No known drug allergies.", "Family History": "Father died of myocardial infarction at age 62.",
    "Personal/Social History": "Smokes one pack daily for 30 years. Drinks alcohol occasionally.",
    "Review of Systems": "No fever, cough, pleuritic pain, recent travel, or leg swelling."
  },
  vitals: { temperature: "37.0 C", pulse: "104/min", respirations: "20/min", bloodPressure: "158/94 mm Hg", oxygenSaturation: "95% on room air" },
  exam: {
    "General Appearance": "Anxious, pale, and diaphoretic.", "HEENT/Neck": "No jugular venous distention. Mucous membranes moist.",
    "Heart/Cardiovascular": "Tachycardic, regular rhythm; no murmurs, rubs, or gallops.", "Chest/Lungs": "Clear to auscultation bilaterally.",
    Abdomen: "Soft and nontender. Normal bowel sounds.", "Extremities/Spine": "No edema or calf tenderness. Peripheral pulses are symmetric.",
    "Neuro/Psych": "Alert and oriented; no focal deficit.", Skin: "Cool and diaphoretic."
  },
  orders: [
    { id: "ecg", name: "Electrocardiogram, 12-lead", aliases: ["ecg", "ekg"], category: "Other Tests", resultDelayMinutes: 5 },
    { id: "troponin", name: "Troponin I", aliases: ["cardiac enzyme"], category: "Laboratory", resultDelayMinutes: 20 },
    { id: "cbc", name: "CBC with differential", aliases: ["complete blood count"], category: "Laboratory", resultDelayMinutes: 30 },
    { id: "cmp", name: "Comprehensive metabolic panel", aliases: ["chemistry", "cmp"], category: "Laboratory", resultDelayMinutes: 35 },
    { id: "cxr", name: "Chest x-ray", aliases: ["radiograph", "cxr"], category: "Imaging", resultDelayMinutes: 15 },
    { id: "aspirin", name: "Aspirin", aliases: ["asa"], category: "Medication", route: ["PO", "PR"], frequency: ["One time/bolus", "Daily"] },
    { id: "nitro", name: "Nitroglycerin", aliases: ["ntg"], category: "Medication", route: ["SL", "IV"], frequency: ["Every 5 minutes", "Continuous"] },
    { id: "oxygen", name: "Oxygen", aliases: ["o2"], category: "Medication", route: ["Nasal cannula", "Face mask"], frequency: ["Continuous"] },
    { id: "monitor", name: "Cardiac monitor", aliases: ["telemetry"], category: "Monitoring" },
    { id: "pulseox", name: "Pulse oximetry", aliases: ["spo2"], category: "Monitoring" },
    { id: "iv", name: "IV access", aliases: ["intravenous access"], category: "Procedure" },
    { id: "cardiology", name: "Consult, cardiology", aliases: ["cardiologist"], category: "Consultation", resultDelayMinutes: 30 },
    { id: "stress", name: "Exercise stress test", aliases: ["treadmill"], category: "Other Tests", resultDelayMinutes: 60 },
    { id: "smoking", name: "Counseling, smoking cessation", aliases: ["tobacco"], category: "Counseling" }
  ],
  results: [
    { orderId: "ecg", category: "Other Tests", value: "Sinus tachycardia. ST-segment elevations in leads II, III, and aVF." },
    { orderId: "troponin", category: "Lab Reports", value: "Troponin I: 2.8 ng/mL (elevated)" },
    { orderId: "cbc", category: "Lab Reports", value: "WBC 10,800/mm3; hemoglobin 14.2 g/dL; platelets 244,000/mm3" },
    { orderId: "cmp", category: "Lab Reports", value: "Electrolytes, glucose, renal function, and hepatic tests are within reference ranges." },
    { orderId: "cxr", category: "Imaging", value: "No acute cardiopulmonary abnormality." },
    { orderId: "cardiology", category: "Other Tests", value: "Consultant agrees with urgent invasive management for acute inferior STEMI." },
    { orderId: "stress", category: "Other Tests", value: "Test deferred because of ongoing acute chest discomfort." }
  ],
  scoreRules: [
    { id: "exam", label: "Targeted physical examination", domain: "Diagnosis", actionType: "exam", match: "Heart/Cardiovascular", points: 15, rationale: "Targeted examination supports diagnosis." },
    { id: "ecg", label: "Electrocardiogram", domain: "Diagnosis", actionType: "order", match: "ecg", points: 15, rationale: "Urgent ECG identifies STEMI." },
    { id: "monitor", label: "Cardiac monitoring", domain: "Monitoring", actionType: "order", match: "monitor", points: 10, rationale: "Continuous monitoring detects instability." },
    { id: "aspirin", label: "Aspirin", domain: "Therapy", actionType: "order", match: "aspirin", points: 15, rationale: "Antiplatelet therapy is time-sensitive." },
    { id: "troponin", label: "Troponin", domain: "Diagnosis", actionType: "order", match: "troponin", points: 15, rationale: "Biomarkers support diagnosis." },
    { id: "cxr", label: "Chest radiograph", domain: "Diagnosis", actionType: "order", match: "cxr", points: 10, rationale: "Imaging evaluates alternate causes." },
    { id: "cardiology", label: "Cardiology consultation", domain: "Therapy", actionType: "order", match: "cardiology", points: 10, rationale: "Urgent specialty management is appropriate." },
    { id: "location", label: "Appropriate disposition", domain: "Location", actionType: "location", match: "Inpatient Unit", points: 10, rationale: "The patient requires admission." },
    { id: "harm-stress", label: "Premature stress testing", domain: "Timing & sequence", actionType: "order", match: "stress", points: -10, rationale: "Stress testing is unsafe before acute coronary syndrome is excluded." }
  ],
  feedback: "Early evaluation, monitoring, antiplatelet therapy, cardiac biomarkers, and an appropriate level of care are central to this presentation."
};
