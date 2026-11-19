import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Wallet,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';

type AuthMode = 'login' | 'register';

function mapAuthErrorToSpanish(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con correo y contraseña aún no está habilitado en Firebase Console (Authentication > Sign-in method > Correo electrónico/contraseña). Puedes entrar rápido con Google o habilitarlo en la consola.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo. Cambia a "Iniciar sesión".';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera un momento antes de volver a intentarlo.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de Google antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'Tu navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes e intenta de nuevo.';
    case 'auth/network-request-failed':
      return 'No hay conexión con el servidor de autenticación. Revisa tu internet.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'No fue posible iniciar sesión. Intenta nuevamente.';
  }
}

interface AuthScreenProps {
  onPendingName?: (name: string) => void;
}

export function AuthScreen({ onPendingName }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMessage(mapAuthErrorToSpanish(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (mode === 'register' && cleanName.length < 2) {
      setErrorMessage('Ingresa tu nombre para personalizar tu cuenta.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        onPendingName?.(cleanName);
        const credential = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );
        if (cleanName) {
          await updateProfile(credential.user, { displayName: cleanName });
        }
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (err) {
      onPendingName?.('');
      setErrorMessage(mapAuthErrorToSpanish(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#0B1739] flex flex-col justify-center items-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px]"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#0B1739] text-white flex items-center justify-center shadow-md mb-3">
            <Wallet className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-[#0B1739]">
            Mi Presupuesto Mensual
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Controla tus gastos en COP de forma privada y segura
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-[0_18px_40px_-16px_rgba(11,23,57,0.12)] p-6 sm:p-8 space-y-5">
          {/* Mode Tabs */}
          <div
            className="grid grid-cols-2 p-1 bg-slate-100 rounded-full"
            role="tablist"
            aria-label="Modo de acceso"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => handleModeChange('login')}
              className={`h-9 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#0B1739] shadow-xs'
                  : 'text-slate-500 hover:text-[#0B1739]'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => handleModeChange('register')}
              className={`h-9 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#0B1739] shadow-xs'
                  : 'text-slate-500 hover:text-[#0B1739]'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Quick Google Sign-In */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleGoogleSignIn()}
            className="w-full h-11 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-[#0B1739] text-sm font-semibold shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            <svg
              className="w-4 h-4 shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Entrar rápido con Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
              o con tu correo
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800 flex items-start gap-2.5 leading-relaxed"
            >
              <AlertCircle
                className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email + Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-semibold text-[#0B1739] mb-1.5"
                >
                  Tu nombre
                </label>
                <div className="relative">
                  <User
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isSubmitting}
                    maxLength={80}
                    placeholder="Ej. Camila Gómez"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-[#0B1739] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-semibold text-[#0B1739] mb-1.5"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-[#0B1739] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[#0B1739] mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    mode === 'register' ? 'new-password' : 'current-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl text-[#0B1739] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#5B3DF5]/20 focus:border-[#5B3DF5]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0B1739] p-1 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-full bg-[#5B3DF5] hover:bg-[#492CE0] text-white text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting
                ? 'Ingresando...'
                : mode === 'register'
                ? 'Crear mi cuenta'
                : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Cada cuenta tiene su propio espacio privado. Tus registros solo son
          visibles para ti.
        </p>
      </motion.div>
    </div>
  );
}
