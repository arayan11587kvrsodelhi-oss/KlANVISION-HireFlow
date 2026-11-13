import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { QuickRoleSwitcher } from '../components/common/QuickRoleSwitcher';
import { ArrowRight, Sparkles, Briefcase } from 'lucide-react';

export const PublicLayout: React.FC = () => {
  const { user, role } = useAuth();
  const location = useLocation();

  const getDashboardLink = () => {
    if (role === 'admin') return '/admin';
    if (role === 'recruiter') return '/recruiter';
    return '/candidate';
  };

  const navLinks = [
    { label: 'Explore Jobs', path: '/jobs' },
    { label: 'For Recruiters', path: '/recruiter' },
    { label: 'Admin Console', path: '/admin' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      {/* Top Bar Contract: Zone 1 (Wordmark) - Zone 2 (Nav links) - Zone 3 (Action) */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single Wordmark */}
          <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              <Briefcase className="w-4 h-4" />
            </div>
            <span>HireFlow</span>
          </Link>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-blue-400 font-semibold' : 'hover:text-white'
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
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-blue-900/30"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap shadow-sm"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Enterprise SaaS Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 text-slate-400 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <span>HireFlow</span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-xs">
              Enterprise-grade recruitment portal connecting high-growth technology companies with senior specialized engineering and product talent.
            </p>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3 tracking-wide">For Candidates</h4>
            <ul className="space-y-2">
              <li><Link to="/jobs" className="hover:text-slate-200 transition-colors">Search Open Positions</Link></li>
              <li><Link to="/candidate/profile" className="hover:text-slate-200 transition-colors">Profile & Skills</Link></li>
              <li><Link to="/candidate/resume" className="hover:text-slate-200 transition-colors">Resume Management</Link></li>
              <li><Link to="/candidate/applications" className="hover:text-slate-200 transition-colors">Application Tracker</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3 tracking-wide">For Employers</h4>
            <ul className="space-y-2">
              <li><Link to="/recruiter/jobs/new" className="hover:text-slate-200 transition-colors">Post an Opening</Link></li>
              <li><Link to="/recruiter/jobs" className="hover:text-slate-200 transition-colors">Pipeline Management</Link></li>
              <li><Link to="/recruiter/company" className="hover:text-slate-200 transition-colors">Employer Branding</Link></li>
              <li><Link to="/recruiter/applicants" className="hover:text-slate-200 transition-colors">Talent Sourcing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold mb-3 tracking-wide">Governance & Integration</h4>
            <p className="text-slate-400 leading-relaxed mb-3">
              Standardized frontend API layer configured for direct FastAPI REST endpoints (/api/v1).
            </p>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              API Specification: OpenAPI 3.1
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} HireFlow Systems Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-200 transition-colors cursor-pointer">Security Baseline</span>
            <span className="hover:text-slate-200 transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-200 transition-colors cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
