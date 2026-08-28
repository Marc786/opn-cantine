/** A sale reduced to what revenue maths needs. */
export interface RevenueSale {
  timestamp: Date | string;
  totalAmount: number;
}

export interface WeeklyRevenue {
  /** Monday of the week, as `YYYY-MM-DD`. */
  weekStart: string;
  amount: number;
}

export interface AverageRevenuePerWeek {
  average: number;
  /** How many weeks the average spans, including weeks with no sales. */
  weeksCounted: number;
  /** True when only the running week exists, so the figure is provisional. */
  partial: boolean;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 local time of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 = Sunday. Shift so Monday is the first day.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Revenue grouped by Monday-based week, ascending, with quiet weeks filled in
 * as zero so a gap in trading is not mistaken for a gap in time.
 */
export function revenueByWeek(sales: RevenueSale[], now: Date = new Date()): WeeklyRevenue[] {
  const totals = new Map<number, number>();

  for (const sale of sales) {
    const at = new Date(sale.timestamp);
    if (Number.isNaN(at.getTime())) continue;
    const week = startOfWeek(at).getTime();
    totals.set(week, (totals.get(week) ?? 0) + sale.totalAmount);
  }

  if (totals.size === 0) return [];

  const first = Math.min(...totals.keys());
  const last = Math.max(startOfWeek(now).getTime(), Math.max(...totals.keys()));

  const weeks: WeeklyRevenue[] = [];
  for (let week = first; week <= last; week += MS_PER_WEEK) {
    weeks.push({
      weekStart: toKey(new Date(week)),
      amount: parseFloat((totals.get(week) ?? 0).toFixed(2)),
    });
  }
  return weeks;
}

/**
 * Average revenue per week.
 *
 * The running week is excluded: it is only partly elapsed, so counting it would
 * drag the average down by an amount that depends on which day you happen to
 * look at the dashboard. Weeks with no sales *are* counted — they are real
 * weeks in which the canteen earned nothing.
 *
 * Before a first full week has gone by there is nothing complete to average, so
 * the running week is used and flagged as `partial`.
 */
export function averageRevenuePerWeek(
  sales: RevenueSale[],
  now: Date = new Date()
): AverageRevenuePerWeek {
  const weeks = revenueByWeek(sales, now);
  if (weeks.length === 0) return { average: 0, weeksCounted: 0, partial: false };

  const currentWeek = toKey(startOfWeek(now));
  const completed = weeks.filter((w) => w.weekStart < currentWeek);
  const counted = completed.length > 0 ? completed : weeks;

  const total = counted.reduce((sum, w) => sum + w.amount, 0);
  return {
    average: parseFloat((total / counted.length).toFixed(2)),
    weeksCounted: counted.length,
    partial: completed.length === 0,
  };
}
