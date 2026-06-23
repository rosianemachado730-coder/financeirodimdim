import { useEffect, useState } from 'react';
import { supabase, RecurringBill, Transaction, ExpenseSector } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, isOverdue, isDueSoon } from '../utils/helpers';
import {
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  X,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, parseISO, isWithinInterval, startOfToday, addDays, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RecurringBillsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [sectors, setSectors] = useState<ExpenseSector[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [payingBill, setPayingBill] = useState<RecurringBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    due_day: '10',
    expense_sector_id: '',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [{ data: billsData }, { data: sectorsData }] = await Promise.all([
        supabase.from('recurring_bills').select('*').order('due_day'),
        supabase.from('expense_sectors').select('*').is('archived_at', null),
      ]);

      setBills(billsData || []);
      setSectors(sectorsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
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

    const dueDay = parseInt(formData.due_day);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      setError('Dia de vencimento inválido');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingBill) {
        const { error } = await supabase
          .from('recurring_bills')
          .update({
            name: formData.name,
            description: formData.description || null,
            amount,
            due_day: dueDay,
            expense_sector_id: formData.expense_sector_id || null,
          })
          .eq('id', editingBill.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('recurring_bills').insert({
          name: formData.name,
          description: formData.description || null,
          amount,
          due_day: dueDay,
          expense_sector_id: formData.expense_sector_id || null,
          is_active: true,
        });

        if (error) throw error;
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving bill:', err);
      setError('Erro ao salvar conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.from('recurring_bills').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error deleting bill:', err);
      setError('Erro ao excluir conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (bill: RecurringBill) => {
    setSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('recurring_bills')
        .update({ is_active: !bill.is_active })
        .eq('id', bill.id);

      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Error toggling bill:', err);
      setError('Erro ao atualizar conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !payingBill) return;

    setSubmitting(true);
    setError(null);

    try {
      // Create expense transaction
      const { error: txError } = await supabase.from('transactions').insert({
        type: 'expense',
        amount: payingBill.amount,
        description: `${payingBill.name} - ${format(new Date(), 'MMMM yyyy', { locale: ptBR })}`,
        expense_sector_id: payingBill.expense_sector_id,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      });

      if (txError) throw txError;

      // Update last_paid_at
      const { error: updateError } = await supabase
        .from('recurring_bills')
        .update({ last_paid_at: new Date().toISOString() })
        .eq('id', payingBill.id);

      if (updateError) throw updateError;

      setPayingBill(null);
      fetchData();
    } catch (err) {
      console.error('Error paying bill:', err);
      setError('Erro ao pagar conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      amount: '',
      due_day: '10',
      expense_sector_id: '',
    });
    setEditingBill(null);
  };

  const openEditModal = (bill: RecurringBill) => {
    setEditingBill(bill);
    setFormData({
      name: bill.name,
      description: bill.description || '',
      amount: bill.amount.toString(),
      due_day: bill.due_day.toString(),
      expense_sector_id: bill.expense_sector_id || '',
    });
    setShowModal(true);
  };

  const getBillStatus = (bill: RecurringBill) => {
    if (!bill.is_active) return 'inactive';

    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.due_day);

    if (bill.last_paid_at) {
      const lastPaid = parseISO(bill.last_paid_at);
      if (isSameMonth(lastPaid, now)) return 'paid';
    }

    if (isOverdue(dueDate)) return 'overdue';
    if (isDueSoon(dueDate, 7)) return 'due_soon';
    return 'pending';
  };

  const activeBills = bills.filter((b) => b.is_active);
  const inactiveBills = bills.filter((b) => !b.is_active);

  const totalDue = activeBills.reduce((sum, b) => sum + b.amount, 0);

  const overdueBills = activeBills.filter((b) => getBillStatus(b) === 'overdue');
  const dueSoonBills = activeBills.filter((b) => getBillStatus(b) === 'due_soon');

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contas Recorrentes</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie suas contas mensais</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-5 h-5" />
          Nova conta
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Contas ativas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeBills.length}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Vencidas</span>
          </div>
          <p className="text-2xl font-bold text-error-600 dark:text-error-400">{overdueBills.length}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Vencendo em 7 dias</span>
          </div>
          <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{dueSoonBills.length}</p>
        </div>

        <div className="card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total do mês</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalDue)}</p>
        </div>
      </div>

      {/* Alerts */}
      {overdueBills.length > 0 && (
        <div className="card p-4 border-l-4 border-l-error-500 bg-error-50 dark:bg-error-900/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400" />
            <h3 className="font-semibold text-error-700 dark:text-error-400">Contas vencidas</h3>
          </div>
          <div className="space-y-2">
            {overdueBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between">
                <span className="text-error-700 dark:text-error-400">
                  {bill.name} - Vence dia {bill.due_day}
                </span>
                <button onClick={() => setPayingBill(bill)} className="btn-danger text-sm py-1 px-3">
                  Pagar agora
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Bills */}
      {activeBills.length === 0 ? (
        <div className="card p-12">
          <div className="empty-state">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="empty-state-title">Nenhuma conta recorrente</h3>
            <p className="empty-state-description">
              Adicione suas contas fixas mensais para acompanhar vencimentos.
            </p>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary mt-4">
              <Plus className="w-5 h-5" />
              Adicionar conta
            </button>
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-gray-200 dark:divide-dark-700">
          {activeBills.map((bill) => {
            const status = getBillStatus(bill);
            const sector = sectors.find((s) => s.id === bill.expense_sector_id);

            return (
              <div key={bill.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-dark-800">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      status === 'paid'
                        ? 'bg-success-100 dark:bg-success-900/30'
                        : status === 'overdue'
                        ? 'bg-error-100 dark:bg-error-900/30'
                        : status === 'due_soon'
                        ? 'bg-warning-100 dark:bg-warning-900/30'
                        : 'bg-gray-100 dark:bg-dark-800'
                    }`}
                  >
                    {status === 'paid' ? (
                      <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
                    ) : status === 'overdue' ? (
                      <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400" />
                    ) : status === 'due_soon' ? (
                      <Clock className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                    ) : (
                      <CalendarIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{bill.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>Todo dia {bill.due_day}</span>
                      {sector && (
                        <>
                          <span>•</span>
                          <span>{sector.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(bill.amount)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        status === 'paid'
                          ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                          : status === 'overdue'
                          ? 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400'
                          : status === 'due_soon'
                          ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400'
                          : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {status === 'paid'
                        ? 'Pago'
                        : status === 'overdue'
                        ? 'Vencido'
                        : status === 'due_soon'
                        ? 'Vence em breve'
                        : 'Pendente'}
                    </span>
                  </div>

                  <div className="relative group">
                    <button className="btn-icon">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-white dark:bg-dark-800 shadow-lg ring-1 ring-gray-200 dark:ring-dark-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      {status !== 'paid' && (
                        <button
                          onClick={() => setPayingBill(bill)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Marcar pago
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(bill)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(bill)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20"
                      >
                        <Clock className="w-4 h-4" />
                        Pausar
                      </button>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inactive Bills */}
      {inactiveBills.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contas pausadas</h2>
          <div className="card divide-y divide-gray-200 dark:divide-dark-700 opacity-60">
            {inactiveBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-dark-800 flex items-center justify-center">
                    <CalendarIcon className="w-5 h-5 text-gray-400 dark:text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{bill.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Todo dia {bill.due_day} • {formatCurrency(bill.amount)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(bill)}
                  className="btn-ghost text-sm"
                >
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingBill ? 'Editar conta' : 'Nova conta recorrente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nome da conta</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Luz, Internet, Aluguel"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <label className="label">Dia de vencimento</label>
                  <input
                    type="number"
                    value={formData.due_day}
                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                    className="input"
                    min="1"
                    max="31"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Setor (opcional)</label>
                <select
                  value={formData.expense_sector_id}
                  onChange={(e) => setFormData({ ...formData, expense_sector_id: e.target.value })}
                  className="select"
                >
                  <option value="">Nenhum setor</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Descrição (opcional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input resize-none"
                  rows={2}
                  placeholder="Observações..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Salvando...' : editingBill ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Pay Bill Modal */}
      {payingBill && (
        <>
          <div className="modal-overlay" onClick={() => setPayingBill(null)} />
          <div className="modal-content p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Confirmar pagamento</h2>
              <button onClick={() => setPayingBill(null)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 mb-4 rounded-lg bg-gray-100 dark:bg-dark-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Conta</p>
              <p className="font-semibold text-gray-900 dark:text-white">{payingBill.name}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {formatCurrency(payingBill.amount)}
              </p>
            </div>

            <form onSubmit={handlePayBill}>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Este pagamento será registrado como despesa no setor{' '}
                {sectors.find((s) => s.id === payingBill.expense_sector_id)?.name || 'sem setor'}.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                  <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPayingBill(null)} className="btn-secondary flex-1" disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  <CheckCircle className="w-5 h-5" />
                  {submitting ? 'Processando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
