const pad = (n: number) => String(n).padStart(2, "0");

export const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = () => iso(new Date());

export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const overlaps = (s1: string, e1: string, s2: string, e2: string) =>
  s1 <= e2 && s2 <= e1;

export const fmtDay = (s: string) =>
  parseISO(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtRange = (s: string, e: string) =>
  s === e ? fmtDay(s) : `${fmtDay(s)} – ${fmtDay(e)}`;

/** Inclusive day count — a same-day rental is 1 day. */
export const rentalDays = (s: string, e: string) =>
  Math.round((parseISO(e).getTime() - parseISO(s).getTime()) / 86400000) + 1;

/** Calendar cells for a month: leading nulls, then ISO dates. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(year, month, d)));
  return cells;
}
