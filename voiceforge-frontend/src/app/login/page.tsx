"use client";
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import api from '@/lib/api';
import logo from '@/assets/linguamicorange copy.png';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 'login' | 'forgot' | 'reset'
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (typeof err === 'object' && err !== null) {
      const maybe = err as { response?: { data?: { error?: string } } };
      return maybe.response?.data?.error || fallback;
    }
    return fallback;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      router.push('/studio');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = useGoogleLogin({
    // Explicit scopes so the access token always carries email + profile,
    // otherwise Google may issue a token whose userinfo endpoint returns no
    // email and the backend rejects the login.
    scope: 'openid email profile',
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const res = await api.post('/auth/google', { credential: tokenResponse.access_token });
        localStorage.setItem('token', res.data.token);
        router.push('/studio');
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Google login failed'));
        setLoading(false);
      }
    },
    onError: () => setError('Google login failed')
  });

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSuccess(res.data.message);
      setMode('reset');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to send reset code'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode.length !== 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword.length > 128) {
      setError('Password must be under 128 characters.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/reset-password', { email, code: resetCode, newPassword });
      setSuccess(res.data.message);
      setMode('login');
      setPassword('');
      setResetCode('');
      setNewPassword('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] font-sans relative flex items-center justify-center overflow-hidden selection:bg-orange-500/30 py-12 px-4">
      
      {/* Soft Ambient Background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-gradient-to-bl from-orange-400/10 to-transparent rounded-full blur-[120px] animate-[pulse_9s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tr from-amber-400/10 to-transparent rounded-full blur-[120px] animate-[pulse_11s_ease-in-out_infinite]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L3N2Zz4=')] opacity-50 z-0 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[440px] relative z-10"
      >
        {/* Sleek Welcome floating badge */}
        <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-orange-100 shadow-[0_8px_16px_-6px_rgba(249,115,22,0.15)]"
          >
            <PlayCircle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-neutral-800">Your studio is ready.</span>
          </motion.div>
        </div>

        {/* Main Auth Card */}
        <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05),_inset_0_1px_1px_rgba(255,255,255,1)] border border-white">
          
          <div className="flex flex-col items-center text-center mb-10">
            <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-[0_8px_20px_-6px_rgba(249,115,22,0.25)] border border-orange-100 mb-6 hover:scale-105 transition-transform">
              <Image src={logo} alt="LinguaMic" className="w-9 h-9 object-contain" priority />
            </Link>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 tracking-tight mb-2">
              {mode === 'login' && 'Welcome back'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'Enter Reset Code'}
            </h1>
            <p className="text-neutral-500 text-sm">
              {mode === 'login' && 'Sign in to continue to your studio.'}
              {mode === 'forgot' && 'Enter your email to receive a reset code.'}
              {mode === 'reset' && 'Enter the 6-digit code sent to your email.'}
            </p>
          </div>

          {mode === 'login' && (
            <>
              <button onClick={() => loginGoogle()} disabled={loading} className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-neutral-50 border border-black/10 rounded-xl text-neutral-700 font-medium transition-all shadow-sm group">
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.02 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>

              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-black/5" />
                <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-black/5" />
              </div>
            </>
          )}

          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg text-center font-medium">{success}</div>}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide ml-1">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-12 bg-white/50 border border-black/10 rounded-xl px-4 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all focus:bg-white" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide">Password</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} className="text-xs text-orange-600 font-medium hover:text-orange-500">Forgot?</button>
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full h-12 bg-white/50 border border-black/10 rounded-xl px-4 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all focus:bg-white" />
              </div>
              
              <button type="submit" disabled={loading} className="w-full h-12 bg-black text-white rounded-xl font-medium mt-6 hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 group shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? 'Signing in...' : 'Sign In'} <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide ml-1">Account Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-12 bg-white/50 border border-black/10 rounded-xl px-4 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all focus:bg-white" />
              </div>
              
              <button type="submit" disabled={loading} className="w-full h-12 bg-black text-white rounded-xl font-medium mt-6 hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 group shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? 'Sending...' : 'Send Reset Code'} <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="w-full text-center text-sm font-medium text-neutral-500 hover:text-neutral-800 transition-colors mt-4">
                Back to sign in
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide ml-1">6-Digit Code</label>
                <input type="text" required maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="w-full h-12 bg-white/50 border border-black/10 rounded-xl px-4 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all focus:bg-white text-center tracking-[0.5em] font-mono text-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide ml-1">New Password</label>
                <input type="password" required minLength={8} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className="w-full h-12 bg-white/50 border border-black/10 rounded-xl px-4 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all focus:bg-white" />
              </div>
              
              <button type="submit" disabled={loading} className="w-full h-12 bg-black text-white rounded-xl font-medium mt-6 hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 group shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)] disabled:opacity-70 disabled:cursor-not-allowed">
                {loading ? 'Resetting...' : 'Reset Password'} <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} className="w-full text-center text-sm font-medium text-neutral-500 hover:text-neutral-800 transition-colors mt-4">
                Send another code
              </button>
            </form>
          )}

          {mode === 'login' && (
            <p className="text-center mt-8 text-sm text-neutral-500">
              Don&apos;t have an account? <Link href="/register" className="text-orange-600 font-semibold hover:text-orange-500 transition-colors">Sign up</Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
