import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/api';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Briefcase, ArrowRight, UserCheck, Building, Mail, Lock, User, AlertCircle } from 'lucide-react';

/** Mirrors the server-side password policy (letters + digits, 8-72 bytes). */
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (new TextEncoder().encode(password).length > 72)
    return 'Password must be at most 72 bytes long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return 'Password must contain both letters and numbers.';
  return null;
}

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<'candidate' | 'recruiter'>(
    searchParams.get('role') === 'recruiter' ? 'recruiter' : 'candidate'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal or professional name.');
      return;
    }
    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }
    if (role === 'recruiter' && !companyName.trim()) {
      setErrorMessage('Please enter your company or employer name.');
      return;
    }
    const passwordProblem = validatePassword(password);
    if (passwordProblem) {
      setErrorMessage(passwordProblem);
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms of Service to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        companyName: role === 'recruiter' ? companyName.trim() : undefined,
      });
      // Registration does not create a session; send the user to sign in with
      // the credentials they just chose.
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.firstFieldError ?? error.message);
      } else {
        setErrorMessage('Failed to create account. Please verify your details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">HireFlow</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create your account</h1>
          <p className="text-xs text-slate-500">
            Join the transparent recruitment ecosystem
          </p>
        </div>

        <div className="p-6 md:p-8 rounded-2xl glass-panel-strong space-y-6">
          {/* Persona selector cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setRole('candidate'); setErrorMessage(''); }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                role === 'candidate'
                  ? 'bg-blue-50/80 border-blue-400 text-slate-900 shadow-sm'
                  : 'bg-white/60 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-900">Candidate</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                I am looking for technical roles and transparent compensation.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setRole('recruiter'); setErrorMessage(''); }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                role === 'recruiter'
                  ? 'bg-violet-50/80 border-violet-400 text-slate-900 shadow-sm'
                  : 'bg-white/60 border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Building className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-bold text-slate-900">Hiring Team</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                I want to publish requisitions and manage talent pipelines.
              </p>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              required
              placeholder="e.g. Taylor Reed"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-3.5 h-3.5" />}
            />

            <Input
              label="Work Email Address"
              type="email"
              required
              placeholder="taylor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-3.5 h-3.5" />}
            />

            {role === 'recruiter' && (
              <Input
                label="Company or Entity Name"
                type="text"
                required
                placeholder="e.g. Acme Technologies"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                leftIcon={<Building className="w-3.5 h-3.5" />}
              />
            )}

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="At least 8 characters, letters and numbers"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            />

            <div className="flex items-start gap-2 pt-1 text-xs text-slate-500">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 accent-blue-600 rounded cursor-pointer"
              />
              <label htmlFor="terms" className="cursor-pointer select-none">
                I agree to the HireFlow Terms of Service and Privacy Policy.
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isSubmitting}
            >
              <span>Create {role === 'recruiter' ? 'Recruiter' : 'Candidate'} Account</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
