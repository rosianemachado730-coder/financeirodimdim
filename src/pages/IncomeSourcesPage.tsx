import { useEffect, useState } from 'react';
import { supabase, IncomeSource, Transaction } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate } from '../utils/helpers';
import {
  Wallet,
  Plus,
  Pencil,
  Archive,
  Trash2,
  ArrowRight,
  TrendingUp,
  MoreVertical,
  X,
} from 'lucide-react';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ICONS = [
  'Wallet', 'Briefcase', 'ShoppingBag', 'Car', 'Home', 'Laptop', 'Store', 'TrendingUp', 'DollarSign', 'Gift'
];

const COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

interface SourceWithBalance extends IncomeSource {
  balance: number;
  transactions: Transaction[];
}

export default function IncomeSourcesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sources, setSources] = useState<SourceWithBalance[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);
  const [transferFrom, setTransferFrom] = useState<SourceWithBalance | null>(null);
  const [viewingSource, setViewingSource] = useState<SourceWithBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    icon: 'Wallet',
  });

  const [transferData, setTransferData] = useState({
    amount: '',
    destination_type: 'sector' as 'sector' | 'source',
    destination_id: '',
    description: '',
  });

  const [expenseSectors, setExpenseSectors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [{ data: sourcesData }, { data: transactionsData }, { data: sectorsData }] = await Promise.all([
        supabase.from('income_sources').select('*').is('archived_at', null),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
        supabase.from('expense_sectors').select('id, name').is('archived_at', null),
      ]);

      const sources = sourcesData || [];
      const transactions = transactionsData || [];
      setExpenseSectors(sectorsData || []);

      // Calculate source balances correctly
      // INCOME adds to source
      // TRANSFER_SOURCE removes from source (and adds to destination via transfer_to_*_id)
      // TRANSFER_DEST receives at source (stored in income_source_id)
      const sourcesWithBalance = sources.map((source) => {
        let balance = 0;
        const sourceTransactions: Transaction[] = [];

        transactions.forEach((t) => {
          switch (t.type) {
            case 'income':
              if (t.income_source_id === source.id) {
                balance += t.amount;
                sourceTransactions.push(t);
              }
              break;

            case 'transfer_source':
  // Dinheiro saindo desta fonte
  if (t.income_source_id === source.id) {
    balance -= t.amount;
    sourceTransactions.push(t);
  }
  break;

case 'transfer_dest':
  // Dinheiro chegando nesta fonte
  if (t.income_source_id === source.id) {
    balance += t.amount;
    sourceTransactions.push(t);
  }
  break;
          }
        });

        console.log(
  source.name,
  {
    balance,
    income: transactions
      .filter(t => t.type === "income" && t.income_source_id === source.id)
      .reduce((s,t)=>s+t.amount,0),

    transferOut: transactions
      .filter(t => t.type === "transfer_source" && t.income_source_id === source.id)
      .reduce((s,t)=>s+t.amount,0),

    transferInDest: transactions
      .filter(t => t.type === "transfer_dest" && t.income_source_id === source.id)
      .reduce((s,t)=>s+t.amount,0),

    transferInSource: transactions
      .filter(t => t.type === "transfer_source" && t.transfer_to_income_source_id === source.id)
      .reduce((s,t)=>s+t.amount,0),
  }
);

        return {
          ...source,
          balance,
          transactions: sourceTransactions.slice(0, 20),
        };
      });

      setSources(sourcesWithBalance);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      if (editingSource) {
        const { error } = await supabase
          .from('income_sources')
          .update({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon,
          })
          .eq('id', editingSource.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('income_sources').insert({
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          icon: formData.icon,
        });

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving source:', err);
      setError('Erro ao salvar fonte de renda. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fonte de renda?')) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('income_sources').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error deleting source:', err);
      setError('Erro ao excluir fonte. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('income_sources')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error archiving source:', err);
      setError('Erro ao arquivar fonte. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!transferFrom) return;

    const amount = parseFloat(transferData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Valor inválido');
      return;
    }

    if (amount > transferFrom.balance) {
      setError('Saldo insuficiente');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create source transaction (deduct from source)
      const { error: sourceError } = await supabase
        .from('transactions')
        .insert({
          type: 'transfer_source',
          amount,
          description: transferData.description || `Transferência para ${transferData.destination_type === 'sector' ? 'setor' : 'outra fonte'}`,
          income_source_id: transferFrom.id,
          transfer_to_expense_sector_id: transferData.destination_type === 'sector' ? transferData.destination_id : null,
          transfer_to_income_source_id: transferData.destination_type === 'source' ? transferData.destination_id : null,
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Create destination transaction (add to destination)
      if (transferData.destination_type === 'sector') {
        const { error: destError } = await supabase.from('transactions').insert({
          type: 'sector_transfer_dest',
          amount,
          description: transferData.description || `Recebido de ${transferFrom.name}`,
          expense_sector_id: transferData.destination_id,
        });
        if (destError) throw destError;
      } else {
        const { error: destError } = await supabase.from('transactions').insert({
          type: 'transfer_dest',
          amount,
          description: transferData.description || `Recebido de ${transferFrom.name}`,
          income_source_id: transferData.destination_id,
        });
        if (destError) throw destError;
      }

      setShowTransferModal(false);
      setTransferFrom(null);
      setTransferData({ amount: '', destination_type: 'sector', destination_id: '', description: '' });
      fetchData();
    } catch (err) {
      console.error('Error making transfer:', err);
      setError('Erro ao realizar transferência. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: COLORS[0],
      icon: 'Wallet',
    });
    setEditingSource(null);
  };

  const openEditModal = (source: IncomeSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      description: source.description || '',
      color: source.color,
      icon: source.icon,
    });
    setShowModal(true);
  };

  const openTransferModal = (source: SourceWithBalance) => {
    setTransferFrom(source);
    setTransferData({ amount: '', destination_type: 'sector', destination_id: '', description: '' });
    setShowTransferModal(true);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fontes de Renda</h1>
          <p className="text-gray-600 dark:text-gray-400">Organize suas origens de receita</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Nova fonte
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total em fontes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(sources.reduce((sum, s) => sum + s.balance, 0))}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fontes ativas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{sources.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Maior saldo</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400">
            {sources.length > 0
              ? formatCurrency(Math.max(...sources.map((s) => s.balance)))
              : formatCurrency(0)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Menor saldo</p>
          <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">
            {sources.length > 0
              ? formatCurrency(Math.min(...sources.map((s) => s.balance)))
              : formatCurrency(0)}
          </p>
        </div>
      </div>

      {/* Sources Grid */}
      {sources.length === 0 ? (
        <div className="card p-12">
          <div className="empty-state">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="empty-state-title">Nenhuma fonte de renda cadastrada</h3>
            <p className="empty-state-description">
              Adicione suas fontes de renda para começar a organizar suas finanças.
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
              <Plus className="w-5 h-5" />
              Adicionar fonte
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <div key={source.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: source.color + '20' }}
                  >
                    <Wallet className="w-6 h-6" style={{ color: source.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{source.name}</h3>
                    {source.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {source.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="relative group">
                  <button className="btn-icon">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-white dark:bg-dark-800 shadow-lg ring-1 ring-gray-200 dark:ring-dark-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button
                      onClick={() => openEditModal(source)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => openTransferModal(source)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Transferir
                    </button>
                    <button
                      onClick={() => handleArchive(source.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20"
                    >
                      <Archive className="w-4 h-4" />
                      Arquivar
                    </button>
                    <button
                      onClick={() => handleDelete(source.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Saldo atual</p>
                <p className="text-2xl font-bold" style={{ color: source.balance >= 0 ? source.color : '#ef4444' }}>
                  {formatCurrency(source.balance)}
                </p>
              </div>

              {source.transactions.length > 0 && (
                <div>
  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
    Últimas movimentações
  </p>

  <div className="space-y-2 max-h-40 overflow-y-auto">
    {source.transactions.slice(0, 3).map((tx) => {
      const isPositive =
        tx.type === 'income' ||
        tx.type === 'transfer_dest';

      return (
        <div
          key={tx.id}
          className="flex items-center justify-between text-sm"
        >
          <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
            {tx.description}
          </span>

          <span
            className={`font-medium ${
              isPositive
                ? 'text-success-600 dark:text-success-400'
                : 'text-error-600 dark:text-error-400'
            }`}
          >
            {isPositive ? '+' : '-'} {formatCurrency(tx.amount)}
          </span>
        </div>
      );
    })}
  </div>
</div>

              <button
                onClick={() => setViewingSource(source)}
                className="btn-ghost w-full mt-4 text-sm"
              >
                Ver detalhes
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingSource ? 'Editar fonte de renda' : 'Nova fonte de renda'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Loja, Uber, Salário"
                  required
                />
              </div>

              <div>
                <label className="label">Descrição (opcional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="Descrição da fonte de renda"
                />
              </div>

              <div>
                <label className="label">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingSource ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferFrom && (
        <>
          <div className="modal-overlay" onClick={() => setShowTransferModal(false)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transferir saldo</h2>
              <button onClick={() => setShowTransferModal(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 mb-4 rounded-lg bg-gray-100 dark:bg-dark-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Saldo disponível</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(transferFrom.balance)}
              </p>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="label">Valor</label>
                <input
                  type="number"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  className="input"
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="label">Transferir para</label>
                <select
                  value={transferData.destination_type}
                  onChange={(e) =>
                    setTransferData({
                      ...transferData,
                      destination_type: e.target.value as 'sector' | 'source',
                      destination_id: '',
                    })
                  }
                  className="select"
                >
                  <option value="sector">Setor de gasto</option>
                  <option value="source">Outra fonte de renda</option>
                </select>
              </div>

              <div>
                <label className="label">Destino</label>
                <select
                  value={transferData.destination_id}
                  onChange={(e) => setTransferData({ ...transferData, destination_id: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">Selecione...</option>
                  {transferData.destination_type === 'sector'
                    ? expenseSectors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    : sources
                        .filter((s) => s.id !== transferFrom.id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                </select>
              </div>

              <div>
                <label className="label">Descrição (opcional)</label>
                <input
                  type="text"
                  value={transferData.description}
                  onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                  className="input"
                  placeholder="Descrição da transferência"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                  <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowTransferModal(false)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Transferindo...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Details Drawer */}
      {viewingSource && (
        <>
          <div className="drawer-overlay" onClick={() => setViewingSource(null)} />
          <div className="drawer-content p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: viewingSource.color + '20' }}
                >
                  <Wallet className="w-6 h-6" style={{ color: viewingSource.color }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewingSource.name}</h2>
                  {viewingSource.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{viewingSource.description}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setViewingSource(null)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 mb-6 rounded-lg bg-gray-100 dark:bg-dark-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Saldo atual</p>
              <p className="text-3xl font-bold" style={{ color: viewingSource.color }}>
                {formatCurrency(viewingSource.balance)}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Histórico de movimentações
              </h3>
              {viewingSource.transactions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {viewingSource.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-dark-800"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{tx.description}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(tx.transaction_date)}
                        </p>
                      </div>
                      <p
                        className={`font-semibold ${
                          tx.type === 'income' ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setViewingSource(null);
                openTransferModal(viewingSource);
              }}
              className="btn-primary w-full mt-6"
            >
              <ArrowRight className="w-5 h-5" />
              Transferir saldo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
