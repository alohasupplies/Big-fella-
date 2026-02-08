/**
 * Parse a "YYYY-MM-DD" date string as a local date.
 *
 * new Date("2026-02-07") is parsed as UTC midnight, which can shift
 * to the previous day when displayed in western timezones.
 * This function parses the components directly to avoid that.
 */
export const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
