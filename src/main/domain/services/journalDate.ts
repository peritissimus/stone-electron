const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatJournalDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function parseJournalDate(input: string): Date {
  const dateOnly = ISO_DATE_ONLY.exec(input);
  if (dateOnly) {
    const [, yyyy, mm, dd] = dateOnly;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid journal date: ${input}`);
  }
  return date;
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
