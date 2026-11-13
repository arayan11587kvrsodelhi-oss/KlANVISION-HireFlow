import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserCheck, Briefcase, ShieldAlert, ChevronDown, Check } from 'lucide-react';
import { UserRole } from '../../types';

export const QuickRoleSwitcher: React.FC = () => {
  const { user, role, switchRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelectRole = async (targetRole: UserRole) => {
    await switchRole(targetRole);
    setIsOpen(false);
    // Intelligently route to that role's primary dashboard if currently on a dashboard route
    if (location.pathname.startsWith('/candidate') || location.pathname.startsWith('/recruiter') || location.pathname.startsWith('/admin')) {
      if (targetRole === 'candidate') navigate('/candidate');
      if (targetRole === 'recruiter') navigate('/recruiter');
      if (targetRole === 'admin') navigate('/admin');
    }
  };

  const roles = [
    {
      id: 'candidate' as UserRole,
      label: 'Candidate Mode',
      name: 'Alex Morgan',
      sub: 'Staff Frontend Engineer',
      icon: UserCheck,
      color: 'text-blue-400',
      dashboardPath: '/candidate',
    },
    {
      id: 'recruiter' as UserRole,
      label: 'Recruiter Mode',
      name: 'Sarah Chen',
      sub: 'CloudScale Labs',
      icon: Briefcase,
      color: 'text-purple-400',
      dashboardPath: '/recruiter',
    },
    {
      id: 'admin' as UserRole,
      label: 'Admin Mode',
      name: 'Marcus Vance',
      sub: 'Platform Governance',
      icon: ShieldAlert,
      color: 'text-emerald-400',
      dashboardPath: '/admin',
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900/90 border border-slate-700/80 hover:border-blue-500/50 text-slate-200 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        title="Switch demo persona for testing Candidate, Recruiter, and Admin"
      >
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-slate-400 font-mono text-[11px]">ROLE:</span>
        <span className="font-semibold text-slate-100 capitalize">{role}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2 py-1.5 mb-1 border-b border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Switch Demo Persona
              </p>
            </div>
            <div className="space-y-1">
              {roles.map((item) => {
                const Icon = item.icon;
                const isCurrent = role === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectRole(item.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors text-xs ${
                      isCurrent
                        ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-md bg-slate-800 border border-slate-700 ${item.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.name} · {item.sub}
                        </div>
                      </div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
