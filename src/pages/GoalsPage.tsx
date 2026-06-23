import { useEffect, useState } from 'react';
import { supabase, FinancialGoal, Transaction } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, calculatePercentage } from '../utils/helpers';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Archive,
  TrendingUp,
  Calendar,
  MoreVertical,
  X,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = [
  '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'
];

interface GoalWithProgress extends FinancialGoal {
  currentAmount: number;
  progress: number;
}

export default function GoalsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [contributeModal, setContributeModal] = useState<GoalWithProgress | null>(null);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount: '',
    target_date: '',
    color: COLORS[0],
  });

  const [contributeAmount, setContributeAmount] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [{ data: goalsData }, { data: transactionsData }] = await Promise.all([
        supabase.from('financial_goals').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*'),
      ]);

      const goals = goalsData || [];
      const transactions = transactionsData || [];

      const goalsWithProgress = goals.map((goal) => {
        const contributions = transactions
          .filter((t) => t.goal_contribution_id === goal.id)
          .reduce((sum, t) => sum + t.amount, 0);

        const progress = calculatePercentage(contributions, goal.target_amount);

        return {
          ...goal,
          currentAmount: contributions,
          progress: Math.min(progress, 100),
        };
      });

      setGoals(goalsWithProgress);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const targetAmount = parseFloat(formData.target_amount);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      setError('Valor inválido');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingGoal) {
        const { error } = await supabase
          .from('financial_goals')
          .update({
            name: formData.name,
            description: formData.description || null,
            target_amount: targetAmount,
            target_date: formData.target_date || null,
            color: formData.color,
          })
          .eq('id', editingGoal.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_goals').insert({
          name: formData.name,
          description: formData.description || null,
          target_amount: targetAmount,
          target_date: formData.target_date || null,
          color: formData.color,
        });

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving goal:', err);
      setError('Erro ao salvar meta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !contributeModal) return;

    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Valor inválido');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('transactions').insert({
        type: 'expense',
        amount,
        description: `Contribuição para meta: ${contributeModal.name}`,
        goal_contribution_id: contributeModal.id,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      });

      if (error) throw error;

      // Check if goal is completed
      const newAmount = contributeModal.currentAmount + amount;
      if (newAmount >= contributeModal.target_amount) {
        const { error: completeError } = await supabase
          .from('financial_goals')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', contributeModal.id);
        if (completeError) throw completeError;
      }

      setContributeModal(null);
      setContributeAmount('');
      fetchData();
    } catch (err) {
      console.error('Error contributing:', err);
      setError('Erro ao contribuir. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('financial_goals').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error deleting goal:', err);
      setError('Erro ao excluir meta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('financial_goals')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error archiving goal:', err);
      setError('Erro ao arquivar meta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const restoreGoal = async (id: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('financial_goals')
        .update({ archived_at: null, completed_at: null })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error restoring goal:', err);
      setError('Erro ao restaurar meta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      target_amount: '',
      target_date: '',
      color: COLORS[0],
    });
    setEditingGoal(null);
  };

  const openEditModal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      description: goal.description || '',
      target_amount: goal.target_amount.toString(),
      target_date: goal.target_date || '',
      color: goal.color,
    });
    setShowModal(true);
  };

  const activeGoals = goals.filter((g) => !g.archived_at && !g.completed_at);
  const completedGoals = goals.filter((g) => g.completed_at);
  const archivedGoals = goals.filter((g) => g.archived_at && !g.completed_at);

  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metas Financeiras</h1>
          <p className="text-gray-600 dark:text-gray-400">Acompanhe seus objetivos financeiros</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Nova meta
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Metas ativas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeGoals.length}</p>
        </div>

        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total economizado</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400">
            {formatCurrency(totalSaved)}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Falta para as metas</p>
          <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">
            {formatCurrency(totalTarget - totalSaved)}
          </p>
        </div>
      </div>

      {/* Active Goals */}
      {activeGoals.length === 0 ? (
        <div className="card p-12">
          <div className="empty-state">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="empty-state-title">Nenhuma meta cadastrada</h3>
            <p className="empty-state-description">
              Defina suas metas financeiras para acompanhar seu progresso.
            </p>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary mt-4">
              <Plus className="w-5 h-5" />
              Criar meta
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGoals.map((goal) => {
            const daysRemaining = goal.target_date
              ? differenceInDays(parseISO(goal.target_date), new Date())
              : null;

            const isOverdue = goal.target_date && isAfter(new Date(), parseISO(goal.target_date));

            return (
              <div key={goal.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: goal.color + '20' }}
                    >
                      <Target className="w-6 h-6" style={{ color: goal.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                      {goal.target_date && (
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span className={isOverdue ? 'text-error-600 dark:text-error-400' : ''}>
                            {format(parseISO(goal.target_date), 'MMM yyyy', { locale: ptBR })}
                            {daysRemaining !== null && daysRemaining > 0 && ` (${daysRemaining} dias)`}
                            {isOverdue && ' (Vencida)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative group">
                    <button className="btn-icon">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-white dark:bg-dark-800 shadow-lg ring-1 ring-gray-200 dark:ring-dark-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={() => setContributeModal(goal)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20"
                      >
                        <TrendingUp className="w-4 h-4" />
                        Contribuir
                      </button>
                      <button
                        onClick={() => openEditModal(goal)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleArchive(goal.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20"
                      >
                        <Archive className="w-4 h-4" />
                        Arquivar
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="progress-bar mb-2">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${goal.progress}%`, backgroundColor: goal.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(goal.currentAmount)}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {goal.progress}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Meta</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(goal.target_amount)}
                  </span>
                </div>

                <button
                  onClick={() => setContributeModal(goal)}
                  className="btn-primary w-full mt-4"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar contribuição
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Metas alcançadas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedGoals.map((goal) => (
              <div
                key={goal.id}
                className="card p-5 border-2 border-success-200 dark:border-success-800 bg-success-50/50 dark:bg-success-900/10"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                    <p className="text-sm text-success-600 dark:text-success-400">
                      Alcançada em {goal.completed_at && format(parseISO(goal.completed_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total economizado</span>
                  <span className="font-semibold text-success-600 dark:text-success-400">
                    {formatCurrency(goal.target_amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Goals */}
      {archivedGoals.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {showArchived ? 'Ocultar' : 'Mostrar'} metas arquivadas ({archivedGoals.length})
          </button>

          {showArchived && (
            <div className="mt-4 space-y-2 opacity-60">
              {archivedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="card p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{goal.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(goal.currentAmount)} de {formatCurrency(goal.target_amount)}
                    </p>
                  </div>
                  <button onClick={() => restoreGoal(goal.id)} className="btn-ghost text-sm">
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingGoal ? 'Editar meta' : 'Nova meta financeira'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nome da meta</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Comprar moto, Viagem, Casa própria"
                  required
                />
              </div>

              <div>
                <label className="label">Valor da meta</label>
                <input
                  type="number"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="input"
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="label">Data alvo (opcional)</label>
                <input
                  type="date"
                  value={formData.target_date}
                  onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  className="input"
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

              <div>
                <label className="label">Descrição (opcional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input resize-none"
                  rows={2}
                  placeholder="Descrição da meta..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {editingGoal ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Contribute Modal */}
      {contributeModal && (
        <>
          <div className="modal-overlay" onClick={() => setContributeModal(null)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Contribuir para {contributeModal.name}
              </h2>
              <button onClick={() => setContributeModal(null)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 mb-4 rounded-lg bg-gray-100 dark:bg-dark-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Progresso atual</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {contributeModal.progress}%
                </span>
              </div>
              <div className="progress-bar mb-2">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${contributeModal.progress}%`, backgroundColor: contributeModal.color }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {formatCurrency(contributeModal.currentAmount)}
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatCurrency(contributeModal.target_amount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="label">Valor da contribuição</label>
                <input
                  type="number"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="input"
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                  <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setContributeModal(null)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  <TrendingUp className="w-5 h-5" />
                  {submitting ? 'Salvando...' : 'Contribuir'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
