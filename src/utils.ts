export function getVaccinationDays(year: number, month: number) {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  let thursdayCount = 0;
  let saturdayCount = 0;

  while (date.getMonth() === month) {
    if (date.getDay() === 4) { // Thursday
      thursdayCount++;
      if (thursdayCount <= 3) days.push(new Date(date));
    }
    if (date.getDay() === 6) { // Saturday
      saturdayCount++;
      if (saturdayCount === 3) days.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  return days.sort((a, b) => a.getTime() - b.getTime());
}

/** Today's date as a local "YYYY-MM-DD" string (avoids the UTC-midnight shift of toISOString). */
export function todayLocalStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Recommend child vaccines from the child's birth date.
 * Age is measured as of `asOfDateStr` (defaults to today) — the selected
 * session date no longer affects the recommendation.
 */
export function recommendChildVaccines(dobStr: string, asOfDateStr: string = todayLocalStr()): string[] {
  if (!dobStr) return [];
  // Parse as local dates (plain "YYYY-MM-DD" parses as UTC, which can shift the day)
  const dob = new Date(dobStr.length <= 10 ? dobStr + "T00:00:00" : dobStr);
  const asOf = new Date(asOfDateStr.length <= 10 ? asOfDateStr + "T00:00:00" : asOfDateStr);
  if (isNaN(dob.getTime()) || isNaN(asOf.getTime())) return [];
  const diffDays = Math.round((asOf.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return []; // Unborn

  // Contiguous day-based windows — every age maps to exactly one set (no dead zones).
  if (diffDays <= 15) return ["BCG", "OPV-0", "Hep-B (Birth Dose)"]; // birth doses
  if (diffDays < 42) return ["OPV-1", "Penta-1", "Rota-1", "fIPV-1", "PCV-1"]; // 6-week set, due next
  if (diffDays < 70) return ["OPV-1", "Penta-1", "Rota-1", "fIPV-1", "PCV-1"]; // 6 weeks – <10 weeks
  if (diffDays < 98) return ["OPV-2", "Penta-2", "Rota-2"]; // 10 weeks – <14 weeks
  if (diffDays < 274) return ["OPV-3", "Penta-3", "Rota-3", "fIPV-2", "PCV-2"]; // 14 weeks – <9 months
  if (diffDays < 487) return ["MR-1", "JE-1", "PCV Booster"]; // 9 months – <16 months
  if (diffDays < 1826) return ["DPT Booster-1", "OPV Booster", "MR-2", "JE-2"]; // 16 months – <5 years
  if (diffDays < 3652) return ["DPT Booster-2"]; // 5 years – <10 years
  if (diffDays < 5844) return ["Td (10 वर्षे)"]; // 10 years – <16 years
  return ["Td (16 वर्षे)"]; // 16 years and above
}

export function recommendMotherVaccines(lmpStr: string, sessionDateStr: string): string[] {
  if (!lmpStr || !sessionDateStr) return [];
  const lmp = new Date(lmpStr.length <= 10 ? lmpStr + "T00:00:00" : lmpStr);
  const session = new Date(sessionDateStr.length <= 10 ? sessionDateStr + "T00:00:00" : sessionDateStr);
  const diffTime = session.getTime() - lmp.getTime();
  if (diffTime < 0) return [];

  const diffMonths = (diffTime / (1000 * 60 * 60 * 24)) / 30.44;
  
  if (diffMonths >= 1 && diffMonths < 4) return ["Td-1"];
  if (diffMonths >= 4 && diffMonths < 9) return ["Td-2"]; // simplified assumption
  
  return [];
}

/** Format a YYYY-MM-DD date string in Marathi locale, safe for empty values. */
export function formatDateMR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr.length <= 10 ? dateStr + "T00:00:00" : dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("mr-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Format YYYY-MM month string as Marathi month + year, e.g. "सप्टेंबर 2026". */
export function formatMonthMR(yyyyMM: string): string {
  const d = new Date(yyyyMM + "-01T00:00:00");
  if (isNaN(d.getTime())) return yyyyMM;
  return d.toLocaleDateString("mr-IN", { month: "long", year: "numeric" });
}

/** Friendly Supabase/Postgres error -> Marathi message. */
export function friendlyDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/duplicate key|already exists|unique/i.test(msg)) return "हे नाव आधीच नोंदवले आहे.";
  if (/network|fetch|failed to fetch|offline/i.test(msg)) return "इंटरनेट कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.";
  if (/row-level security|policy|permission|JWT/i.test(msg))
    return "परवानगी नाकारली. कृपया पुन्हा लॉगिन करा.";
  return "काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.";
}
