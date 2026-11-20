export type Row = Record<string, unknown>;
export function moneyValue(value: unknown): number {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}
export function recordTimestamp(row: Row): number {
  const stored = Number(row.createdAtMs ?? row.committedAt);
  if (stored > 0) return stored;
  const parsed = new Date(String(row.dateTime ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
export function groupNursingRows(rows: Row[]): [string, Row[]][] {
  const groups = new Map<string, Row[]>();
  for (const row of [...rows].sort(
    (a, b) => recordTimestamp(b) - recordTimestamp(a),
  )) {
    const stamp = recordTimestamp(row);
    const month = stamp
      ? new Date(stamp).toLocaleDateString("en-GB", {
          timeZone: "Africa/Lagos",
          month: "long",
          year: "numeric",
        })
      : "Earlier records";
    groups.set(month, [...(groups.get(month) ?? []), row]);
  }
  return [...groups];
}
