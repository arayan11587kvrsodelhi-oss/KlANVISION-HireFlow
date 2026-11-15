import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { homePathForRole } from '../../utils/roles';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Briefcase, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

/**
 * Sign-in form.
 *
 * The role is not selected here: the backend decides it from the account record
 * and `/auth/me` reports it. (Previously this page let the visitor pick
 * "admin" and dropped the password entirely.) The prefilled demo credentials
 * and the "1-click persona" buttons are gone for the same reason.
 */
export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const redirectTarget = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      const safeRedirect =
        redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')
          ? redirectTarget
          : homePathForRole(user.role);
      navigate(safeRedirect, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(
          error.status === 0
            ? error.message
            : error.message || 'Unable to sign in with those credentials.'
        );
      } else {
        setErrorMessage('Unable to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">HireFlow</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sign in to your account</h1>
          <p className="text-xs text-slate-500">
            Your role (candidate, recruiter or administrator) is assigned to your account by HireFlow.
          </p>
        </div>

        <div className="p-6 md:p-7 rounded-2xl glass-panel-strong space-y-5">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email Address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              placeholder="name@company.com"
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-3.5 h-3.5" />}
              placeholder="Your password"
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isSubmitting}
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-1">
            Need an account?{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
