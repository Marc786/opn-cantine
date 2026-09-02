import { describe, it, expect } from 'vitest';
import {
  startOfWeek,
  revenueByWeek,
  averageRevenuePerWeek,
} from './revenue-stats';

/** Local-time date so the tests read the same way the app groups. */
const at = (iso: string) => new Date(`${iso}T12:00:00`);
const sale = (iso: string, totalAmount: number) => ({ timestamp: at(iso), totalAmount });

describe('startOfWeek', () => {
  it('returns the Monday of the week', () => {
    // 2026-08-28 is a Friday.
    expect(startOfWeek(at('2026-08-28')).getDate()).toBe(24);
  });

  it('treats Sunday as the last day of the week, not the first', () => {
    // 2026-08-30 is a Sunday; its Monday is still 2026-08-24.
    expect(startOfWeek(at('2026-08-30')).getDate()).toBe(24);
  });

  it('is idempotent on a Monday', () => {
    const monday = startOfWeek(at('2026-08-24'));
    expect(startOfWeek(monday).getTime()).toBe(monday.getTime());
  });

  it('normalises the time to midnight', () => {
    const start = startOfWeek(at('2026-08-28'));
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('revenueByWeek', () => {
  it('groups sales into Monday-based weeks', () => {
    const weeks = revenueByWeek(
      [sale('2026-08-24', 10), sale('2026-08-30', 5), sale('2026-08-31', 7)],
      at('2026-08-31')
    );

    expect(weeks).toEqual([
      { weekStart: '2026-08-24', amount: 15 },
      { weekStart: '2026-08-31', amount: 7 },
    ]);
  });

  it('fills quiet weeks with zero instead of skipping them', () => {
    const weeks = revenueByWeek([sale('2026-08-10', 100), sale('2026-08-31', 50)], at('2026-08-31'));

    expect(weeks.map((w) => w.weekStart)).toEqual([
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ]);
    expect(weeks.map((w) => w.amount)).toEqual([100, 0, 0, 50]);
  });

  it('extends the range to the current week even with no recent sales', () => {
    const weeks = revenueByWeek([sale('2026-08-10', 100)], at('2026-08-28'));

    expect(weeks).toHaveLength(3);
    expect(weeks[weeks.length - 1]).toEqual({ weekStart: '2026-08-24', amount: 0 });
  });

  it('returns nothing when there are no sales', () => {
    expect(revenueByWeek([], at('2026-08-28'))).toEqual([]);
  });

  it('ignores sales with an unparseable timestamp rather than throwing', () => {
    const weeks = revenueByWeek(
      [{ timestamp: 'not-a-date', totalAmount: 999 }, sale('2026-08-24', 10)],
      at('2026-08-24')
    );

    expect(weeks).toEqual([{ weekStart: '2026-08-24', amount: 10 }]);
  });

  it('accepts ISO string timestamps, as they arrive from JSON', () => {
    const weeks = revenueByWeek(
      [{ timestamp: at('2026-08-24').toISOString(), totalAmount: 10 }],
      at('2026-08-24')
    );

    expect(weeks).toEqual([{ weekStart: '2026-08-24', amount: 10 }]);
  });
});

describe('averageRevenuePerWeek', () => {
  it('averages over completed weeks', () => {
    const result = averageRevenuePerWeek(
      [sale('2026-08-10', 100), sale('2026-08-17', 50)],
      at('2026-08-28')
    );

    // Weeks of Aug 10 and Aug 17 are complete; the running week is excluded.
    expect(result).toEqual({ average: 75, weeksCounted: 2, partial: false });
  });

  it('excludes the running week so the figure does not sag mid-week', () => {
    const sales = [sale('2026-08-17', 100), sale('2026-08-24', 4)];

    // 2026-08-25 is the Tuesday of the running week: barely any of it elapsed.
    expect(averageRevenuePerWeek(sales, at('2026-08-25')).average).toBe(100);
  });

  it('counts quiet weeks as zero rather than ignoring them', () => {
    const result = averageRevenuePerWeek(
      [sale('2026-08-10', 100), sale('2026-08-24', 20)],
      at('2026-08-31')
    );

    // Aug 10, 17 and 24 are complete: (100 + 0 + 20) / 3.
    expect(result).toEqual({ average: 40, weeksCounted: 3, partial: false });
  });

  it('falls back to the running week before a full week has elapsed', () => {
    const result = averageRevenuePerWeek([sale('2026-08-24', 30)], at('2026-08-28'));

    expect(result).toEqual({ average: 30, weeksCounted: 1, partial: true });
  });

  it('reports zero for no sales at all', () => {
    expect(averageRevenuePerWeek([], at('2026-08-28'))).toEqual({
      average: 0,
      weeksCounted: 0,
      partial: false,
    });
  });

  it('equals total revenue divided by the completed weeks it spans', () => {
    const sales = [
      sale('2026-08-03', 12.5),
      sale('2026-08-05', 7.25),
      sale('2026-08-19', 40),
    ];

    const { average, weeksCounted } = averageRevenuePerWeek(sales, at('2026-08-28'));
    const total = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Aug 3, 10 and 17 are complete; Aug 24 is the running week.
    expect(weeksCounted).toBe(3);
    expect(average).toBeCloseTo(total / 3, 2);
  });
});
