import { format, formatDistanceToNow, parseISO, isAfter, isBefore, addDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: ptBR });
}

export function formatRelativeDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });
}

export function getDateRange(period: 'month' | 'year' | 'lastMonth' | 'lastYear' | 'custom'): { start: Date; end: Date } {
  const now = new Date();

  switch (period) {
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case 'lastYear':
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export function isOverdue(dueDate: string | Date): boolean {
  const date = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  return isBefore(date, new Date());
}

export function isDueSoon(dueDate: string | Date, days: number = 7): boolean {
  const date = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  const threshold = addDays(new Date(), days);
  return isAfter(date, new Date()) && isBefore(date, threshold);
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(array: T[], keyFn: (item: T) => number): number {
  return array.reduce((sum, item) => sum + keyFn(item), 0);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getMonthName(date: Date): string {
  return format(date, 'MMMM', { locale: ptBR });
}

export function getYearMonth(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: ptBR });
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export function aggregateMonthlyData(
  transactions: Array<{ transaction_date: string; type: string; amount: number }>,
  months: number = 12
): MonthlyData[] {
  const result: MonthlyData[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthTransactions = transactions.filter((t) => {
      const date = parseISO(t.transaction_date);
      return !isBefore(date, monthStart) && !isAfter(date, monthEnd);
    });

    // Only count actual income as income - NOT transfers
    // Transfers are just moving money between locations, not creating new money
    const income = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    result.push({
      month: format(monthDate, 'MMM', { locale: ptBR }),
      income,
      expenses,
      balance: income - expenses,
    });
  }

  return result;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(',');
  const dataRows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value ?? '';
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
