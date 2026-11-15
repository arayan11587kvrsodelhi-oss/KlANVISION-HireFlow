import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { QuickRoleSwitcher } from '../components/common/QuickRoleSwitcher';
import { getInitials } from '../utils/formatters';
import { homePathForRole } from '../utils/roles';
import {
  LayoutDashboard,
  User,
  GraduationCap,
  FileText,
  Send,
  Bookmark,
  Briefcase,
  PlusCircle,
  Users,
  Building2,
  ShieldCheck,
  CheckSquare,
  LogOut,
  Menu,
  X,
  Compass,
  ExternalLink,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    // `replace` so the back button does not return to a protected page.
    navigate('/login', { replace: true });
  };

  // Build role-specific navigation items
  const candidateNav = [
    { label: 'Overview', path: '/candidate', icon: LayoutDashboard },
    { label: 'Profile Information', path: '/candidate/profile', icon: User },
    { label: 'Skills & Experience', path: '/candidate/skills', icon: GraduationCap },
    { label: 'Resume & Documents', path: '/candidate/resume', icon: FileText },
    { label: 'My Applications', path: '/candidate/applications', icon: Send },
    { label: 'Saved Jobs', path: '/candidate/saved', icon: Bookmark },
  ];

  const recruiterNav = [
    { label: 'Talent Overview', path: '/recruiter', icon: LayoutDashboard },
    { label: 'Job Postings', path: '/recruiter/jobs', icon: Briefcase },
    { label: 'Post New Job', path: '/recruiter/jobs/new', icon: PlusCircle },
    { label: 'Applicants Pipeline', path: '/recruiter/applicants', icon: Users },
    { label: 'Company Profile', path: '/recruiter/company', icon: Building2 },
  ];

  const adminNav = [
    { label: 'System Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Candidate Directory', path: '/admin/candidates', icon: Users },
    { label: 'Company Governance', path: '/admin/companies', icon: Building2 },
    { label: 'Job Moderation', path: '/admin/jobs', icon: CheckSquare },
  ];

  // Navigation is derived from the server-assigned role. There is no default:
  // an unknown/absent role never falls back to the candidate menu.
  let currentNav: typeof candidateNav = [];
  let roleTitle = '';
  let badgeColor = 'bg-slate-100 text-slate-500 border-slate-200';

  if (role === 'candidate') {
    currentNav = candidateNav;
    roleTitle = 'Candidate Portal';
    badgeColor = 'bg-blue-50 text-blue-600 border-blue-200';
  } else if (role === 'recruiter') {
    currentNav = recruiterNav;
    roleTitle = 'Employer Workspace';
    badgeColor = 'bg-violet-50 text-violet-600 border-violet-200';
  } else if (role === 'admin') {
    currentNav = adminNav;
    roleTitle = 'Platform Administration';
    badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  }

  // Generate breadcrumb text
  const currentPathSegment = location.pathname.split('/').filter(Boolean).pop() || '';
  const currentNavMatch = currentNav.find((n) => n.path === location.pathname);
  const pageTitle = currentNavMatch?.label || currentPathSegment.replace('-', ' ');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col md:flex-row antialiased">
      {/* Ambient decorative bubbles behind all content */}
      <div className="glass-ambient" aria-hidden="true">
        <span className="glass-bubble" />
      </div>

      {/* Mobile Top bar */}
      <div className="md:hidden flex items-center justify-between p-4 glass-nav border-b border-slate-200/70 z-30 relative">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <Briefcase className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-base">HireFlow</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border uppercase ${badgeColor}`}>
            {role}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <QuickRoleSwitcher />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg bg-white/80 border border-slate-200"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Desktop Sidebar / Mobile Drawer */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 glass-nav border-r border-slate-200/70 flex flex-col transition-transform duration-200 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200/70 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 tracking-tight leading-none">HireFlow</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{roleTitle}</div>
            </div>
          </Link>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          {currentNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                  }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-4 px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Public Board
          </div>
          <Link
            to="/jobs"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Explore Public Jobs</span>
            </div>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-200/70">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 border border-slate-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                {getInitials(user?.name || user?.email || 'HF')}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-slate-500 truncate capitalize">{role ?? 'unknown'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Workspace Top Header */}
        <header className="sticky top-0 z-20 glass-nav border-b border-slate-200/70 px-6 py-3 hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>HireFlow</span>
            <span>/</span>
            <span className="capitalize">{role}</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold capitalize">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={homePathForRole(role)}
              className="text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-white/80 transition-colors"
            >
              My workspace
            </Link>
            <QuickRoleSwitcher />
            <Link
              to="/jobs"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-white/80 transition-colors"
            >
              <span>Public Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};
