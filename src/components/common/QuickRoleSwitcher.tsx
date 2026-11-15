import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserCheck, Briefcase, ShieldAlert } from 'lucide-react';
import { UserRole } from '../../types';

const ROLE_PRESENTATION: Record<
  UserRole,
  { label: string; icon: typeof UserCheck; color: string; text: string; path: string }
> = {
  candidate: { label: 'Candidate', icon: UserCheck, color: 'text-blue-600', text: 'bg-blue-50 border-blue-200 text-blue-600', path: '/candidate' },
  recruiter: { label: 'Recruiter', icon: Briefcase, color: 'text-violet-600', text: 'bg-violet-50 border-violet-200 text-violet-600', path: '/recruiter' },
  admin: { label: 'Admin', icon: ShieldAlert, color: 'text-emerald-600', text: 'bg-emerald-50 border-emerald-200 text-emerald-600', path: '/admin' },
};

/**
 * Read-only indication of the signed-in account's role.
 *
 * This used to be a "switch persona" menu: choosing a role called
 * `login(role)` and swapped the local user object, which let any visitor turn
 * themselves into an administrator. Role is now assigned by the server at
 * registration and cannot be changed from the browser, so the control shows
 * the current role and links to that role's workspace.
 */
export const QuickRoleSwitcher: React.FC = () => {
  const { user, role } = useAuth();

  if (!user || !role) return null;

  const presentation = ROLE_PRESENTATION[role];
  const Icon = presentation.icon;

  return (
    <Link
      to={presentation.path}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl bg-white/75 backdrop-blur-sm border border-slate-200/80 hover:border-blue-400/60 text-slate-700 transition-all shadow-sm"
      title={`Signed in as ${presentation.label}`}
    >
      <Icon className={`w-3.5 h-3.5 ${presentation.color}`} />
      <span className="text-slate-400 text-[11px] uppercase tracking-wide">Role:</span>
      <span className="font-semibold text-slate-800 capitalize">{role}</span>
    </Link>
  );
};

export { ROLE_PRESENTATION };
