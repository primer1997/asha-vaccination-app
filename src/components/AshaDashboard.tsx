import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Baby,
  CalendarDays,
  Check,
  ClipboardList,
  Edit2,
  HeartPulse,
  Plus,
  Save,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import type { RecordType, User, VaccineRecord } from "../types";
import { CHILD_VACCINES, MOTHER_VACCINES } from "../types";
import {
  getVaccinationDays,
  recommendChildVaccines,
  recommendMotherVaccines,
  formatDateMR,
  friendlyDbError,
} from "../utils";
import {
  createRecord,
  deleteRecord,
  fetchRecords,
  subscribeToRecords,
  updateRecord,
} from "../db";
import { useToast } from "./Toast";
import {
  AnimatedTabs,
  Card,
  ConfirmDialog,
  FadeIn,
  Field,
  InboxEmpty,
  ListSkeleton,
  StatCard,
  VaccineChips,
  inputCls,
  listContainer,
  listItem,
} from "./ui";

const initialForm = {
  patientName: "",
  referenceDate: "",
  vaccines: [] as string[],
  remark: "",
};

export function AshaDashboard({ user }: { user: User }) {
  const toast = useToast();
  const [records, setRecords] = useState<VaccineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<RecordType>("CHILD");

  const sessionDates = useMemo(() => {
    const today = new Date();
    return [
      ...getVaccinationDays(today.getFullYear(), today.getMonth()),
      ...getVaccinationDays(today.getFullYear(), today.getMonth() + 1),
    ].map((d) => d.toISOString().split("T")[0]);
  }, []);

  const [sessionDate, setSessionDate] = useState<string>(
    sessionDates[0] ?? new Date().toISOString().split("T")[0]
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setRecords(await fetchRecords(user.name));
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setLoading(false);
    }
  }, [user.name, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => subscribeToRecords(load), [load]);

  // Auto-recommend child vaccines from the birth date (age as of today).
  // The session date only labels the record — it no longer changes the suggestion.
  useEffect(() => {
    if (editingId || activeTab !== "CHILD" || !formData.referenceDate) return;
    setFormData((prev) => ({
      ...prev,
      vaccines: recommendChildVaccines(formData.referenceDate),
    }));
  }, [formData.referenceDate, activeTab, editingId]);

  // Auto-recommend mother vaccines from LMP as of the selected session date.
  useEffect(() => {
    if (editingId || activeTab !== "PREGNANT_WOMAN" || !formData.referenceDate || !sessionDate)
      return;
    setFormData((prev) => ({
      ...prev,
      vaccines: recommendMotherVaccines(formData.referenceDate, sessionDate),
    }));
  }, [formData.referenceDate, sessionDate, activeTab, editingId]);

  const stats = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return {
      total: records.length,
      thisMonth: records.filter((r) => (r.sessionDate || "").startsWith(month)).length,
      children: records.filter((r) => r.recordType === "CHILD").length,
      mothers: records.filter((r) => r.recordType === "PREGNANT_WOMAN").length,
    };
  }, [records]);

  const filtered = useMemo(
    () => records.filter((r) => r.recordType === activeTab),
    [records, activeTab]
  );

  const toggleVaccine = (v: string) =>
    setFormData((prev) => ({
      ...prev,
      vaccines: prev.vaccines.includes(v)
        ? prev.vaccines.filter((x) => x !== v)
        : [...prev.vaccines, v],
    }));

  const startEdit = (r: VaccineRecord) => {
    setEditingId(r.id);
    setActiveTab(r.recordType);
    setFormData({
      patientName: r.patientName,
      referenceDate: r.referenceDate,
      vaccines: r.vaccines,
      remark: r.remark,
    });
    if (r.sessionDate) setSessionDate(r.sessionDate);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName.trim() || !formData.referenceDate || formData.vaccines.length === 0) {
      toast("कृपया नाव, तारीख आणि किमान एक लस निवडा.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateRecord(editingId, {
          recordType: activeTab,
          patientName: formData.patientName.trim(),
          referenceDate: formData.referenceDate,
          sessionDate,
          vaccines: formData.vaccines,
          remark: formData.remark.trim(),
        });
        toast("नोंद यशस्वीरित्या अपडेट झाली!", "success");
      } else {
        await createRecord({
          ashaId: user.id,
          ashaName: user.name,
          recordType: activeTab,
          patientName: formData.patientName.trim(),
          referenceDate: formData.referenceDate,
          sessionDate,
          vaccines: formData.vaccines,
          remark: formData.remark.trim(),
        });
        toast("नवीन नोंद जतन झाली!", "success");
      }
      setFormData(initialForm);
      setEditingId(null);
      load();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteRecord(deleteId);
      toast("नोंद हटवली.", "info");
      setDeleteId(null);
      load();
    } catch (e) {
      toast(friendlyDbError(e), "error");
    } finally {
      setDeleting(false);
    }
  };

  const vaccineList = activeTab === "CHILD" ? CHILD_VACCINES : MOTHER_VACCINES;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Session date selector */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 10 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/30"
            >
              <CalendarDays size={22} />
            </motion.div>
            <div>
              <h2 className="font-extrabold text-slate-800">लसीकरण सत्र निवडा</h2>
              <p className="text-xs text-slate-500">
                पहिला, दुसरा, तिसरा गुरुवार आणि तिसरा शनिवार
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {sessionDates.slice(0, 8).map((d) => (
              <motion.button
                key={d}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setSessionDate(d)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  sessionDate === d
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/30"
                    : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                }`}
              >
                {formatDateMR(d)}
              </motion.button>
            ))}
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => e.target.value && setSessionDate(e.target.value)}
              className="shrink-0 cursor-pointer rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-bold text-emerald-900 outline-none focus:border-emerald-600"
              aria-label="सत्र तारीख"
            />
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ClipboardList size={20} />
            </span>
          }
          label="एकूण नोंदी"
          value={stats.total}
          accent="bg-emerald-500"
        />
        <StatCard
          icon={
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <CalendarDays size={20} />
            </span>
          }
          label="या महिन्यातील"
          value={stats.thisMonth}
          accent="bg-amber-400"
          delay={0.06}
        />
        <StatCard
          icon={
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Baby size={20} />
            </span>
          }
          label="बालके"
          value={stats.children}
          accent="bg-sky-500"
          delay={0.12}
        />
        <StatCard
          icon={
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100 text-pink-700">
              <HeartPulse size={20} />
            </span>
          }
          label="गरोदर माता"
          value={stats.mothers}
          accent="bg-pink-500"
          delay={0.18}
        />
      </div>

      {/* Tabs */}
      <FadeIn delay={0.1}>
        <AnimatedTabs<RecordType>
          namespace="asha-tabs"
          active={activeTab}
          onChange={(t) => {
            setActiveTab(t);
            cancelEdit();
          }}
          tabs={[
            { id: "CHILD", label: "बालके", icon: <Baby size={16} /> },
            { id: "PREGNANT_WOMAN", label: "गरोदर माता", icon: <HeartPulse size={16} /> },
          ]}
          className="mx-auto w-full max-w-md"
        />
      </FadeIn>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
        {/* Form */}
        <div ref={formRef} className="scroll-mt-24 lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <div className="border-b border-slate-100 p-5 pb-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-slate-800">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${
                      editingId
                        ? "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30"
                        : "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-700/30"
                    }`}
                  >
                    {editingId ? <Edit2 size={18} /> : <Plus size={20} />}
                  </span>
                  {editingId ? "नोंद अपडेट करा" : "नवीन नोंद करा"}
                </h2>
                {editingId && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={cancelEdit}
                    className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                    aria-label="रद्द करा"
                  >
                    <X size={16} />
                  </motion.button>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <Field
                label={activeTab === "CHILD" ? "बालकाचे संपूर्ण नाव" : "मातेचे संपूर्ण नाव"}
                required
              >
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder={activeTab === "CHILD" ? "उदा. राम रमेश पवार" : "उदा. सीता रमेश पवार"}
                  className={inputCls}
                  required
                />
              </Field>

              <Field
                label={activeTab === "CHILD" ? "जन्मतारीख" : "शेवटच्या पाळीची तारीख (LMP)"}
                required
                hint={
                  !editingId
                    ? activeTab === "CHILD"
                      ? "जन्मतारखेनुसार लस ऑटो-सिलेक्ट"
                      : "लस ऑटो-सिलेक्ट"
                    : undefined
                }
              >
                <input
                  type="date"
                  value={formData.referenceDate}
                  onChange={(e) => setFormData({ ...formData, referenceDate: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>

              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-sm font-bold text-slate-700">
                  <span>
                    लसी निवडा <span className="text-red-500">*</span>
                  </span>
                  {formData.vaccines.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                      <Sparkles size={11} /> {formData.vaccines.length} निवडल्या
                    </span>
                  )}
                </label>
                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  {vaccineList.map((v) => {
                    const on = formData.vaccines.includes(v);
                    return (
                      <motion.button
                        key={v}
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => toggleVaccine(v)}
                        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold ring-1 transition ${
                          on
                            ? "bg-emerald-700 text-white ring-emerald-700 shadow-md shadow-emerald-700/30"
                            : "bg-white text-slate-600 ring-slate-300 hover:ring-emerald-400 hover:text-emerald-800"
                        }`}
                      >
                        {on && <Check size={13} strokeWidth={3} />}
                        {v}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <Field label="शेरा">
                <input
                  type="text"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="काही शेरा असल्यास..."
                  className={inputCls}
                />
              </Field>

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={saving}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold text-white shadow-xl transition disabled:opacity-50 ${
                  editingId
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-500/30 hover:brightness-105"
                    : "bg-gradient-to-r from-emerald-700 to-teal-700 shadow-emerald-700/30 hover:brightness-110"
                }`}
              >
                {editingId ? <Save size={18} /> : <Plus size={18} />}
                {saving ? "जतन होत आहे..." : editingId ? "अपडेट करा" : "माहिती जतन करा"}
              </motion.button>
            </form>
          </Card>
        </div>

        {/* List */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 pb-4">
            <h2 className="text-lg font-extrabold text-slate-800">
              माझ्या नोंदी
              <span className="ml-2 text-sm font-bold text-slate-400">
                ({activeTab === "CHILD" ? "बालके" : "गरोदर माता"})
              </span>
            </h2>
            <motion.span
              key={filtered.length}
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-amber-100 px-3.5 py-1 text-sm font-extrabold text-amber-800 ring-1 ring-amber-200"
            >
              एकूण: {filtered.length}
            </motion.span>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : filtered.length === 0 ? (
              <InboxEmpty
                title="अद्याप कोणतीही नोंद नाही"
                subtitle="डावीकडील फॉर्ममधून पहिली नोंद करा — ती येथे दिसेल."
              />
            ) : (
              <>
                {/* Mobile cards */}
                <motion.div
                  variants={listContainer}
                  initial="hidden"
                  animate="show"
                  className="space-y-3 md:hidden"
                >
                  <AnimatePresence initial={false}>
                    {filtered.map((r) => (
                      <motion.div
                        key={r.id}
                        variants={listItem}
                        exit="exit"
                        layout
                        className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-base font-extrabold text-slate-800">
                              {r.patientName}
                            </h4>
                            <p className="mt-0.5 text-xs font-medium text-slate-500">
                              {activeTab === "CHILD" ? "जन्मतारीख" : "LMP"}:{" "}
                              {formatDateMR(r.referenceDate)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                            सत्र: {formatDateMR(r.sessionDate)}
                          </span>
                        </div>
                        <VaccineChips vaccines={r.vaccines} />
                        {r.remark && (
                          <p className="rounded-xl border border-amber-200/70 bg-amber-50 p-2.5 text-xs text-slate-600">
                            <span className="font-bold">शेरा:</span> {r.remark}
                          </p>
                        )}
                        <div className="flex justify-end gap-2 border-t border-slate-200 pt-2.5">
                          <ActionButton edit onClick={() => startEdit(r)} />
                          <ActionButton onClick={() => setDeleteId(r.id)} />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-sm text-slate-500">
                        <th className="px-4 py-3 font-bold">नाव</th>
                        <th className="px-4 py-3 font-bold">तारीख</th>
                        <th className="px-4 py-3 font-bold">सत्र</th>
                        <th className="px-4 py-3 font-bold">लस</th>
                        <th className="px-4 py-3 text-right font-bold">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      <AnimatePresence initial={false}>
                        {filtered.map((r) => (
                          <motion.tr
                            key={r.id}
                            variants={listItem}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="transition-colors hover:bg-emerald-50/50"
                          >
                            <td className="px-4 py-3 font-bold text-slate-800">{r.patientName}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {formatDateMR(r.referenceDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {formatDateMR(r.sessionDate)}
                            </td>
                            <td className="max-w-[240px] px-4 py-3">
                              <VaccineChips vaccines={r.vaccines} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <ActionButton edit onClick={() => startEdit(r)} />
                                <ActionButton onClick={() => setDeleteId(r.id)} />
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
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="नोंद हटवायची का?"
        message="ही नोंद कायमची हटवली जाईल. ही क्रिया परत घेता येणार नाही."
        confirmLabel="होय, हटवा"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function ActionButton({
  edit,
  onClick,
}: {
  edit?: boolean;
  onClick: () => void;
}) {
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
