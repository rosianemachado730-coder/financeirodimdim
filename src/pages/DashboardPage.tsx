import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, IncomeSource, ExpenseSector, Transaction, RecurringBill, FinancialGoal } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, calculatePercentage, sumBy } from '../utils/helpers';
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Target,
  Sparkles,
  AlertCircle,
  Plus,
  ArrowRight,
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
} from 'recharts';
import { startOfMonth, endOfMonth, subMonths, format, isWithinInterval, parseISO, addDays, isAfter, isBefore, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalBalance: number;
  incomeSourcesTotal: number;
  expenseSectorsTotal: number;
  emergencyFundTotal: number;
  investmentsTotal: number;
  monthIncome: number;
  monthExpenses: number;
  monthBalance: number;
  savingsRate: number;
  upcomingBills: RecurringBill[];
}

interface Insight {
  id: string;
  type: 'info' | 'success' | 'warning';
  message: string;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSectors, setExpenseSectors] = useState<ExpenseSector[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    console.log('[DASHBOARD] Fetching data...');
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const [
        { data: sourcesData, error: sourcesError },
        { data: sectorsData, error: sectorsError },
        { data: transactionsData, error: txError },
        { data: billsData, error: billsError },
        { data: goalsData, error: goalsError },
      ] = await Promise.all([
        supabase.from('income_sources').select('*').is('archived_at', null),
        supabase.from('expense_sectors').select('*').is('archived_at', null),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('recurring_bills').select('*').eq('is_active', true),
        supabase.from('financial_goals').select('*').is('archived_at', null).is('completed_at', null),
      ]);

      if (sourcesError) console.error('[DASHBOARD] Sources error:', sourcesError);
      if (sectorsError) console.error('[DASHBOARD] Sectors error:', sectorsError);
      if (txError) console.error('[DASHBOARD] Transactions error:', txError);
      if (billsError) console.error('[DASHBOARD] Bills error:', billsError);
      if (goalsError) console.error('[DASHBOARD] Goals error:', goalsError);

      const sources = sourcesData || [];
      const sectors = sectorsData || [];
      const txs = transactionsData || [];
      const bills = billsData || [];
      const goalData = goalsData || [];

      console.log('[DASHBOARD] Loaded:', sources.length, 'sources,', sectors.length, 'sectors,', txs.length, 'transactions');

      setIncomeSources(sources);
      setExpenseSectors(sectors);
      setTransactions(txs);
      setRecurringBills(bills);
      setGoals(goalData);

      // ==========================================
      // CORRECT BALANCE CALCULATION
      // ==========================================

      // Net worth = Total Income - Total Expenses
      // Transfers between sources/sectors do NOT affect net worth

      const totalIncome = txs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpenses = txs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const netWorth = totalIncome - totalExpenses;

      // Calculate where the money currently is located
      // Source balances track where income came minus what was transferred out

      const sourceBalances: Record<string, number> = {};
      sources.forEach((s) => { sourceBalances[s.id] = 0; });

      txs.forEach((t) => {
        switch (t.type) {
          case 'income':
            // Money enters the system at this source
            if (t.income_source_id) {
              sourceBalances[t.income_source_id] = (sourceBalances[t.income_source_id] || 0) + t.amount;
            }
            break;

case 'transfer_source':
  // Money leaves the origin source.
  // The destination source will be credited by the transfer_dest record.
  if (t.income_source_id) {
    sourceBalances[t.income_source_id] =
      (sourceBalances[t.income_source_id] || 0) - t.amount;
  }
  break;

          case 'transfer_dest':
            // Money arrives at this source from another source
            // Note: This is recorded with income_source_id pointing to the DESTINATION
            if (t.income_source_id) {
              sourceBalances[t.income_source_id] = (sourceBalances[t.income_source_id] || 0) + t.amount;
            }
            break;
        }
      });

      // Sector balances track money allocated for spending
      // IMPORTANT: A transfer from source -> sector creates TWO records:
      //   1. transfer_source (in income source) - records the OUTFLOW from source
      //   2. sector_transfer_dest (in expense sector) - records the INFLOW to sector
      // We must ONLY count sector_transfer_dest for sectors, NOT transfer_source
      // Otherwise we double-count the same transfer!
      const sectorBalances: Record<string, number> = {};
      sectors.forEach((s) => { sectorBalances[s.id] = 0; });

      txs.forEach((t) => {
        switch (t.type) {
          case 'expense':
            // Money spent from sector - reduces sector balance
            if (t.expense_sector_id) {
              sectorBalances[t.expense_sector_id] = (sectorBalances[t.expense_sector_id] || 0) - t.amount;
            }
            break;

          case 'sector_transfer_dest':
            // Money arriving at this sector (from source or another sector)
            // This is the ONLY record we count for sector inflow from source
            if (t.expense_sector_id) {
              sectorBalances[t.expense_sector_id] = (sectorBalances[t.expense_sector_id] || 0) + t.amount;
            }
            break;

          case 'sector_transfer_source':
            // Money leaving this sector (to another sector)
            if (t.expense_sector_id) {
              sectorBalances[t.expense_sector_id] = (sectorBalances[t.expense_sector_id] || 0) - t.amount;
            }
            // Money arriving at this sector from another sector
            if (t.transfer_to_expense_sector_id) {
              sectorBalances[t.transfer_to_expense_sector_id] = (sectorBalances[t.transfer_to_expense_sector_id] || 0) + t.amount;
            }
            break;

          // DELIBERATELY IGNORE transfer_source for sector calculations
          // It's the source-side record; sector_transfer_dest is the sector-side record
          // Counting both would double-count the same transfer
          // case 'transfer_source': DO NOT COUNT FOR SECTORS
        }
      });

      const incomeSourcesTotal = Object.values(sourceBalances).reduce((a, b) => a + b, 0);
      const expenseSectorsTotal = Object.values(sectorBalances).reduce((a, b) => a + b, 0);

      // Verify: incomeSourcesTotal + expenseSectorsTotal should equal netWorth
      // (within floating point precision for valid data)
      console.log('[DASHBOARD] Verification:', {
        incomeSourcesTotal,
        expenseSectorsTotal,
        sum: incomeSourcesTotal + expenseSectorsTotal,
        netWorth,
        diff: Math.abs(incomeSourcesTotal + expenseSectorsTotal - netWorth)
      });

      // Calculate emergency fund and investments
      const emergencyFundTotal = sectors
        .filter((s) => s.is_emergency_fund)
        .reduce((sum, s) => sum + (sectorBalances[s.id] || 0), 0);

      const investmentsTotal = sectors
        .filter((s) => s.is_investment)
        .reduce((sum, s) => sum + (sectorBalances[s.id] || 0), 0);

      // Monthly stats - only income and expense affect net worth
      const monthTxs = txs.filter((t) => {
        const date = parseISO(t.transaction_date);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      const monthIncome = monthTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const monthExpenses = monthTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0;

      // Get upcoming bills (due in next 7 days)
      const today = startOfToday();
      const nextWeek = addDays(today, 7);
      const upcomingBills = bills.filter((bill) => {
        const dueDateThisMonth = new Date(now.getFullYear(), now.getMonth(), bill.due_day);
        if (bill.last_paid_at && isAfter(parseISO(bill.last_paid_at), dueDateThisMonth)) {
          return false;
        }
        return isWithinInterval(dueDateThisMonth, { start: today, end: nextWeek }) || isBefore(dueDateThisMonth, today);
      });

      // Total balance is net worth (income - expenses, NOT sum of locations)
      setStats({
        totalBalance: netWorth,
        incomeSourcesTotal,
        expenseSectorsTotal,
        emergencyFundTotal,
        investmentsTotal,
        monthIncome,
        monthExpenses,
        monthBalance: monthIncome - monthExpenses,
        savingsRate,
        upcomingBills,
      });

      generateInsights(sources, sectors, txs, monthIncome, monthExpenses, emergencyFundTotal, goalData);

    } catch (error) {
      console.error('[DASHBOARD] Error:', error);
    } finally {
      setLoading(false);
      console.log('[DASHBOARD] Loading complete');
    }
  };

  const generateInsights = (
    sources: IncomeSource[],
    _sectors: ExpenseSector[],
    txs: Transaction[],
    monthIncome: number,
    monthExpenses: number,
    emergencyFund: number,
    goalData: FinancialGoal[]
  ) => {
    const insightsList: Insight[] = [];

    // Savings rate insight
    if (monthIncome > 0) {
      const savingsRate = ((monthIncome - monthExpenses) / monthIncome) * 100;
      if (savingsRate >= 20) {
        insightsList.push({
          id: '1',
          type: 'success',
          message: `Você economizou ${savingsRate.toFixed(1)}% da renda este mês. Excelente!`,
        });
      } else if (savingsRate < 10 && savingsRate > 0) {
        insightsList.push({
          id: '2',
          type: 'warning',
          message: `Sua taxa de poupanca esta em ${savingsRate.toFixed(1)}%. Tente aumentar para pelo menos 20%.`,
        });
      }
    }

    // Emergency fund coverage
    if (emergencyFund > 0 && monthExpenses > 0) {
      const monthsCovered = emergencyFund / monthExpenses;
      if (monthsCovered >= 6) {
        insightsList.push({
          id: '3',
          type: 'success',
          message: `Sua reserva de emergencia cobre ${monthsCovered.toFixed(1)} meses de despesas. Muito bem!`,
        });
      } else {
        insightsList.push({
          id: '4',
          type: 'info',
          message: `Sua reserva de emergencia cobre ${monthsCovered.toFixed(1)} meses. O ideal e ter 6 meses.`,
        });
      }
    }

    // Main income source
    const sourceBalances: Record<string, number> = {};
    txs.filter((t) => t.type === 'income' && t.income_source_id).forEach((t) => {
      sourceBalances[t.income_source_id!] = (sourceBalances[t.income_source_id!] || 0) + t.amount;
    });

    const mainSource = Object.entries(sourceBalances).sort(([, a], [, b]) => b - a)[0];
    if (mainSource) {
      const source = sources.find((s) => s.id === mainSource[0]);
      const totalIncomeAmount = Object.values(sourceBalances).reduce((a, b) => a + b, 0);
      const percentage = totalIncomeAmount > 0 ? calculatePercentage(mainSource[1], totalIncomeAmount) : 0;
      if (source) {
        insightsList.push({
          id: '5',
          type: 'info',
          message: `Sua principal fonte de renda e ${source.name}, representando ${percentage}% dos ganhos.`,
        });
      }
    }

    // Goal progress
    const nearGoals = goalData.filter((g) => {
      if (!g.target_date) return false;
      const targetDate = parseISO(g.target_date);
      const nowDate = new Date();
      const monthsDiff = (targetDate.getFullYear() - nowDate.getFullYear()) * 12 + targetDate.getMonth() - nowDate.getMonth();
      return monthsDiff <= 3 && monthsDiff > 0;
    });

    if (nearGoals.length > 0) {
      insightsList.push({
        id: '6',
        type: 'warning',
        message: `Você tem ${nearGoals.length} meta(s) com prazo proximo. Verifique seu progresso.`,
      });
    }

    setInsights(insightsList.slice(0, 4));
  };

  // Monthly flow chart - only income vs expenses for net worth tracking
  const prepareMonthlyChartData = () => {
    const months: { month: string; income: number; expenses: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthTxs = transactions.filter((t) => {
        const date = parseISO(t.transaction_date);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      // Only income and expense affect the chart
      const income = monthTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

      months.push({
        month: format(monthDate, 'MMM', { locale: ptBR }),
        income,
        expenses,
      });
    }

    return months;
  };

  // Spending by category (actual expenses, not transfers)
  const prepareCategoryData = () => {
    const sectorSpending: Record<string, number> = {};

    transactions
      .filter((t) => t.type === 'expense' && t.expense_sector_id)
      .forEach((t) => {
        sectorSpending[t.expense_sector_id!] = (sectorSpending[t.expense_sector_id!] || 0) + t.amount;
      });

    const total = Object.values(sectorSpending).reduce((a, b) => a + b, 0);

    return Object.entries(sectorSpending)
      .map(([id, amount]) => {
        const sector = expenseSectors.find((s) => s.id === id);
        return {
          name: sector?.name || 'Outros',
          value: amount,
          percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
          color: sector?.color || COLORS[0],
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  };

  // Income source distribution
  const prepareIncomeSourceData = () => {
    const sourceIncome: Record<string, number> = {};

    transactions
      .filter((t) => t.type === 'income' && t.income_source_id)
      .forEach((t) => {
        sourceIncome[t.income_source_id!] = (sourceIncome[t.income_source_id!] || 0) + t.amount;
      });

    const total = Object.values(sourceIncome).reduce((a, b) => a + b, 0);

    return Object.entries(sourceIncome)
      .map(([id, amount]) => {
        const source = incomeSources.find((s) => s.id === id);
        return {
          name: source?.name || 'Outros',
          value: amount,
          percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
          color: source?.color || COLORS[0],
        };
      })
      .sort((a, b) => b.value - a.value);
  };

  // Patrimony evolution = income - expenses over time
  const preparePatrimonyData = () => {
    const months: { month: string; balance: number }[] = [];
    const now = new Date();
    let runningBalance = 0;

    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthEnd = endOfMonth(monthDate);

      // Calculate all income and expenses up to this month
      const txsUntilMonth = transactions.filter((t) => {
        const date = parseISO(t.transaction_date);
        return !isAfter(date, monthEnd);
      });

      // Recalculate running balance properly
      const income = txsUntilMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = txsUntilMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      runningBalance = income - expenses;

      months.push({
        month: format(monthDate, 'MMM', { locale: ptBR }),
        balance: Math.max(0, runningBalance),
      });
    }

    return months;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const monthlyData = prepareMonthlyChartData();
  const categoryData = prepareCategoryData();
  const incomeSourceData = prepareIncomeSourceData();
  const patrimonyData = preparePatrimonyData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Visao geral das suas financas</p>
        </div>
        <Link to="/transactions/new" className="btn-primary">
          <Plus className="w-5 h-5" />
          Nova transacao
        </Link>
      </div>

      {/* Total Balance Card */}
      <div className="card-elevated p-6 sm:p-8 bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-900 dark:to-dark-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-primary-100 dark:text-primary-200 text-sm font-medium mb-1">Patrimonio Total</p>
            <h2 className="text-4xl sm:text-5xl font-bold text-white">{formatCurrency(stats?.totalBalance || 0)}</h2>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-xl px-4 py-2">
            {stats?.monthBalance !== undefined && stats.monthBalance >= 0 ? (
              <TrendingUp className="w-5 h-5 text-success-300" />
            ) : (
              <TrendingDown className="w-5 h-5 text-error-300" />
            )}
            <div>
              <p className="text-white text-sm font-medium">
                {stats?.monthBalance !== undefined ? formatCurrency(stats.monthBalance) : 'R$ 0,00'}
              </p>
              <p className="text-primary-200 text-xs">Saldo do mes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats - Money location */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <p className="stat-value">{formatCurrency(stats?.incomeSourcesTotal || 0)}</p>
          <p className="stat-label">Em fontes de renda</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
          </div>
          <p className="stat-value">{formatCurrency(stats?.expenseSectorsTotal || 0)}</p>
          <p className="stat-label">Em setores</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            </div>
          </div>
          <p className="stat-value">{formatCurrency(stats?.emergencyFundTotal || 0)}</p>
          <p className="stat-label">Reserva de emergencia</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
          <p className="stat-value">{formatCurrency(stats?.investmentsTotal || 0)}</p>
          <p className="stat-label">Investido</p>
        </div>
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Entradas do mes</span>
            <ArrowUpRight className="w-5 h-5 text-success-500" />
          </div>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400">
            {formatCurrency(stats?.monthIncome || 0)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Saidas do mes</span>
            <ArrowDownRight className="w-5 h-5 text-error-500" />
          </div>
          <p className="text-2xl font-bold text-error-600 dark:text-error-400">
            {formatCurrency(stats?.monthExpenses || 0)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Taxa de poupanca</span>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {stats?.savingsRate || 0}%
          </p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-warning-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg ${
                  insight.type === 'success'
                    ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
                    : insight.type === 'warning'
                    ? 'bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800'
                    : 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                }`}
              >
                <p className={`text-sm ${
                  insight.type === 'success'
                    ? 'text-success-700 dark:text-success-300'
                    : insight.type === 'warning'
                    ? 'text-warning-700 dark:text-warning-300'
                    : 'text-primary-700 dark:text-primary-300'
                }`}>
                  {insight.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Bills */}
      {stats?.upcomingBills && stats.upcomingBills.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contas a vencer</h3>
            </div>
            <Link to="/recurring-bills" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            {stats.upcomingBills.slice(0, 3).map((bill) => (
              <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-warning-50 dark:bg-warning-900/20">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{bill.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Vence dia {bill.due_day} - {formatCurrency(bill.amount)}
                  </p>
                </div>
                <Link to="/recurring-bills" className="btn-ghost text-sm">
                  Pagar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Flow Chart */}
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Fluxo mensal</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spending by Category */}
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Gastos por categoria</h3>
          {categoryData.length > 0 ? (
            <div className="chart-container flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-40 space-y-2">
                {categoryData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{entry.name}</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white ml-auto">{entry.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p className="text-gray-500 dark:text-gray-400">Sem dados de gastos</p>
            </div>
          )}
        </div>

        {/* Patrimony Evolution */}
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Evolucao patrimonial</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={patrimonyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="balance" name="Patrimonio" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Income Sources Distribution */}
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Origem da renda</h3>
          {incomeSourceData.length > 0 ? (
            <div className="chart-container flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={incomeSourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
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
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{entry.name}</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white ml-auto">{entry.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p className="text-gray-500 dark:text-gray-400">Sem dados de renda</p>
            </div>
          )}
        </div>
      </div>

      {/* Goals Progress */}
      {goals.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Metas em andamento</h3>
            <Link to="/goals" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.slice(0, 3).map((goal) => {
              const contributions = transactions
                .filter((t) => t.goal_contribution_id === goal.id)
                .reduce((sum, t) => sum + t.amount, 0);
              const progress = calculatePercentage(contributions, goal.target_amount);

              return (
                <div key={goal.id} className="p-4 rounded-lg bg-gray-50 dark:bg-dark-800">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: goal.color + '20' }}>
                      <Target className="w-5 h-5" style={{ color: goal.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{goal.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(contributions)} de {formatCurrency(goal.target_amount)}
                      </p>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: goal.color }} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{progress}% concluido</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
