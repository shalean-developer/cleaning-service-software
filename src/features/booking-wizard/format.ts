export function formatZar(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDateLabel(date: string, time: string): string {
  if (!date) return "";
  try {
    const d = new Date(`${date}T${time || "00:00"}+02:00`);
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: time ? "2-digit" : undefined,
      minute: time ? "2-digit" : undefined,
    }).format(d);
  } catch {
    return `${date} ${time}`.trim();
  }
}
