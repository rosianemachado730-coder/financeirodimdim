import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  Settings as SettingsIcon,
  User,
  Sun,
  Moon,
  Globe,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({ name });
      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-600 dark:text-gray-400">Personalize sua experiência</p>
      </div>

      {/* Profile Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Perfil</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Suas informações pessoais</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={profile?.user_id ? 'Disponível após login' : ''}
              className="input bg-gray-100 dark:bg-dark-800 cursor-not-allowed"
              disabled
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              O email não pode ser alterado
            </p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              'Salvo!'
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            ) : (
              <Sun className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Aparência</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Escolha o tema da aplicação</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border-2 transition-all ${
              theme === 'light'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
            }`}
          >
            <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-gray-100 dark:bg-dark-700 mb-3">
              <Sun className="w-5 h-5 text-warning-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Modo claro</p>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border-2 transition-all ${
              theme === 'dark'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
            }`}
          >
            <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg bg-dark-800 mb-3">
              <Moon className="w-5 h-5 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Modo escuro</p>
          </button>
        </div>
      </div>

      {/* Account Actions */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-error-600 dark:text-error-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Conta</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie sua conta</p>
          </div>
        </div>

        <div className="space-y-4">
          <button onClick={signOut} className="btn-danger w-full">
            Sair da conta
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Seus dados são salvos automaticamente e sincronizados entre dispositivos.
          </p>
        </div>
      </div>

      {/* App Info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-800 flex items-center justify-center">
            <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Sobre</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">GestFinance</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>Versão 1.0.0</p>
          <p>Desenvolvido com React, TypeScript e Supabase</p>
        </div>
      </div>
    </div>
  );
}
