import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-fetch';

const fieldClass =
  'px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get('from') ?? '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, name);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-2xl font-bold tracking-tight text-gradient mb-8">
          9film
        </Link>
        <div className="bg-surface border border-white/10 rounded-2xl p-6 md:p-8">
          <h1 className="text-xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-sm text-zinc-500 mb-6">Save titles and pick up where you left off.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoComplete="name"
              className={fieldClass}
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              className={fieldClass}
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              autoComplete="new-password"
              required
              className={fieldClass}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full">
              {submitting ? 'Creating account…' : 'Sign up'}
            </Button>
          </form>

          <p className="text-sm text-zinc-500 mt-6 text-center">
            Already have an account?{' '}
            <Link
              to={`/login${from !== '/' ? `?from=${encodeURIComponent(from)}` : ''}`}
              className="text-orange-500 hover:text-orange-400 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
