export type Role = "ADMIN" | "ASHA";
export type RecordType = "CHILD" | "PREGNANT_WOMAN";

/** The signed-in app user (admin via email login, ASHA via PIN). */
export interface User {
  id: string;
  name: string;
  role: Role;
}

/** An ASHA worker row from the `asha_workers` table. */
export interface AshaWorker {
  id: string;
  name: string;
  pin: string;
  createdAt: string;
}

export interface VaccineRecord {
  id: string;
  ashaId: string;
  ashaName: string;
  recordType: RecordType;
  patientName: string;
  referenceDate: string; // DOB for child, LMP for woman (YYYY-MM-DD)
  sessionDate: string; // YYYY-MM-DD
  vaccines: string[];
  remark: string;
  createdAt: string;
}

export const CHILD_VACCINES = [
  "BCG",
  "OPV-0",
  "Hep-B (Birth Dose)",
  "OPV-1",
  "Penta-1",
  "Rota-1",
  "fIPV-1",
  "PCV-1",
  "OPV-2",
  "Penta-2",
  "Rota-2",
  "OPV-3",
  "Penta-3",
  "Rota-3",
  "fIPV-2",
  "PCV-2",
  "MR-1",
  "JE-1",
  "PCV Booster",
  "DPT Booster-1",
  "OPV Booster",
  "MR-2",
  "JE-2",
  "DPT Booster-2",
  "Td (10 वर्षे)",
  "Td (16 वर्षे)",
];

export const MOTHER_VACCINES = ["Td-1", "Td-2", "Td-Booster"];
