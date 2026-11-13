import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Briefcase, ArrowRight, ShieldCheck, UserCheck, Lock, Mail, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<UserRole>('candidate');
  const [email, setEmail] = useState('alex.morgan@example.com');
  const [password, setPassword] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMessage('');
    if (role === 'candidate') setEmail('alex.morgan@example.com');
    if (role === 'recruiter') setEmail('sarah.chen@cloudscale.example.com');
    if (role === 'admin') setEmail('admin@hireflow.internal');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(selectedRole, email);
      if (selectedRole === 'admin') navigate('/admin');
      else if (selectedRole === 'recruiter') navigate('/recruiter');
      else navigate('/candidate');
    } catch {
      setErrorMessage('Unable to authenticate with the provided credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async (role: UserRole) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await login(role);
      if (role === 'admin') navigate('/admin');
      else if (role === 'recruiter') navigate('/recruiter');
      else navigate('/candidate');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">HireFlow</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Sign in to your account</h1>
          <p className="text-xs text-slate-400">
            Enterprise recruitment portal · Candidate, Recruiter & Admin access
          </p>
        </div>

        {/* 1-Click Instant Persona Sign-In Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Fast Reviewer Access (1-Click Demo)</span>
            <span className="text-blue-400 font-mono text-[10px]">Instant Sign-In</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('candidate')}
              className="p-2.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs cursor-pointer"
            >
              <div className="font-semibold text-white">Candidate</div>
              <div className="text-[10px] text-slate-400 truncate">Alex Morgan</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('recruiter')}
              className="p-2.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs cursor-pointer"
            >
              <div className="font-semibold text-white">Recruiter</div>
              <div className="text-[10px] text-slate-400 truncate">Sarah Chen</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="p-2.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs cursor-pointer"
            >
              <div className="font-semibold text-white">Admin</div>
              <div className="text-[10px] text-slate-400 truncate">Marcus Vance</div>
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <div className="p-6 md:p-7 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          {/* Role selector tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {(['candidate', 'recruiter', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                  selectedRole === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Work Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              placeholder="name@company.com"
            />

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-300">
                  Password <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-blue-400 hover:underline cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <Lock className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isSubmitting}
            >
              <span>Sign In to {selectedRole} Account</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-1">
            Need an account?{' '}
            <Link to="/register" className="text-blue-400 font-semibold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
