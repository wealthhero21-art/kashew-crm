import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';

export function LoginPage() {
  const { login: setSession } = useAuth();
  const [phase, setPhase] = useState<'credentials' | 'code'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.login(email.trim(), password);
      setPhoneMasked(r.phone_masked);
      setPhase('code');
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      setErr(msg.includes('401') ? 'Invalid email or password.' : msg || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { token, user } = await api.verifyOtpByEmail(email.trim(), code.trim());
      setSession(token, user);
      // Force a route re-eval — RootRedirect picks the destination.
      location.href = '/';
    } catch {
      setErr('Invalid or expired code.');
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <ThemeToggle compact />
        <h1>Kashew CRM</h1>
        {phase === 'credentials' ? (
          <>
            <p className="muted">Sign in with your Kashew CRM account.</p>
            <form onSubmit={submitCredentials}>
              <label>Email</label>
              <input
                type="email"
                placeholder="you@maximoney.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="submit" disabled={busy}>
                {busy ? 'Verifying…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="muted">
              We sent a 6-digit code to your WhatsApp number{' '}
              <strong>{phoneMasked}</strong>. Enter it to finish signing in.
            </p>
            <form onSubmit={submitCode}>
              <label>WhatsApp code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4,8}"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
              />
              <button type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="link"
                onClick={() => { setPhase('credentials'); setCode(''); setErr(null); }}
                disabled={busy}
              >
                Use a different account
              </button>
            </form>
          </>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
}
