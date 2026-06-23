import { useEffect, useState } from 'react';
import { supabase, ExpenseSector, Transaction } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate } from '../utils/helpers';
import {
  PiggyBank,
  Plus,
  Pencil,
  Archive,
  Trash2,
  MoreVertical,
  X,
  Shield,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';

const ICONS = [
  'ShoppingBag', 'Car', 'Home', 'Heart', 'Plane', 'GraduationCap', 'Gamepad2', 'Coffee', 'Utensils', 'Shield'
];

const COLORS = [
  '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#84cc16', '#f97316', '#6366f1', '#14b8a6'
];

interface SectorWithBalance extends ExpenseSector {
  balance: number;
  transactions: Transaction[];
}

export default function ExpenseSectorsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sectors, setSectors] = useState<SectorWithBalance[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSector, setEditingSector] = useState<ExpenseSector | null>(null);
  const [viewingSector, setViewingSector] = useState<SectorWithBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: COLORS[0],
    icon: 'ShoppingBag',
    is_emergency_fund: false,
    is_investment: false,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [{ data: sectorsData }, { data: transactionsData }] = await Promise.all([
        supabase.from('expense_sectors').select('*').is('archived_at', null),
        supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
      ]);

      const sectors = sectorsData || [];
      const transactions = transactionsData || [];

      // Calculate sector balances correctly
      // IMPORTANT: A transfer from source -> sector creates TWO records:
      //   1. transfer_source (in income source) - records the OUTflow from source
      //   2. sector_transfer_dest (in expense sector) - records the INflow to sector
      // We must ONLY count sector_transfer_dest for sectors, NOT transfer_source
      // Otherwise we double-count the same transfer!
      //
      // For sectors:
      //   - sector_transfer_dest: money arriving at this sector (IN)
      //   - expense: money spent from this sector (OUT)
      //   - sector_transfer_source: money leaving this sector for another sector (OUT)
      //   - transfer_source: IGNORE - this is the SOURCE side, not sector side
      const sectorsWithBalance = sectors.map((sector) => {
        let balance = 0;
        const sectorTransactions: Transaction[] = [];

        transactions.forEach((t) => {
          switch (t.type) {
            case 'sector_transfer_dest':
              // Money arriving at this sector (from source or another sector)
              if (t.expense_sector_id === sector.id) {
                balance += t.amount;
                sectorTransactions.push(t);
              }
              break;

            case 'expense':
              // Money spent from this sector
              if (t.expense_sector_id === sector.id) {
                balance -= t.amount;
                sectorTransactions.push(t);
              }
              break;

            case 'sector_transfer_source':
              // Money leaving this sector (to another sector) - OUT
              if (t.expense_sector_id === sector.id) {
                balance -= t.amount;
                sectorTransactions.push(t);
              }
              // Money arriving at this sector from another sector - IN
              // Note: This is for sector-to-sector transfers
              if (t.transfer_to_expense_sector_id === sector.id) {
                balance += t.amount;
                sectorTransactions.push(t);
              }
              break;

            // DELIBERATELY IGNORE transfer_source - it's the source-side record
            // The sector-side record is sector_transfer_dest
            // case 'transfer_source': DO NOT COUNT THIS FOR SECTORS
          }
        });

        return {
          ...sector,
          balance,
          transactions: sectorTransactions.slice(0, 20),
        };
      });

      setSectors(sectorsWithBalance);
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
      if (editingSector) {
        const { error } = await supabase
          .from('expense_sectors')
          .update({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            icon: formData.icon,
            is_emergency_fund: formData.is_emergency_fund,
            is_investment: formData.is_investment,
          })
          .eq('id', editingSector.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('expense_sectors').insert({
          name: formData.name,
          description: formData.description || null,
          color: formData.color,
          icon: formData.icon,
          is_emergency_fund: formData.is_emergency_fund,
          is_investment: formData.is_investment,
        });

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving sector:', err);
      setError('Erro ao salvar setor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este setor?')) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('expense_sectors').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error deleting sector:', err);
      setError('Erro ao excluir setor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('expense_sectors')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error archiving sector:', err);
      setError('Erro ao arquivar setor. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: COLORS[0],
      icon: 'ShoppingBag',
      is_emergency_fund: false,
      is_investment: false,
    });
    setEditingSector(null);
  };

  const openEditModal = (sector: ExpenseSector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name,
      description: sector.description || '',
      color: sector.color,
      icon: sector.icon,
      is_emergency_fund: sector.is_emergency_fund,
      is_investment: sector.is_investment,
    });
    setShowModal(true);
  };

  const totalInSectors = sectors.reduce((sum, s) => sum + Math.max(0, s.balance), 0);
  const emergencyFund = sectors.filter((s) => s.is_emergency_fund).reduce((sum, s) => sum + Math.max(0, s.balance), 0);
  const investments = sectors.filter((s) => s.is_investment).reduce((sum, s) => sum + Math.max(0, s.balance), 0);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Setores de Gastos</h1>
          <p className="text-gray-600 dark:text-gray-400">Distribua seu dinheiro para onde ele vai</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Novo setor
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total em setores</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalInSectors)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Setores ativos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{sectors.length}</p>
        </div>
        <div className="card p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-warning-600 dark:text-warning-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Reserva emergência</p>
            <p className="text-xl font-bold text-warning-600 dark:text-warning-400">{formatCurrency(emergencyFund)}</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-success-600 dark:text-success-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Investimentos</p>
            <p className="text-xl font-bold text-success-600 dark:text-success-400">{formatCurrency(investments)}</p>
          </div>
        </div>
      </div>

      {/* Sectors Grid */}
      {sectors.length === 0 ? (
        <div className="card p-12">
          <div className="empty-state">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
              <PiggyBank className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="empty-state-title">Nenhum setor cadastrado</h3>
            <p className="empty-state-description">
              Crie setores para organizar seus gastos e reservas.
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
              <Plus className="w-5 h-5" />
              Criar setor
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((sector) => (
            <div key={sector.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center relative"
                    style={{ backgroundColor: sector.color + '20' }}
                  >
                    <PiggyBank className="w-6 h-6" style={{ color: sector.color }} />
                    {sector.is_emergency_fund && (
                      <Shield className="w-4 h-4 text-warning-500 absolute -top-1 -right-1" />
                    )}
                    {sector.is_investment && (
                      <TrendingUp className="w-4 h-4 text-success-500 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{sector.name}</h3>
                    {sector.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {sector.description}
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
                      onClick={() => openEditModal(sector)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleArchive(sector.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20"
                    >
                      <Archive className="w-4 h-4" />
                      Arquivar
                    </button>
                    <button
                      onClick={() => handleDelete(sector.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Saldo</p>
                  {sector.is_emergency_fund && (
                    <span className="badge-warning">Emergência</span>
                  )}
                  {sector.is_investment && (
                    <span className="badge-success">Investimento</span>
                  )}
                </div>
                <p className="text-2xl font-bold" style={{ color: sector.balance >= 0 ? sector.color : '#ef4444' }}>
                  {formatCurrency(sector.balance)}
                </p>
              </div>

              {sector.transactions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Últimas movimentações</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sector.transactions.slice(0, 3).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                          {tx.description}
                        </span>
                        <span
                          className={`font-medium ${
                            tx.type === 'sector_transfer_dest' || (tx.type === 'transfer_source' && tx.transfer_to_expense_sector_id === sector.id)
                              ? 'text-success-600 dark:text-success-400'
                              : 'text-error-600 dark:text-error-400'
                          }`}
                        >
                          {(tx.type === 'sector_transfer_dest' || (tx.type === 'transfer_source' && tx.transfer_to_expense_sector_id === sector.id)) ? '+' : '-'} {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setViewingSector(sector)}
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
                {editingSector ? 'Editar setor' : 'Novo setor'}
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
                  placeholder="Ex: Alimentação, Veículo, Saúde"
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
                  placeholder="Descrição do setor"
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

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_emergency_fund}
                    onChange={(e) => setFormData({ ...formData, is_emergency_fund: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-warning-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Reserva de emergência
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_investment}
                    onChange={(e) => setFormData({ ...formData, is_investment: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Investimento
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingSector ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Details Drawer */}
      {viewingSector && (
        <>
          <div className="drawer-overlay" onClick={() => setViewingSector(null)} />
          <div className="drawer-content p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: viewingSector.color + '20' }}
                >
                  <PiggyBank className="w-6 h-6" style={{ color: viewingSector.color }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{viewingSector.name}</h2>
                  {viewingSector.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{viewingSector.description}</p>
                  )}
                </div>
              </div>
              <button onClick={() => setViewingSector(null)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 mb-6 rounded-lg bg-gray-100 dark:bg-dark-800">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Saldo atual</p>
                {viewingSector.is_emergency_fund && (
                  <span className="badge-warning">Emergência</span>
                )}
                {viewingSector.is_investment && (
                  <span className="badge-success">Investimento</span>
                )}
              </div>
              <p className="text-3xl font-bold" style={{ color: viewingSector.color }}>
                {formatCurrency(viewingSector.balance)}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Histórico de movimentações
              </h3>
              {viewingSector.transactions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {viewingSector.transactions.map((tx) => {
                    const isIncome = tx.type === 'sector_transfer_dest' ||
                      (tx.type === 'transfer_source' && tx.transfer_to_expense_sector_id === viewingSector.id);
                    return (
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
                            isIncome ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'
                          }`}
                        >
                          {isIncome ? '+' : '-'} {formatCurrency(tx.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
