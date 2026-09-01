import React, { useState } from 'react';
import { ShieldCheck, Mail, ArrowRight, KeyRound, CheckCircle2, Lock } from 'lucide-react';
import { Button, Input, Card } from '../common';

export interface AuthProps {
  onLoginSuccess: (method: string) => void;
  onNavigateGuest: () => void;
}

export const LoginPage: React.FC<AuthProps> = ({ onLoginSuccess, onNavigateGuest }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please provide a valid engineering email address.');
      return;
    }
    if (view !== 'forgot' && (!password || password.length < 6)) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (view === 'forgot') {
      setSuccessMsg(`Password reset link sent to ${email}`);
      return;
    }
    onLoginSuccess(view);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-[#f5f7fa] flex items-center justify-center p-4 selection:bg-[#7c5cff]/20">
      {/* Background WebGL / Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#7c5cff]/15 to-[#3b82f6]/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md bg-[#191c22] border border-[#24272f] rounded-2xl shadow-2xl overflow-hidden p-8 flex flex-col gap-6 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7c5cff] to-[#8a74ff] flex items-center justify-center text-white shadow-lg shadow-[#7c5cff]/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#f5f7fa]">
            {view === 'login' && 'BRAG Secure Access'}
            {view === 'signup' && 'Create Developer Account'}
            {view === 'forgot' && 'Reset Access Password'}
          </h1>
          <p className="text-xs text-[#a5adbb]">
            Backend retrieval, diagnostic evidence & agentic guidance
          </p>
        </div>

        {/* OAuth Buttons */}
        {view !== 'forgot' && (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => onLoginSuccess('github')}
              className="flex items-center justify-center gap-3 w-full bg-[#131519] border border-[#24272f] hover:border-[#8a74ff]/50 hover:bg-[#20242c] text-[#f5f7fa] font-medium py-2.5 px-4 rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current text-[#f5f7fa]" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>Continue with GitHub</span>
            </button>
            <button
              onClick={() => onLoginSuccess('google')}
              className="flex items-center justify-center gap-3 w-full bg-[#131519] border border-[#24272f] hover:border-[#3b82f6]/50 hover:bg-[#20242c] text-[#f5f7fa] font-medium py-2.5 px-4 rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.2.0 10.05.0 12s.47 3.8 1.29 5.42l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center my-2">
              <div className="flex-grow border-t border-[#24272f]" />
              <span className="flex-shrink mx-3 text-[11px] font-mono text-[#6c7280] uppercase tracking-wider">
                OR
              </span>
              <div className="flex-grow border-t border-[#24272f]" />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {view === 'signup' && (
            <Input
              label="Full Name"
              placeholder="Vedant Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <Input
            label="Work Email"
            type="email"
            placeholder="engineer@company.com"
            leftIcon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {view !== 'forgot' && (
            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}

          {error && <div className="text-xs text-[#fb7185] bg-[#fb7185]/10 border border-[#fb7185]/20 p-2.5 rounded-lg">{error}</div>}
          {successMsg && (
            <div className="text-xs text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 p-2.5 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {view === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setView('forgot');
                  setError('');
                }}
                className="text-xs text-[#a18dff] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <Button variant="primary" size="md" type="submit" className="w-full mt-2">
            {view === 'login' && 'Sign In to Workbench'}
            {view === 'signup' && 'Create Account'}
            {view === 'forgot' && 'Send Reset Password Instructions'}
          </Button>
        </form>

        {/* Guest Mode Entry & View Toggle */}
        <div className="flex flex-col gap-3 items-center border-t border-[#1b1e24] pt-4 text-xs text-[#a5adbb]">
          {view === 'login' && (
            <>
              <div>
                Don't have an account?{' '}
                <button onClick={() => setView('signup')} className="text-[#8a74ff] hover:underline font-medium">
                  Sign up
                </button>
              </div>
              <button
                onClick={onNavigateGuest}
                className="text-[#6c7280] hover:text-[#f5f7fa] flex items-center gap-1 mt-1 transition-colors"
              >
                <span>Try Guest Trial Console (3 free searches)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}

          {view === 'signup' && (
            <div>
              Already have an account?{' '}
              <button onClick={() => setView('login')} className="text-[#8a74ff] hover:underline font-medium">
                Log in
              </button>
            </div>
          )}

          {view === 'forgot' && (
            <button onClick={() => setView('login')} className="text-[#8a74ff] hover:underline font-medium">
              Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
