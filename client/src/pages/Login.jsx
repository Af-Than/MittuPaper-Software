import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import Logo from '../components/Logo';
import { Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';

export default function Login() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  if (admin) return <Navigate to={location.state?.from || '/'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.username.trim()) errs.username = 'Enter your username';
    if (!form.password) errs.password = 'Enter your password';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login(form.username.trim(), form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div>
          <h2 className="t-page text-center">Administrator sign in</h2>
          <p className="mt-1 text-center text-sm text-ink-muted">Use the credentials issued to you. Accounts cannot be self-registered.</p>

          <form onSubmit={submit} noValidate className="card mt-6 space-y-4 p-6">
            {formError && (
              <div role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{formError}</div>
            )}
            <Field label="Username" error={errors.username} required>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <input className="input pl-9" autoComplete="username" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
            </Field>
            <Field label="Password" error={errors.password} required>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <input className="input px-9" type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
              <LogIn className="h-4 w-4" aria-hidden /> {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-muted">Sign-ins are recorded in the activity log.</p>
        </div>
      </div>
    </div>
  );
}
