import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { QuickRoleSwitcher } from '../components/common/QuickRoleSwitcher';
import { homePathForRole } from '../utils/roles';
import { ArrowRight, Briefcase } from 'lucide-react';

export const PublicLayout: React.FC = () => {
  const { user, role } = useAuth();
  const location = useLocation();

  const getDashboardLink = () => homePathForRole(role);

  // Public links only. The recruiter workspace and admin console are role-
  // protected areas; anonymous visitors are sent to the sign-in flow instead of
  // being dropped onto a dashboard they cannot use (or, worse, that leaked data).
  const navLinks = [
    { label: 'Explore Jobs', path: '/jobs' },
    { label: 'For Recruiters', path: '/register?role=recruiter' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-700 antialiased">
      {/* Ambient decorative bubbles behind all content */}
      <div className="glass-ambient" aria-hidden="true">
        <span className="glass-bubble" />
      </div>

      {/* Top Bar Contract: Zone 1 (Wordmark) - Zone 2 (Nav links) - Zone 3 (Action) */}
      <header className="sticky top-0 z-40 glass-nav border-b border-slate-200/70 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single Wordmark */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
            <span>HireFlow</span>
          </Link>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Role Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            <QuickRoleSwitcher />
            {user ? (
              <Link
                to={getDashboardLink()}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl transition-all whitespace-nowrap shrink-0 shadow-md shadow-blue-600/25"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl transition-all whitespace-nowrap shadow-md shadow-blue-600/25"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 relative">
        <Outlet />
      </main>

      {/* Enterprise SaaS Footer */}
      <footer className="relative border-t border-slate-200/70 bg-white/60 backdrop-blur-lg text-slate-500 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <span>HireFlow</span>
            </div>
            <p className="text-slate-500 leading-relaxed max-w-xs">
              Enterprise-grade recruitment portal connecting high-growth technology companies with senior specialized engineering and product talent.
            </p>
          </div>

          <div>
            <h4 className="text-slate-800 font-semibold mb-3 tracking-wide">For Candidates</h4>
            <ul className="space-y-2">
              <li><Link to="/jobs" className="hover:text-slate-800 transition-colors">Search Open Positions</Link></li>
              <li><Link to="/candidate/profile" className="hover:text-slate-800 transition-colors">Profile & Skills</Link></li>
              <li><Link to="/candidate/resume" className="hover:text-slate-800 transition-colors">Resume Management</Link></li>
              <li><Link to="/candidate/applications" className="hover:text-slate-800 transition-colors">Application Tracker</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-800 font-semibold mb-3 tracking-wide">For Employers</h4>
            <ul className="space-y-2">
              <li><Link to="/recruiter/jobs/new" className="hover:text-slate-800 transition-colors">Post an Opening</Link></li>
              <li><Link to="/recruiter/company" className="hover:text-slate-800 transition-colors">Employer Branding</Link></li>
              <li><Link to="/recruiter/applicants" className="hover:text-slate-800 transition-colors">Talent Sourcing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-800 font-semibold mb-3 tracking-wide">Platform</h4>
            <ul className="space-y-2">
              <li><Link to="/jobs" className="hover:text-slate-800 transition-colors">Browse All Openings</Link></li>
              <li><Link to="/register?role=recruiter" className="hover:text-slate-800 transition-colors">Hire on HireFlow</Link></li>
              <li><Link to="/login" className="hover:text-slate-800 transition-colors">Sign In</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-200/70 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
    <div>
      © {new Date().getFullYear()} HireFlow Systems Inc. All rights reserved.
    </div>
    <div className="flex items-center gap-6">
      <span className="hover:text-slate-800 transition-colors cursor-pointer">Security Baseline</span>
      <span className="hover:text-slate-800 transition-colors cursor-pointer">Terms of Service</span>
      <span className="hover:text-slate-800 transition-colors cursor-pointer">Privacy Policy</span>
    </div>
  </div>
      </footer>
    </div>
  );
};
