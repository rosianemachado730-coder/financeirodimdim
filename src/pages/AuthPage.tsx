import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TrendingUp, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Email ou senha inválidos');
          } else {
            setError(error.message);
          }
        } else {
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password, name);
        if (error) {
          if (error.message.includes('User already registered')) {
            setError('Este email já está cadastrado');
          } else {
            setError(error.message);
          }
        } else {
          setSuccess(true);
        }
      }
    } catch {
      setError('Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 dark:from-dark-900 dark:to-dark-950 px-4">
        <div className="card-elevated p-8 max-w-md w-full text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
            <TrendingUp className="w-8 h-8 text-success-600 dark:text-success-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Conta criada com sucesso!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Você já pode fazer login para acessar sua conta.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setIsLogin(true);
            }}
            className="btn-primary w-full"
          >
            Fazer login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-600 to-primary-800 dark:from-dark-900 dark:to-dark-950 flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">GestFinance</h1>
          </div>
          <p className="text-lg text-white/80 mb-8">
            Controle completo das suas finanças com fontes de renda e centros de custo.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-1">Fontes de Renda</h3>
              <p className="text-sm text-white/70">Organize suas entradas por origem</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <User className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-1">Centros de Custo</h3>
              <p className="text-sm text-white/70">Distribua para onde vai seu dinheiro</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-1">Dashboard Visual</h3>
              <p className="text-sm text-white/70">Gráficos e insights automáticos</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center mb-3">
                <User className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-white mb-1">Metas e Objetivos</h3>
              <p className="text-sm text-white/70">Acompanhe seus objetivos financeiros</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">GestFinance</h1>
          </div>

          <div className="card-elevated p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isLogin ? 'Bem-vindo de volta!' : 'Criar conta'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              {isLogin
                ? 'Entre com suas credenciais para acessar sua conta.'
                : 'Preencha os dados abaixo para criar sua conta.'}
            </p>

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="label">Nome</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input pl-12"
                      placeholder="Seu nome"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-12"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-12"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="label">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pl-12"
                      placeholder="••••••••"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Entrar' : 'Criar conta'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
                >
                  {isLogin ? 'Criar conta' : 'Fazer login'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
