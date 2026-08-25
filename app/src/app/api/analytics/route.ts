import { NextRequest, NextResponse } from 'next/server';
import { transactionRepository } from '@/lib/infrastructure/repositories/transaction.repository.mongo';
import { productRepository } from '@/lib/infrastructure/repositories/product.repository.mongo';
import { restockEventRepository } from '@/lib/infrastructure/repositories/restock-event.repository.mongo';
import { employeeRepository } from '@/lib/infrastructure/repositories/employee.repository.mongo';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/infrastructure/auth/admin-token';

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  if (!verifyAdminRequest(request)) return unauthorizedResponse();

  try {
    const [transactions, products, restockEvents, employees] = await Promise.all([
      transactionRepository.findAll(),
      productRepository.findAll(),
      restockEventRepository.findAll(),
      employeeRepository.findAll(),
    ]);

    // Sort transactions ASC — findAll() returns DESC
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Aggregate transactions per day (Map preserves insertion order → ASC)
    const txByDay = new Map<string, { count: number; amount: number }>();
    for (const tx of sorted) {
      const key = toDateKey(new Date(tx.timestamp));
      const prev = txByDay.get(key) ?? { count: 0, amount: 0 };
      txByDay.set(key, {
        count: prev.count + 1,
        amount: prev.amount + tx.totalAmount,
      });
    }

    // Aggregate restock value per day
    const restocksByDay = new Map<string, number>();
    for (const event of restockEvents) {
      const key = toDateKey(new Date(event.timestamp));
      restocksByDay.set(key, (restocksByDay.get(key) ?? 0) + event.valueAdded);
    }

    // Transactions by day (for bar chart)
    const transactionsByDay = Array.from(txByDay.entries()).map(([date, v]) => ({
      date,
      count: v.count,
      amount: parseFloat(v.amount.toFixed(2)),
    }));

    // Tab history — cumulative sum of employee spending, ascending
    let cumulative = 0;
    const tabHistory = transactionsByDay.map((d) => {
      cumulative += d.amount;
      return { date: d.date, cumulative: parseFloat(cumulative.toFixed(2)) };
    });

    // Inventory value history — backward reconstruction
    // Merge transaction days and restock days, sort ASC
    const allDaySet = new Set([...txByDay.keys(), ...restocksByDay.keys()]);
    const allDays = [...allDaySet].sort();
    const todayKey = toDateKey(new Date());
    if (allDays[allDays.length - 1] !== todayKey) {
      allDays.push(todayKey);
    }

    // Negative stock means oversold units awaiting a restock, not negative value.
    const currentValue = products.reduce(
      (sum, p) => sum + p.price * Math.max(0, p.quantity),
      0
    );

    // value[i] = value[i+1] + sales_on_day[i+1] − restocks_on_day[i+1]
    // (going backward: sales reduced inventory, restocks increased it)
    const values: number[] = new Array(allDays.length);
    values[allDays.length - 1] = currentValue;
    for (let i = allDays.length - 2; i >= 0; i--) {
      const nextDay = allDays[i + 1];
      const nextDaySales = txByDay.get(nextDay)?.amount ?? 0;
      const nextDayRestocks = restocksByDay.get(nextDay) ?? 0;
      values[i] = values[i + 1] + nextDaySales - nextDayRestocks;
    }

    const inventoryHistory = allDays.map((date, i) => ({
      date,
      value: parseFloat(values[i].toFixed(2)),
    }));

    const totalUnpaidTabs = parseFloat(
      employees.reduce((sum, e) => sum + e.tab, 0).toFixed(2)
    );

    return NextResponse.json({ transactionsByDay, tabHistory, inventoryHistory, totalUnpaidTabs });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
