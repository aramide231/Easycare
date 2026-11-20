/** Age at the time the feeding entry is recorded. Future dates are invalid. */
export function dayOfLife(dob: string, at = new Date()): string {
  if (!dob) return "";
  const born = new Date(dob);
  const minutes = Math.floor((at.getTime() - born.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const format = (value: number, unit: string) =>
    `${value} ${unit}${value === 1 ? "" : "s"}`;
  if (minutes < 60) return format(minutes, "minute");
  if (minutes < 1440) return format(Math.floor(minutes / 60), "hour");
  const days = Math.floor(minutes / 1440);
  if (days < 7) return format(days, "day");
  // Completed calendar months, rather than assuming every month has 30 days.
  let months =
    (at.getFullYear() - born.getFullYear()) * 12 +
    at.getMonth() -
    born.getMonth();
  const anniversary = new Date(born);
  anniversary.setMonth(born.getMonth() + months);
  if (anniversary > at) months--;
  return months > 0
    ? format(months, "month")
    : format(Math.floor(days / 7), "week");
}
