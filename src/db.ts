import { supabase } from "./supabase";
import type { AshaWorker, RecordType, VaccineRecord } from "./types";

/* ------------------------------------------------------------------ */
/* Raw Supabase row shapes (snake_case, as stored in Postgres)         */
/* ------------------------------------------------------------------ */

interface WorkerRow {
  id: string;
  name: string;
  pin: string;
  created_at: string;
}

interface RecordRow {
  id: string;
  asha_id: string;
  asha_name: string;
  record_type: string;
  patient_name: string;
  reference_date: string | null;
  session_date: string | null;
  vaccines: string[] | null;
  remark: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Mappers: DB row <-> app model                                       */
/* ------------------------------------------------------------------ */

function workerFromRow(r: WorkerRow): AshaWorker {
  return { id: r.id, name: r.name, pin: r.pin, createdAt: r.created_at };
}

function recordFromRow(r: RecordRow): VaccineRecord {
  return {
    id: r.id,
    ashaId: r.asha_id,
    ashaName: r.asha_name,
    recordType: (r.record_type === "PREGNANT_WOMAN" ? "PREGNANT_WOMAN" : "CHILD") as RecordType,
    patientName: r.patient_name ?? "",
    referenceDate: r.reference_date ?? "",
    sessionDate: r.session_date ?? "",
    vaccines: r.vaccines ?? [],
    remark: r.remark ?? "",
    createdAt: r.created_at,
  };
}

export interface NewRecordInput {
  ashaId: string;
  ashaName: string;
  recordType: RecordType;
  patientName: string;
  referenceDate: string;
  sessionDate: string;
  vaccines: string[];
  remark: string;
}

/* ------------------------------------------------------------------ */
/* ASHA workers                                                        */
/* ------------------------------------------------------------------ */

export async function fetchWorkers(): Promise<AshaWorker[]> {
  const { data, error } = await supabase
    .from("asha_workers")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as WorkerRow[]).map(workerFromRow);
}

export async function addWorker(name: string, pin: string): Promise<AshaWorker> {
  const { data, error } = await supabase
    .from("asha_workers")
    .insert({ name: name.trim(), pin })
    .select()
    .single();
  if (error) throw error;
  return workerFromRow(data as WorkerRow);
}

export async function updateWorkerPin(id: string, pin: string): Promise<void> {
  const { error } = await supabase.from("asha_workers").update({ pin }).eq("id", id);
  if (error) throw error;
}

export async function deleteWorker(id: string): Promise<void> {
  const { error } = await supabase.from("asha_workers").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Vaccination records                                                 */
/* ------------------------------------------------------------------ */

export async function fetchRecords(ashaName?: string): Promise<VaccineRecord[]> {
  let q = supabase
    .from("vaccine_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (ashaName) q = q.eq("asha_name", ashaName);
  const { data, error } = await q;
  if (error) throw error;
  return (data as RecordRow[]).map(recordFromRow);
}

export async function createRecord(input: NewRecordInput): Promise<VaccineRecord> {
  const { data, error } = await supabase
    .from("vaccine_records")
    .insert({
      asha_id: input.ashaId,
      asha_name: input.ashaName,
      record_type: input.recordType,
      patient_name: input.patientName,
      reference_date: input.referenceDate || null,
      session_date: input.sessionDate || null,
      vaccines: input.vaccines,
      remark: input.remark || "",
    })
    .select()
    .single();
  if (error) throw error;
  return recordFromRow(data as RecordRow);
}

export async function updateRecord(
  id: string,
  input: Partial<NewRecordInput>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (input.patientName !== undefined) payload.patient_name = input.patientName;
  if (input.referenceDate !== undefined) payload.reference_date = input.referenceDate || null;
  if (input.sessionDate !== undefined) payload.session_date = input.sessionDate || null;
  if (input.vaccines !== undefined) payload.vaccines = input.vaccines;
  if (input.remark !== undefined) payload.remark = input.remark || "";
  if (input.recordType !== undefined) payload.record_type = input.recordType;
  const { error } = await supabase.from("vaccine_records").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from("vaccine_records").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Realtime subscription helper                                        */
/* ------------------------------------------------------------------ */

export function subscribeToRecords(onChange: () => void) {
  const channel = supabase
    .channel("vaccine-records-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "vaccine_records" },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToWorkers(onChange: () => void) {
  const channel = supabase
    .channel("asha-workers-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "asha_workers" },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/* ------------------------------------------------------------------ */
/* App settings (PHC / sub-center names)                               */
/* ------------------------------------------------------------------ */

export interface AppSettings {
  phcName: string;
  subcenterName: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  phcName: "देहरे",
  subcenterName: "वडगाव गुप्ता",
};

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw error;
  const map = new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return {
    phcName: map.get("phc_name")?.trim() || DEFAULT_SETTINGS.phcName,
    subcenterName: map.get("subcenter_name")?.trim() || DEFAULT_SETTINGS.subcenterName,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const rows = [
    { key: "phc_name", value: s.phcName.trim(), updated_at: new Date().toISOString() },
    { key: "subcenter_name", value: s.subcenterName.trim(), updated_at: new Date().toISOString() },
  ];
  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}
