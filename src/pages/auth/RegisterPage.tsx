import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Briefcase, ArrowRight, UserCheck, Building, Mail, Lock, User, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<'candidate' | 'recruiter'>('candidate');
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
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms of Service to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(fullName, email, role);
      if (role === 'recruiter') navigate('/recruiter');
      else navigate('/candidate');
    } catch {
      setErrorMessage('Failed to create account. Please verify input fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">HireFlow</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Create your account</h1>
          <p className="text-xs text-slate-400">
            Join the transparent recruitment ecosystem
          </p>
        </div>

        <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
          {/* Persona selector cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setRole('candidate'); setErrorMessage(''); }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                role === 'candidate'
                  ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Candidate</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                I am looking for technical roles and transparent compensation.
              </p>
            </button>

            <button
              type="button"
              onClick={() => { setRole('recruiter'); setErrorMessage(''); }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                role === 'recruiter'
                  ? 'bg-purple-600/15 border-purple-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Building className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-white">Hiring Team</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                I want to publish requisitions and manage talent pipelines.
              </p>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
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
                placeholder="e.g. CloudScale Labs"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                leftIcon={<Building className="w-3.5 h-3.5" />}
              />
            )}

            <Input
              label="Password"
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            />

            <div className="flex items-start gap-2 pt-1 text-xs text-slate-400">
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

          <div className="text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
