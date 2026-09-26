import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Baby,
  BarChart3,
  ClipboardList,
  Edit2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  KeyRound,
  List,
  Plus,
  Save,
  Search,
  Settings as SettingsIcon,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AshaWorker, RecordType, VaccineRecord } from "../types";
import { CHILD_VACCINES, MOTHER_VACCINES } from "../types";
import { formatDateMR, formatMonthMR, friendlyDbError } from "../utils";
import { saveBlob } from "../native";
import {
  addWorker,
  deleteRecord,
  deleteWorker,
  fetchRecords,
  fetchWorkers,
  saveSettings,
  subscribeToRecords,
  subscribeToWorkers,
  updateRecord,
  updateWorkerPin,
} from "../db";
import type { AppSettings } from "../db";
import { useToast } from "./Toast";
import {
  AnimatedTabs,
  Card,
  ConfirmDialog,
  Field,
  InboxEmpty,
  ListSkeleton,
  Modal,
  StatCard,
  VaccineChips,
  inputCls,
  listContainer,
  listItem,
} from "./ui";

type AdminTab = "LINE_LIST" | "ABSTRACT" | "ASHA_REPORT" | "WORKERS" | "SETTINGS";

export function AdminDashboard({
  settings,
  onSettingsSaved,
}: {
  settings: AppSettings;
  onSettingsSaved: (s: AppSettings) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>("LINE_LIST");
  const [records, setRecords] = useState<VaccineRecord[]>([]);
  const [workers, setWorkers] = useState<AshaWorker[]>([]);
  const [loading, setLoading] = useState(true);

  // Line list state
  const [search, setSearch] = useState("");

  // Report state
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedAsha, setSelectedAsha] = useState("");

  // Record edit state
  const [editing, setEditing] = useState<VaccineRecord | null>(null);
  const [editForm, setEditForm] = useState({
    patientName: "",
    referenceDate: "",
    sessionDate: "",
    vaccines: [] as string[],
    remark: "",
  });
  const [editBusy, setEditBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setRecords(await fetchRecords());
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadWorkers = useCallback(async () => {
    try {
      setWorkers(await fetchWorkers());
    } catch (e) {
      toast(friendlyDbError(e), "error");
    }
  }, [toast]);

  useEffect(() => {
    loadRecords();
    loadWorkers();
  }, [loadRecords, loadWorkers]);

  useEffect(() => subscribeToRecords(loadRecords), [loadRecords]);
  useEffect(() => subscribeToWorkers(loadWorkers), [loadWorkers]);

  /* ---------------- derived data ---------------- */

  const stats = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: records.length,
      workers: workers.length,
      thisMonth: records.filter((r) => (r.sessionDate || "").startsWith(month)).length,
      doses: records.reduce((s, r) => s + (r.vaccines?.length ?? 0), 0),
    };
  }, [records, workers]);

  const monthlyRecords = useMemo(
    () => records.filter((r) => (r.sessionDate || r.createdAt || "").startsWith(reportMonth)),
    [records, reportMonth]
  );

  const reportRecords = useMemo(
    () =>
      tab === "ASHA_REPORT" && selectedAsha
        ? monthlyRecords.filter((r) => r.ashaName === selectedAsha)
        : monthlyRecords,
    [monthlyRecords, tab, selectedAsha]
  );

  const abstractData = useMemo(() => {
    const counts: Record<string, number> = {};
    [...CHILD_VACCINES, ...MOTHER_VACCINES].forEach((v) => (counts[v] = 0));
    reportRecords.forEach((r) =>
      (r.vaccines || []).forEach((v) => {
        if (counts[v] !== undefined) counts[v] += 1;
      })
    );
    return counts;
  }, [reportRecords]);

  const filteredLineList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.ashaName.toLowerCase().includes(q) ||
        (r.vaccines || []).some((v) => v.toLowerCase().includes(q))
    );
  }, [records, search]);

  /* ---------------- exports ---------------- */

  const exportLineListExcel = async () => {
    if (filteredLineList.length === 0) return toast("निर्यात करण्यासाठी माहिती नाही.", "error");
    const data = filteredLineList.map((r, i) => ({
      "अ. क्र.": i + 1,
      प्रकार: r.recordType === "PREGNANT_WOMAN" ? "गरोदर माता" : "बालक",
      "आशा सेविकेचे नाव": r.ashaName,
      "लाभार्थ्याचे नाव": r.patientName,
      "संदर्भ तारीख (DOB/LMP)": formatDateMR(r.referenceDate),
      "सत्र तारीख": formatDateMR(r.sessionDate),
      "लसींची नावे": (r.vaccines || []).join(", "),
      शेरा: r.remark || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 40 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ड्यू लिस्ट");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    await saveBlob(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `vaccination-list-${reportMonth}.xlsx`
    );
    toast("Excel फाईल डाउनलोड झाली!", "success");
  };

  const exportLineListPDF = async () => {
    if (filteredLineList.length === 0) return toast("निर्यात करण्यासाठी माहिती नाही.", "error");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Vaccination Due List`, 14, 14);
    doc.setFontSize(10);
    doc.text(`PHC ${settings.phcName} | Upkendra ${settings.subcenterName}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Sr.", "Type", "ASHA Name", "Patient Name", "Ref Date", "Session", "Vaccines", "Remark"]],
      body: filteredLineList.map((r, i) => [
        i + 1,
        r.recordType === "PREGNANT_WOMAN" ? "Mother" : "Child",
        r.ashaName,
        r.patientName,
        formatDateMR(r.referenceDate),
        formatDateMR(r.sessionDate),
        (r.vaccines || []).join(", "),
        r.remark || "",
      ]),
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 78, 59] },
    });
    await saveBlob(doc.output("blob"), `vaccination-list-${reportMonth}.pdf`);
    toast("PDF फाईल डाउनलोड झाली!", "success");
  };

  const exportAbstractExcel = async () => {
    const data = Object.entries(abstractData)
      .filter(([, c]) => c > 0)
      .map(([vaccine, count]) => ({ "लसीचे नाव": vaccine, "एकूण डोस": count }));
    if (data.length === 0) return toast("निर्यात करण्यासाठी माहिती नाही.", "error");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Abstract");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    await saveBlob(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `vaccination-abstract-${reportMonth}.xlsx`
    );
    toast("Excel फाईल डाउनलोड झाली!", "success");
  };

  const exportAbstractPDF = async () => {
    const rows = Object.entries(abstractData).filter(([, c]) => c > 0);
    if (rows.length === 0) return toast("निर्यात करण्यासाठी माहिती नाही.", "error");
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Vaccination Abstract - ${reportMonth}${selectedAsha ? ` (${selectedAsha})` : ""}`, 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [["Vaccine Name", "Total Doses"]],
      body: rows.map(([v, c]) => [v, c]),
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
    });
    await saveBlob(doc.output("blob"), `vaccination-abstract-${reportMonth}.pdf`);
    toast("PDF फाईल डाउनलोड झाली!", "success");
  };

  /* ---------------- record edit / delete ---------------- */

  const openEdit = (r: VaccineRecord) => {
    setEditing(r);
    setEditForm({
      patientName: r.patientName,
      referenceDate: r.referenceDate,
      sessionDate: r.sessionDate,
      vaccines: r.vaccines,
      remark: r.remark,
    });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    try {
      await updateRecord(editing.id, {
        patientName: editForm.patientName.trim(),
        referenceDate: editForm.referenceDate,
        sessionDate: editForm.sessionDate,
        vaccines: editForm.vaccines,
        remark: editForm.remark.trim(),
      });
      toast("नोंद अपडेट झाली!", "success");
      setEditing(null);
      loadRecords();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDeleteRecord = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    try {
      await deleteRecord(deleteId);
      toast("नोंद हटवली.", "info");
      setDeleteId(null);
      loadRecords();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleEditVaccine = (v: string) =>
    setEditForm((p) => ({
      ...p,
      vaccines: p.vaccines.includes(v) ? p.vaccines.filter((x) => x !== v) : [...p.vaccines, v],
    }));

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ClipboardList size={20} /></span>}
          label="एकूण नोंदी"
          value={stats.total}
          accent="bg-emerald-500"
        />
        <StatCard
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Users size={20} /></span>}
          label="आशा सेविका"
          value={stats.workers}
          accent="bg-sky-500"
          delay={0.06}
        />
        <StatCard
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><BarChart3 size={20} /></span>}
          label="या महिन्यातील नोंदी"
          value={stats.thisMonth}
          accent="bg-amber-400"
          delay={0.12}
        />
        <StatCard
          icon={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100 text-pink-700"><HeartPulse size={20} /></span>}
          label="एकूण लस डोस"
          value={stats.doses}
          accent="bg-pink-500"
          delay={0.18}
        />
      </div>

      <Card>
        {/* Tabs */}
        <div className="border-b border-slate-100 p-3 sm:p-4">
          <AnimatedTabs<AdminTab>
            namespace="admin-tabs"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "LINE_LIST", label: "लाईन लिस्ट", icon: <List size={16} /> },
              { id: "ABSTRACT", label: "मासिक ॲबस्ट्रॅक्ट", icon: <BarChart3 size={16} /> },
              { id: "ASHA_REPORT", label: "आशा अहवाल", icon: <Users size={16} /> },
              { id: "WORKERS", label: "आशा व्यवस्थापन", icon: <UserPlus size={16} /> },
              { id: "SETTINGS", label: "सेटिंग्ज", icon: <SettingsIcon size={16} /> },
            ]}
            className="flex-wrap"
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            {tab === "LINE_LIST" && (
              <LineListPanel
                loading={loading}
                records={filteredLineList}
                search={search}
                setSearch={setSearch}
                onEdit={openEdit}
                onDelete={setDeleteId}
                onExcel={exportLineListExcel}
                onPDF={exportLineListPDF}
              />
            )}
            {(tab === "ABSTRACT" || tab === "ASHA_REPORT") && (
              <ReportPanel
                month={reportMonth}
                setMonth={setReportMonth}
                showAshaFilter={tab === "ASHA_REPORT"}
                workers={workers}
                selectedAsha={selectedAsha}
                setSelectedAsha={setSelectedAsha}
                abstractData={abstractData}
                hasData={Object.values(abstractData).some((c) => c > 0)}
                onExcel={exportAbstractExcel}
                onPDF={exportAbstractPDF}
              />
            )}
            {tab === "WORKERS" && (
              <WorkersPanel
                workers={workers}
                records={records}
                reload={async () => {
                  await loadWorkers();
                  loadRecords();
                }}
              />
            )}
            {tab === "SETTINGS" && (
              <SettingsPanel
                settings={settings}
                onSaved={onSettingsSaved}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Edit record modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)}>
        <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/60 p-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
            <Edit2 size={18} className="text-emerald-700" />
            नोंद अपडेट करा (प्रशासक)
          </h2>
          <button
            onClick={() => setEditing(null)}
            className="rounded-full bg-white p-1.5 text-slate-400 shadow-sm transition hover:text-slate-600"
            aria-label="बंद करा"
          >
            <X size={18} />
          </button>
        </div>
        {editing && (
          <form onSubmit={submitEdit} className="space-y-4 p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="लाभार्थ्याचे नाव" required>
                <input
                  type="text"
                  value={editForm.patientName}
                  onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="तारीख (DOB/LMP)" required>
                <input
                  type="date"
                  value={editForm.referenceDate}
                  onChange={(e) => setEditForm({ ...editForm, referenceDate: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
            </div>
            <Field label="सत्र तारीख">
              <input
                type="date"
                value={editForm.sessionDate}
                onChange={(e) => setEditForm({ ...editForm, sessionDate: e.target.value })}
                className={`${inputCls} md:w-1/2`}
              />
            </Field>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">
                लसी ({editing.recordType === "CHILD" ? "बालक" : "गरोदर माता"})
              </label>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                {(editing.recordType === "CHILD" ? CHILD_VACCINES : MOTHER_VACCINES).map((v) => {
                  const on = editForm.vaccines.includes(v);
                  return (
                    <motion.button
                      key={v}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleEditVaccine(v)}
                      className={`rounded-full px-3 py-1.5 text-[13px] font-bold ring-1 transition ${
                        on
                          ? "bg-emerald-700 text-white ring-emerald-700 shadow-md"
                          : "bg-white text-slate-600 ring-slate-300 hover:ring-emerald-400"
                      }`}
                    >
                      {v}
                    </motion.button>
                  );
                })}
              </div>
            </div>
            <Field label="शेरा">
              <input
                type="text"
                value={editForm.remark}
                onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95"
              >
                रद्द करा
              </button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={editBusy}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-700/30 transition hover:bg-emerald-800 disabled:opacity-50"
              >
                <Save size={16} />
                {editBusy ? "सेव्ह होत आहे..." : "सेव्ह करा"}
              </motion.button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="नोंद हटवायची का?"
        message="ही नोंद कायमची हटवली जाईल."
        confirmLabel="होय, हटवा"
        busy={deleteBusy}
        onConfirm={confirmDeleteRecord}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Line list panel                                                     */
/* ------------------------------------------------------------------ */

function LineListPanel({
  loading,
  records,
  search,
  setSearch,
  onEdit,
  onDelete,
  onExcel,
  onPDF,
}: {
  loading: boolean;
  records: VaccineRecord[];
  search: string;
  setSearch: (s: string) => void;
  onEdit: (r: VaccineRecord) => void;
  onDelete: (id: string) => void;
  onExcel: () => void;
  onPDF: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="नाव, आशा किंवा लसीनुसार शोधा..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm font-medium outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
          />
        </div>
        <div className="flex gap-2">
          <ExportButton color="green" icon={<FileSpreadsheet size={16} />} label="Excel" onClick={onExcel} />
          <ExportButton color="red" icon={<FileText size={16} />} label="PDF" onClick={onPDF} />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : records.length === 0 ? (
          <InboxEmpty title="कोणत्याही नोंदी आढळल्या नाहीत" subtitle="शोध बदला किंवा नंतर पुन्हा तपासा." />
        ) : (
          <>
            <motion.div variants={listContainer} initial="hidden" animate="show" className="space-y-3 md:hidden">
              <AnimatePresence initial={false}>
                {records.map((r) => (
                  <motion.div
                    key={r.id}
                    variants={listItem}
                    exit="exit"
                    layout
                    className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <TypeBadge type={r.recordType} />
                        <h4 className="mt-1.5 text-base font-extrabold text-slate-800">{r.patientName}</h4>
                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                          आशा: <span className="font-bold text-slate-700">{r.ashaName}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">DOB/LMP</p>
                        <p className="mt-0.5 text-xs font-bold text-slate-700">{formatDateMR(r.referenceDate)}</p>
                        <p className="mt-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">सत्र</p>
                        <p className="text-xs font-bold text-slate-700">{formatDateMR(r.sessionDate)}</p>
                      </div>
                    </div>
                    <VaccineChips vaccines={r.vaccines} />
                    {r.remark && (
                      <p className="rounded-xl border border-amber-200/70 bg-amber-50 p-2.5 text-xs text-slate-600">
                        <span className="font-bold">शेरा:</span> {r.remark}
                      </p>
                    )}
                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-2.5">
                      <RowAction edit onClick={() => onEdit(r)} />
                      <RowAction onClick={() => onDelete(r.id)} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-sm text-slate-500">
                    <th className="px-4 py-3 font-bold">प्रकार</th>
                    <th className="px-4 py-3 font-bold">आशा सेविका</th>
                    <th className="px-4 py-3 font-bold">लाभार्थी</th>
                    <th className="px-4 py-3 font-bold">DOB/LMP</th>
                    <th className="px-4 py-3 font-bold">सत्र</th>
                    <th className="px-4 py-3 font-bold">लस</th>
                    <th className="px-4 py-3 text-right font-bold">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  <AnimatePresence initial={false}>
                    {records.map((r) => (
                      <motion.tr
                        key={r.id}
                        variants={listItem}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="transition-colors hover:bg-emerald-50/50"
                      >
                        <td className="px-4 py-3"><TypeBadge type={r.recordType} /></td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{r.ashaName}</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{r.patientName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateMR(r.referenceDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateMR(r.sessionDate)}</td>
                        <td className="max-w-[220px] px-4 py-3"><VaccineChips vaccines={r.vaccines} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <RowAction edit onClick={() => onEdit(r)} />
                            <RowAction onClick={() => onDelete(r.id)} />
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: RecordType }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ring-1 ${
        type === "PREGNANT_WOMAN"
          ? "bg-pink-100 text-pink-700 ring-pink-200"
          : "bg-sky-100 text-sky-700 ring-sky-200"
      }`}
    >
      {type === "PREGNANT_WOMAN" ? "गरोदर माता" : "बालक"}
    </span>
  );
}

function RowAction({ edit, onClick }: { edit?: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      title={edit ? "बदला" : "हटवा"}
      className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold ring-1 transition ${
        edit
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
          : "bg-red-50 text-red-600 ring-red-200 hover:bg-red-100"
      }`}
    >
      {edit ? <Edit2 size={13} /> : <Trash2 size={13} />}
      {edit ? "बदला" : "हटवा"}
    </motion.button>
  );
}

function ExportButton({
  color,
  icon,
  label,
  onClick,
}: {
  color: "green" | "red";
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white shadow-lg transition ${
        color === "green"
          ? "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-700"
          : "bg-red-600 shadow-red-600/30 hover:bg-red-700"
      }`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Report panel (abstract + asha-wise)                                 */
/* ------------------------------------------------------------------ */

function ReportPanel({
  month,
  setMonth,
  showAshaFilter,
  workers,
  selectedAsha,
  setSelectedAsha,
  abstractData,
  hasData,
  onExcel,
  onPDF,
}: {
  month: string;
  setMonth: (m: string) => void;
  showAshaFilter: boolean;
  workers: AshaWorker[];
  selectedAsha: string;
  setSelectedAsha: (s: string) => void;
  abstractData: Record<string, number>;
  hasData: boolean;
  onExcel: () => void;
  onPDF: () => void;
}) {
  const childData = CHILD_VACCINES.map((v) => ({ name: v, count: abstractData[v] ?? 0 }));
  const motherData = MOTHER_VACCINES.map((v) => ({ name: v, count: abstractData[v] ?? 0 }));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 bg-emerald-50/50 p-4">
        <div>
          <label className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
            महिना निवडा
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-emerald-900 outline-none focus:border-emerald-600"
          />
        </div>
        {showAshaFilter && (
          <div>
            <label className="mb-1 block text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
              आशा निवडा
            </label>
            <select
              value={selectedAsha}
              onChange={(e) => setSelectedAsha(e.target.value)}
              className="min-w-[170px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-emerald-900 outline-none focus:border-emerald-600"
            >
              <option value="">-- सर्व आशा --</option>
              {workers.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <ExportButton color="green" icon={<FileSpreadsheet size={16} />} label="Excel" onClick={onExcel} />
          <ExportButton color="red" icon={<FileText size={16} />} label="PDF" onClick={onPDF} />
        </div>
      </div>

      <div className="bg-slate-50/70 p-4 sm:p-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-extrabold text-slate-800 sm:text-xl">
            <BarChart3 size={22} className="text-emerald-700" />
            मासिक ॲबस्ट्रॅक्ट — {formatMonthMR(month)}
            {showAshaFilter && selectedAsha && (
              <span className="text-sm font-bold text-slate-400">({selectedAsha})</span>
            )}
          </h3>

          {!hasData ? (
            <InboxEmpty
              title="या महिन्यात कोणतीही लस नोंदवली नाही"
              subtitle="महिना बदला किंवा नोंदी तपासा."
            />
          ) : (
            <div className="space-y-10">
              <ChartBlock
                title="बालकांचे लसीकरण"
                icon={<Baby size={18} className="text-sky-600" />}
                data={childData}
                barColor="#059669"
              />
              <ChartBlock
                title="गरोदर मातांचे लसीकरण"
                icon={<HeartPulse size={18} className="text-pink-600" />}
                data={motherData}
                barColor="#ec4899"
              />
              <div className="border-t border-slate-200 pt-6">
                <h4 className="mb-4 text-base font-extrabold text-slate-700">
                  सविस्तर आकडेवारी
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Object.entries(abstractData).map(([vaccine, count], i) => (
                    <motion.div
                      key={vaccine}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      className={`rounded-xl border p-3 text-center ${
                        count > 0
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p className="mb-1 text-[11px] leading-tight font-bold text-slate-600">{vaccine}</p>
                      <p className={`text-xl font-extrabold ${count > 0 ? "text-emerald-700" : "text-slate-300"}`}>
                        {count}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartBlock({
  title,
  icon,
  data,
  barColor,
}: {
  title: string;
  icon: React.ReactNode;
  data: { name: string; count: number }[];
  barColor: string;
}) {
  return (
    <div>
      <h4 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 text-base font-extrabold text-slate-700">
        {icon}
        {title}
      </h4>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
              height={60}
              interval={0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip
              cursor={{ fill: "#ecfdf5" }}
              contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(2,44,34,.12)" }}
            />
            <Bar dataKey="count" fill={barColor} radius={[6, 6, 0, 0]} name="एकूण डोस" maxBarSize={42} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workers management panel (add / remove ASHA)                        */
/* ------------------------------------------------------------------ */

function WorkersPanel({
  workers,
  records,
  reload,
}: {
  workers: AshaWorker[];
  records: VaccineRecord[];
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AshaWorker | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pinEditId, setPinEditId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    records.forEach((r) => m.set(r.ashaName, (m.get(r.ashaName) ?? 0) + 1));
    return m;
  }, [records]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast("आशा सेविकेचे नाव टाका.", "error");
    if (!/^\d{4}$/.test(pin)) return toast("४ अंकी पिन टाका (फक्त अंक).", "error");
    setAdding(true);
    try {
      await addWorker(name.trim(), pin);
      toast(`"${name.trim()}" यांना जोडले!`, "success");
      setName("");
      setPin("");
      await reload();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setAdding(false);
    }
  };

  const confirmDeleteWorker = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteWorker(deleteTarget.id);
      toast(`"${deleteTarget.name}" यांना काढून टाकले.`, "info");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const submitPinChange = async (w: AshaWorker) => {
    if (!/^\d{4}$/.test(newPin)) return toast("४ अंकी पिन टाका (फक्त अंक).", "error");
    setPinBusy(true);
    try {
      await updateWorkerPin(w.id, newPin);
      toast("पिन अपडेट झाला!", "success");
      setPinEditId(null);
      setNewPin("");
      await reload();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setPinBusy(false);
    }
  };

  const toggleReveal = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="p-4 sm:p-6">
      {/* Add form */}
      <motion.form
        onSubmit={handleAdd}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 sm:p-5"
      >
        <h3 className="mb-4 flex items-center gap-2 text-base font-extrabold text-emerald-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-md">
            <UserPlus size={18} />
          </span>
          नवीन आशा सेविका जोडा
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto]">
          <Field label="संपूर्ण नाव" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="उदा. सुनिता अनिल पाटील"
              className={inputCls}
            />
          </Field>
          <Field label="४ अंकी पिन" required>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className={`${inputCls} text-center text-lg font-extrabold tracking-[0.4em]`}
            />
          </Field>
          <div className="flex items-end">
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              disabled={adding}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 font-extrabold text-white shadow-lg shadow-emerald-700/30 transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
            >
              <Plus size={18} />
              {adding ? "जोडत आहे..." : "जोडा"}
            </motion.button>
          </div>
        </div>
      </motion.form>

      {/* Worker list */}
      <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-700">
        <Users size={18} className="text-emerald-700" />
        नोंदवलेल्या आशा सेविका
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800">
          {workers.length}
        </span>
      </h3>

      {workers.length === 0 ? (
        <InboxEmpty title="अद्याप कोणीही नोंदवले नाही" subtitle="वरच्या फॉर्ममधून पहिल्या आशा सेविकेला जोडा." />
      ) : (
        <motion.div variants={listContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {workers.map((w) => {
              const recCount = counts.get(w.name) ?? 0;
              const isRevealed = revealed.has(w.id);
              const editingPin = pinEditId === w.id;
              return (
                <motion.div
                  key={w.id}
                  variants={listItem}
                  exit="exit"
                  layout
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-lg font-extrabold text-white shadow-md">
                        {w.name.trim().charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-slate-800">{w.name}</p>
                        <p className="text-xs font-semibold text-slate-400">
                          नोंदी: <span className="font-extrabold text-emerald-700">{recCount}</span>
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setDeleteTarget(w)}
                      title="काढून टाका"
                      className="rounded-xl bg-red-50 p-2 text-red-500 ring-1 ring-red-200 transition hover:bg-red-100 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/60">
                    <KeyRound size={15} className="shrink-0 text-slate-400" />
                    {editingPin ? (
                      <>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          autoFocus
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                          placeholder="नवीन पिन"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-extrabold tracking-[0.3em] outline-none focus:border-emerald-600"
                        />
                        <button
                          onClick={() => submitPinChange(w)}
                          disabled={pinBusy}
                          className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {pinBusy ? "..." : "सेव्ह"}
                        </button>
                        <button
                          onClick={() => {
                            setPinEditId(null);
                            setNewPin("");
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          रद्द
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-extrabold tracking-[0.35em] text-slate-600">
                          {isRevealed ? w.pin : "••••"}
                        </span>
                        <button
                          onClick={() => toggleReveal(w.id)}
                          className="text-slate-400 transition hover:text-slate-600"
                          title={isRevealed ? "लपवा" : "दाखवा"}
                        >
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button
                          onClick={() => {
                            setPinEditId(w.id);
                            setNewPin("");
                          }}
                          className="ml-auto text-xs font-extrabold text-emerald-700 transition hover:text-emerald-900"
                        >
                          पिन बदला
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="आशा सेविका काढून टाकायची का?"
        message={`"${deleteTarget?.name}" यांचे लॉगिन बंद होईल. त्यांनी केलेल्या जुन्या नोंदी मात्र अहवालात तशाच राहतील.`}
        confirmLabel="होय, काढा"
        busy={deleteBusy}
        onConfirm={confirmDeleteWorker}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings panel (PHC / sub-center names)                             */
/* ------------------------------------------------------------------ */

function SettingsPanel({
  settings,
  onSaved,
}: {
  settings: AppSettings;
  onSaved: (s: AppSettings) => void;
}) {
  const toast = useToast();
  const [phcName, setPhcName] = useState(settings.phcName);
  const [subcenterName, setSubcenterName] = useState(settings.subcenterName);
  const [saving, setSaving] = useState(false);

  const dirty =
    phcName.trim() !== settings.phcName || subcenterName.trim() !== settings.subcenterName;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phcName.trim()) return toast("प्राथमिक आरोग्य केंद्राचे नाव टाका.", "error");
    if (!subcenterName.trim()) return toast("उपकेंद्राचे नाव टाका.", "error");
    setSaving(true);
    try {
      const next: AppSettings = { phcName: phcName.trim(), subcenterName: subcenterName.trim() };
      await saveSettings(next);
      onSaved(next);
      toast("सेटिंग्ज जतन झाली!", "success");
    } catch (err) {
      toast(friendlyDbError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <SettingsIcon size={22} className="shrink-0 text-emerald-700" />
        <p className="text-xs leading-relaxed font-semibold text-emerald-800">
          ही नावे ॲपच्या हेडरमध्ये आणि PDF अहवालात दिसतील. बदल लगेच सर्व
          फोनवर दिसतील.
        </p>
      </div>
      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
        <Field label="प्राथमिक आरोग्य केंद्राचे नाव">
          <input
            value={phcName}
            onChange={(e) => setPhcName(e.target.value)}
            placeholder="उदा. देहरे"
            className={inputCls}
          />
        </Field>
        <Field label="उपकेंद्राचे नाव">
          <input
            value={subcenterName}
            onChange={(e) => setSubcenterName(e.target.value)}
            placeholder="उदा. वडगाव गुप्ता"
            className={inputCls}
          />
        </Field>
        <div className="sm:col-span-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={saving || !dirty}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 px-6 py-3 font-extrabold text-white shadow-xl shadow-emerald-700/30 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
          >
            <Save size={18} />
            {saving ? "जतन होत आहे..." : "जतन करा"}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
