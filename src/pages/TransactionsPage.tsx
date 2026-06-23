import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Transaction, IncomeSource, ExpenseSector } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, groupBy } from '../utils/helpers';
import {
  ArrowRightLeft,
  Plus,
  Filter,
  Search,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  X,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type TransactionFilter = 'all' | 'income' | 'expense' | 'transfer';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [expenseSectors, setExpenseSectors] = useState<ExpenseSector[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    type: TransactionFilter;
    dateRange: 'this_month' | 'last_month' | 'last_3_months' | 'all';
    sourceId: string;
    sectorId: string;
    search: string;
  }>({
    type: 'all',
    dateRange: 'this_month',
    sourceId: '',
    sectorId: '',
    search: '',
  });

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense' | 'transfer',
    amount: '',
    description: '',
    notes: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    income_source_id: '',
    expense_sector_id: '',
    transfer_to_type: 'sector' as 'sector' | 'source',
    transfer_to_id: '',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: sources }, { data: sectors }] = await Promise.all([
        supabase.from('income_sources').select('*').is('archived_at', null),
        supabase.from('expense_sectors').select('*').is('archived_at', null),
      ]);

      setIncomeSources(sources || []);
      setExpenseSectors(sectors || []);

      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      // Apply date filter
      const now = new Date();
      if (filters.dateRange === 'this_month') {
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        query = query.gte('transaction_date', format(start, 'yyyy-MM-dd')).lte('transaction_date', format(end, 'yyyy-MM-dd'));
      } else if (filters.dateRange === 'last_month') {
        const lastMonth = subMonths(now, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        query = query.gte('transaction_date', format(start, 'yyyy-MM-dd')).lte('transaction_date', format(end, 'yyyy-MM-dd'));
      } else if (filters.dateRange === 'last_3_months') {
        const start = startOfMonth(subMonths(now, 2));
        query = query.gte('transaction_date', format(start, 'yyyy-MM-dd'));
      }

      const { data: txData } = await query;
      let txs = txData || [];

      // Apply type filter
      if (filters.type !== 'all') {
        if (filters.type === 'income') {
          txs = txs.filter((t) => t.type === 'income');
        } else if (filters.type === 'expense') {
          txs = txs.filter((t) => t.type === 'expense');
        } else if (filters.type === 'transfer') {
          txs = txs.filter((t) =>
            t.type.includes('transfer') || t.type.includes('sector_transfer')
          );
        }
      }

      // Apply source filter
      if (filters.sourceId) {
        txs = txs.filter(
          (t) => t.income_source_id === filters.sourceId || t.transfer_to_income_source_id === filters.sourceId
        );
      }

      // Apply sector filter
      if (filters.sectorId) {
        txs = txs.filter(
          (t) => t.expense_sector_id === filters.sectorId || t.transfer_to_expense_sector_id === filters.sectorId
        );
      }

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        txs = txs.filter(
          (t) =>
            t.description.toLowerCase().includes(searchLower) ||
            (t.notes && t.notes.toLowerCase().includes(searchLower))
        );
      }

      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Valor inválido');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (formData.type === 'income') {
        const { error } = await supabase.from('transactions').insert({
          type: 'income',
          amount,
          description: formData.description,
          notes: formData.notes || null,
          transaction_date: formData.transaction_date,
          income_source_id: formData.income_source_id,
        });
        if (error) throw error;
      } else if (formData.type === 'expense') {
        const { error } = await supabase.from('transactions').insert({
          type: 'expense',
          amount,
          description: formData.description,
          notes: formData.notes || null,
          transaction_date: formData.transaction_date,
          expense_sector_id: formData.expense_sector_id,
        });
        if (error) throw error;
      } else if (formData.type === 'transfer') {
        // Create source transaction
        const { error: sourceError } = await supabase
          .from('transactions')
          .insert({
            type: 'transfer_source',
            amount,
            description: formData.description,
            notes: formData.notes || null,
            transaction_date: formData.transaction_date,
            income_source_id: formData.income_source_id,
            expense_sector_id: formData.transfer_to_type === 'sector' ? null : undefined,
            transfer_to_expense_sector_id: formData.transfer_to_type === 'sector' ? formData.transfer_to_id : null,
            transfer_to_income_source_id: formData.transfer_to_type === 'source' ? formData.transfer_to_id : null,
          })
          .select()
          .single();

        if (sourceError) throw sourceError;

        // Create destination transaction
        if (formData.transfer_to_type === 'sector') {
          const { error: destError } = await supabase.from('transactions').insert({
            type: 'sector_transfer_dest',
            amount,
            description: `Recebido: ${formData.description}`,
            notes: formData.notes || null,
            transaction_date: formData.transaction_date,
            expense_sector_id: formData.transfer_to_id,
          });
          if (destError) throw destError;
        } else {
          const { error: destError } = await supabase.from('transactions').insert({
            type: 'transfer_dest',
            amount,
            description: `Recebido: ${formData.description}`,
            notes: formData.notes || null,
            transaction_date: formData.transaction_date,
            income_source_id: formData.transfer_to_id,
          });
          if (destError) throw destError;
        }
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error creating transaction:', err);
      setError('Erro ao criar transação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    setSubmitting(true);
    setError(null);

    try {
      // Find the transaction to check if it's a transfer
      const tx = transactions.find((t) => t.id === id);

      if (tx && (tx.type === 'transfer_source' || tx.type === 'transfer_dest' ||
                 tx.type === 'sector_transfer_source' || tx.type === 'sector_transfer_dest')) {
        // For transfers, we need to find and delete the paired transaction
        // Transfer pairs share the same date and amount
        const pairedTx = transactions.find((t) =>
          t.id !== id &&
          t.transaction_date === tx.transaction_date &&
          t.amount === tx.amount &&
          ((tx.type === 'transfer_source' && (t.type === 'transfer_dest' || t.type === 'sector_transfer_dest')) ||
           (tx.type === 'transfer_dest' && t.type === 'transfer_source') ||
           (tx.type === 'sector_transfer_source' && t.type === 'sector_transfer_dest') ||
           (tx.type === 'sector_transfer_dest' && (t.type === 'transfer_source' || t.type === 'sector_transfer_source')))
        );

        // Delete both sides of the transfer
        const idsToDelete = pairedTx ? [id, pairedTx.id] : [id];
        for (const deleteId of idsToDelete) {
          const { error } = await supabase.from('transactions').delete().eq('id', deleteId);
          if (error) throw error;
        }
      } else {
        // Regular transaction, just delete it
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
      }
      fetchData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Erro ao excluir transação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'income',
      amount: '',
      description: '',
      notes: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      income_source_id: '',
      expense_sector_id: '',
      transfer_to_type: 'sector',
      transfer_to_id: '',
    });
  };

  const getSourceName = (id: string | null) => {
    if (!id) return null;
    return incomeSources.find((s) => s.id === id)?.name || 'Fonte desconhecida';
  };

  const getSectorName = (id: string | null) => {
    if (!id) return null;
    return expenseSectors.find((s) => s.id === id)?.name || 'Setor desconhecido';
  };

  const groupedTransactions = groupBy(transactions, (t) => t.transaction_date);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading && transactions.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transações</h1>
          <p className="text-gray-600 dark:text-gray-400">Histórico completo de movimentações</p>
        </div>
        <button onClick={() => { resetForm(); setError(null); setShowModal(true); }} className="btn-primary">
          <Plus className="w-5 h-5" />
          Nova transação
        </button>
      </div>

      {/* Global Error Display */}
      {error && !showModal && (
        <div className="p-4 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 flex items-center justify-between">
          <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
          <button onClick={() => setError(null)} className="btn-icon text-error-600 dark:text-error-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-success-600 dark:text-success-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-error-600 dark:text-error-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Saídas</span>
          </div>
          <p className="text-2xl font-bold text-error-600 dark:text-error-400">
            {formatCurrency(totalExpenses)}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Saldo</span>
          </div>
          <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-error-600 dark:text-error-400'}`}>
            {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Buscar transações..."
              className="input pl-10"
            />
          </div>

          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as TransactionFilter })}
            className="select w-full sm:w-40"
          >
            <option value="all">Todos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
            <option value="transfer">Transferências</option>
          </select>

          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as typeof filters.dateRange })}
            className="select w-full sm:w-44"
          >
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="last_3_months">Últimos 3 meses</option>
            <option value="all">Todo período</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary"
          >
            <Filter className="w-5 h-5" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-dark-700">
            <div>
              <label className="label">Fonte de renda</label>
              <select
                value={filters.sourceId}
                onChange={(e) => setFilters({ ...filters, sourceId: e.target.value })}
                className="select"
              >
                <option value="">Todas</option>
                {incomeSources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Setor de gasto</label>
              <select
                value={filters.sectorId}
                onChange={(e) => setFilters({ ...filters, sectorId: e.target.value })}
                className="select"
              >
                <option value="">Todos</option>
                {expenseSectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <div className="card p-12">
          <div className="empty-state">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="empty-state-title">Nenhuma transação encontrada</h3>
            <p className="empty-state-description">
              {filters.search || filters.type !== 'all' || filters.sourceId || filters.sectorId
                ? 'Tente ajustar os filtros para ver mais resultados.'
                : 'Comece registrando suas primeiras movimentações.'}
            </p>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary mt-4">
              <Plus className="w-5 h-5" />
              Registrar transação
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTransactions)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, txs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2 px-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="card divide-y divide-gray-200 dark:divide-dark-700">
                  {txs.map((tx) => {
                    const isIncome = tx.type === 'income' || tx.type === 'transfer_dest' || tx.type === 'sector_transfer_dest';
                    const isExpense = tx.type === 'expense';
                    const isTransfer = tx.type.includes('transfer');

                    let origin = '';
                    let destination = '';

                    if (tx.type === 'income') {
                      origin = getSourceName(tx.income_source_id) || 'Fonte';
                    } else if (tx.type === 'expense') {
                      origin = getSectorName(tx.expense_sector_id) || 'Setor';
                    } else if (tx.type === 'transfer_source') {
                      origin = getSourceName(tx.income_source_id) || getSectorName(tx.expense_sector_id) || 'Origem';
                      destination = tx.transfer_to_expense_sector_id
                        ? getSectorName(tx.transfer_to_expense_sector_id) || ''
                        : getSourceName(tx.transfer_to_income_source_id) || '';
                    }

                    return (
                      <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isIncome
                                ? 'bg-success-100 dark:bg-success-900/30'
                                : isExpense
                                ? 'bg-error-100 dark:bg-error-900/30'
                                : 'bg-primary-100 dark:bg-primary-900/30'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowUpRight className={`w-5 h-5 text-success-600 dark:text-success-400`} />
                            ) : isExpense ? (
                              <ArrowDownRight className={`w-5 h-5 text-error-600 dark:text-error-400`} />
                            ) : (
                              <ArrowRight className={`w-5 h-5 text-primary-600 dark:text-primary-400`} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {tx.description}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                              {origin && (
                                <>
                                  <span className="truncate">{origin}</span>
                                  {destination && (
                                    <>
                                      <ArrowRight className="w-3 h-3" />
                                      <span className="truncate">{destination}</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p
                            className={`font-semibold text-right ${
                              isIncome
                                ? 'text-success-600 dark:text-success-400'
                                : isExpense
                                ? 'text-error-600 dark:text-error-400'
                                : 'text-primary-600 dark:text-primary-400'
                            }`}
                          >
                            {isIncome ? '+' : !isTransfer ? '-' : ''}{formatCurrency(tx.amount)}
                          </p>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="btn-icon text-gray-400 hover:text-error-600 dark:hover:text-error-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create Transaction Modal */}
      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nova transação</h2>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
                  className="select"
                >
                  <option value="income">Entrada</option>
                  <option value="expense">Saída</option>
                  <option value="transfer">Transferência</option>
                </select>
              </div>

              <div>
                <label className="label">Valor</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input"
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="label">Descrição</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="Ex: Venda, Compras, Salário"
                  required
                />
              </div>

              <div>
                <label className="label">Data</label>
                <input
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              {formData.type === 'income' && (
                <div>
                  <label className="label">Fonte de renda</label>
                  <select
                    value={formData.income_source_id}
                    onChange={(e) => setFormData({ ...formData, income_source_id: e.target.value })}
                    className="select"
                    required
                  >
                    <option value="">Selecione...</option>
                    {incomeSources.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.type === 'expense' && (
                <div>
                  <label className="label">Setor de gasto</label>
                  <select
                    value={formData.expense_sector_id}
                    onChange={(e) => setFormData({ ...formData, expense_sector_id: e.target.value })}
                    className="select"
                    required
                  >
                    <option value="">Selecione...</option>
                    {expenseSectors.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.type === 'transfer' && (
                <>
                  <div>
                    <label className="label">De (fonte de renda)</label>
                    <select
                      value={formData.income_source_id}
                      onChange={(e) => setFormData({ ...formData, income_source_id: e.target.value })}
                      className="select"
                      required
                    >
                      <option value="">Selecione...</option>
                      {incomeSources.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Para</label>
                    <select
                      value={formData.transfer_to_type}
                      onChange={(e) => setFormData({ ...formData, transfer_to_type: e.target.value as typeof formData.transfer_to_type })}
                      className="select"
                    >
                      <option value="sector">Setor de gasto</option>
                      <option value="source">Outra fonte de renda</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Destino</label>
                    <select
                      value={formData.transfer_to_id}
                      onChange={(e) => setFormData({ ...formData, transfer_to_id: e.target.value })}
                      className="select"
                      required
                    >
                      <option value="">Selecione...</option>
                      {formData.transfer_to_type === 'sector'
                        ? expenseSectors.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))
                        : incomeSources
                            .filter((s) => s.id !== formData.income_source_id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="label">Observações (opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input resize-none"
                  rows={2}
                  placeholder="Notas adicionais..."
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                  <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
