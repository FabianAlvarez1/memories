// =========================================================
// LOGIN PAGE — First run: Register / Returning: Login
// =========================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/services/database/connection';
import { UserRepository } from '@/services/database/repositories/UserRepository';
import { useAuthStore } from '@/store/useAuthStore';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, setLoading, setError, isLoading, error } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  // Check if user exists to decide login vs register
  useEffect(() => {
    async function checkUser() {
      await db.initialize();
      const exists = await UserRepository.hasUser();
      setHasUser(exists);
      setMode(exists ? 'login' : 'register');
    }
    checkUser();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setLocalError('Las contraseñas no coinciden.');
          setLoading(false);
          return;
        }
        if (password.length < 10) {
          setLocalError('La contraseña debe tener al menos 10 caracteres.');
          setLoading(false);
          return;
        }

        const { user, salt } = await UserRepository.register(username, password);
        // Derive key after register
        const { deriveKey } = await import('@/services/crypto/keyDerivation');
        const cryptoKey = await deriveKey(password, salt);
        setAuth(user, cryptoKey);
        navigate('/brain');

      } else {
        const result = await UserRepository.login(password);
        if (!result) {
          setLocalError('Contraseña incorrecta.');
          setLoading(false);
          return;
        }
        setAuth(result.user, result.cryptoKey);
        navigate('/brain');
      }
    } catch (err) {
      setLocalError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (hasUser === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-black">
        <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center relative overflow-hidden bg-black text-white selection:bg-[#00d4bf]/30">

      {/* Industrial Grid Background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      }} aria-hidden />

      {/* Vercel-like Top Gradient (optional, very subtle) */}
      <div className="absolute top-0 inset-x-0 h-[300px] pointer-events-none" style={{
        background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.05) 0%, transparent 70%)',
      }} aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[380px] px-4 z-10"
      >
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <NeuronIcon />
            <span className="text-[22px] font-semibold tracking-tight text-white">
              Memories
            </span>
          </div>
          <p className="text-[14px] text-white/50">
            {mode === 'register'
              ? 'Crea tu espacio personal y privado.'
              : `Bienvenido de nuevo.`}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Username — only on register */}
            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.div
                  key="username"
                  initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <FieldLabel htmlFor="username">Nombre de usuario</FieldLabel>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="tu_nombre"
                    required={mode === 'register'}
                    autoComplete="username"
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Password */}
            <div>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 10 caracteres' : '••••••••••'}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold tracking-wider text-white/40 hover:text-white/80 transition-colors bg-black px-1"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'OCULTAR' : 'VER'}
                </button>
              </div>
            </div>

            {/* Confirm password — only on register */}
            <AnimatePresence initial={false}>
              {mode === 'register' && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <div className="pt-2">
                    <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••"
                      required={mode === 'register'}
                      autoComplete="new-password"
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {(localError || error) && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-1"
                >
                  <p className="text-[#F0A19D] text-[13px] text-center py-2 px-3 bg-[#F2403D]/10 rounded-lg border border-[#F2403D]/20">
                    {localError || error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              id="btn-submit-auth"
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-black font-medium text-[14px] rounded-lg py-2.5 mt-2 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {isLoading
                ? 'Procesando...'
                : mode === 'register' ? 'Crear mi espacio' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Security note on register */}
        {mode === 'register' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-center"
          >
            <p className="text-[12px] text-white/40 leading-relaxed">
              <span className="inline-block mb-1">🔒 Tu contraseña cifra tus memorias localmente.</span><br/>
              <strong className="text-white/60 font-medium">Si la olvidas, no podrás recuperar tus datos.</strong>
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ---- Sub-components ----

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5 text-[13px] font-medium text-white/70">
      {children}
    </label>
  );
}

function NeuronIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="4.5" fill="#fff" fillOpacity="0.9"/>
      <line x1="14" y1="9.5" x2="14" y2="2" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="14" y1="18.5" x2="14" y2="26" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="9.5" y1="14" x2="2" y2="14" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="18.5" y1="14" x2="26" y2="14" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="10.8" y1="10.8" x2="4" y2="4" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.5"/>
      <line x1="17.2" y1="17.2" x2="24" y2="24" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.5"/>
      <line x1="17.2" y1="10.8" x2="24" y2="4" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.5"/>
      <line x1="10.8" y1="17.2" x2="4" y2="24" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.5"/>
    </svg>
  );
}
