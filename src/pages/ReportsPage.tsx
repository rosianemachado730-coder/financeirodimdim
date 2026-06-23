import { useEffect, useState } from 'react';
import { supabase, Transaction, IncomeSource, ExpenseSector } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, downloadFile, exportToCSV, sumBy, groupBy, getDateRange, aggregateMonthlyData } from '../utils/helpers';
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ReportPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSectors, setExpenseSectors] = useState<ExpenseSector[]>([]);
  const [period, setPeriod] = useState<ReportPeriod>('this_month');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: sources }, { data: sectors }, { data: allTransactions }] = await Promise.all([
        supabase.from('income_sources').select('*').is('archived_at', null),
        supabase.from('expense_sectors').select('*').is('archived_at', null),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
      ]);

      setIncomeSources(sources || []);
      setExpenseSectors(sectors || []);

      // Filter transactions by period
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (period) {
        case 'this_month':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case 'last_month':
          const lastMonth = subMonths(now, 1);
          startDate = startOfMonth(lastMonth);
          endDate = endOfMonth(lastMonth);
          break;
        case 'last_3_months':
          startDate = startOfMonth(subMonths(now, 2));
          endDate = now;
          break;
        case 'last_6_months':
          startDate = startOfMonth(subMonths(now, 5));
          endDate = now;
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = now;
          break;
      }

      const filteredTransactions = (allTransactions || []).filter((t) => {
        const date = parseISO(t.transaction_date);
        return isWithinInterval(date, { start: startDate, end: endDate });
      });

      setTransactions(filteredTransactions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const incomeTransactions = transactions.filter((t) => t.type === 'income');
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');

  const totalIncome = sumBy(incomeTransactions, (t) => t.amount);
  const totalExpenses = sumBy(expenseTransactions, (t) => t.amount);
  const netBalance = totalIncome - totalExpenses;

  // Income by source
  const incomeBySource = groupBy(
    incomeTransactions.filter((t) => t.income_source_id),
    (t) => t.income_source_id!
  );

  const incomeSourceData = Object.entries(incomeBySource).map(([id, txs]) => {
    const source = incomeSources.find((s) => s.id === id);
    return {
      name: source?.name || 'Outros',
      value: sumBy(txs, (t) => t.amount),
      color: source?.color || COLORS[0],
    };
  });

  // Expenses by sector
  const expensesBySector = groupBy(
    expenseTransactions.filter((t) => t.expense_sector_id),
    (t) => t.expense_sector_id!
  );

  const expenseSectorData = Object.entries(expensesBySector).map(([id, txs]) => {
    const sector = expenseSectors.find((s) => s.id === id);
    return {
      name: sector?.name || 'Outros',
      value: sumBy(txs, (t) => t.amount),
      color: sector?.color || COLORS[1],
    };
  });

  // Monthly trend
  const monthlyData = aggregateMonthlyData(transactions, 6);

  // Top spending categories
  const topCategories = expenseSectorData.sort((a, b) => b.value - a.value).slice(0, 5);

  const exportToCSVFile = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Valor', 'Origem', 'Destino'];
    const data = transactions.map((t) => ({
      Data: formatDate(t.transaction_date),
      Tipo: t.type === 'income' ? 'Entrada' : t.type === 'expense' ? 'Saída' : 'Transferência',
      Descrição: t.description,
      Valor: t.amount,
      Origem: t.income_source_id
        ? incomeSources.find((s) => s.id === t.income_source_id)?.name || ''
        : t.expense_sector_id
        ? expenseSectors.find((s) => s.id === t.expense_sector_id)?.name || ''
        : '',
      Destino: t.transfer_to_expense_sector_id
        ? expenseSectors.find((s) => s.id === t.transfer_to_expense_sector_id)?.name || ''
        : t.transfer_to_income_source_id
        ? incomeSources.find((s) => s.id === t.transfer_to_income_source_id)?.name || ''
        : '',
    }));

    const csv = exportToCSV(data, headers);
    const filename = `relatorio_financeiro_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
          <p className="text-gray-600 dark:text-gray-400">Análise detalhada das suas finanças</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="select"
          >
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="last_3_months">Últimos 3 meses</option>
            <option value="last_6_months">Últimos 6 meses</option>
            <option value="this_year">Este ano</option>
          </select>
          <button onClick={exportToCSVFile} className="btn-secondary">
            <Download className="w-5 h-5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-success-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Total de entradas</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-success-600 dark:text-success-400">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {incomeTransactions.length} transações
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-error-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Total de saídas</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-error-600 dark:text-error-400">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {expenseTransactions.length} transações
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {netBalance >= 0 ? (
                <TrendingUp className="w-5 h-5 text-success-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-error-500" />
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">Saldo líquido</span>
            </div>
          </div>
          <p
            className={`text-3xl font-bold ${
              netBalance >= 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'
            }`}
          >
            {formatCurrency(netBalance)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Taxa de economia: {totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fluxo mensal</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income Sources */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-success-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Origem da renda</h2>
          </div>
          <div className="chart-container flex items-center">
            {incomeSourceData.length > 0 ? (
              <>
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomeSourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {incomeSourceData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-40 space-y-2">
                  {incomeSourceData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                        {entry.name}
                      </span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {Math.round((entry.value / totalIncome) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full text-center text-gray-500 dark:text-gray-400">
                Sem dados no período
              </div>
            )}
          </div>
        </div>

        {/* Spending by Category */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-error-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gastos por categoria</h2>
          </div>
          <div className="chart-container flex items-center">
            {expenseSectorData.length > 0 ? (
              <>
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseSectorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expenseSectorData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-40 space-y-2">
                  {expenseSectorData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                        {entry.name}
                      </span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {Math.round((entry.value / totalExpenses) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full text-center text-gray-500 dark:text-gray-400">
                Sem dados no período
              </div>
            )}
          </div>
        </div>

        {/* Top Categories */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-warning-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Maiores gastos</h2>
          </div>
          <div className="space-y-4">
            {topCategories.length > 0 ? (
              topCategories.map((cat, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(cat.value)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.round((cat.value / topCategories[0].value) * 100)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Sem dados no período
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transações do período ({transactions.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Data</th>
                <th className="table-header-cell">Descrição</th>
                <th className="table-header-cell">Tipo</th>
                <th className="table-header-cell text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {transactions.slice(0, 20).map((tx) => (
                <tr key={tx.id}>
                  <td className="table-cell">{formatDate(tx.transaction_date)}</td>
                  <td className="table-cell">{tx.description}</td>
                  <td className="table-cell">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tx.type === 'income'
                          ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                          : tx.type === 'expense'
                          ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                          : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                      }`}
                    >
                      {tx.type === 'income' ? 'Entrada' : tx.type === 'expense' ? 'Saída' : 'Transferência'}
                    </span>
                  </td>
                  <td
                    className={`table-cell text-right font-medium ${
                      tx.type === 'income'
                        ? 'text-success-600 dark:text-success-400'
                        : tx.type === 'expense'
                        ? 'text-error-600 dark:text-error-400'
                        : 'text-primary-600 dark:text-primary-400'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length > 20 && (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Mostrando 20 de {transactions.length} transações. Exporte para ver todas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
