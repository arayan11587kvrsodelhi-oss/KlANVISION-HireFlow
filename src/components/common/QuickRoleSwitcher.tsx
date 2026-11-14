import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserCheck, Briefcase, ShieldAlert } from 'lucide-react';
import { UserRole } from '../../types';

const ROLE_PRESENTATION: Record<
  UserRole,
  { label: string; icon: typeof UserCheck; color: string; text: string; path: string }
> = {
  candidate: { label: 'Candidate', icon: UserCheck, color: 'text-blue-400', text: 'bg-blue-500/10 border-blue-500/30 text-blue-400', path: '/candidate' },
  recruiter: { label: 'Recruiter', icon: Briefcase, color: 'text-purple-400', text: 'bg-purple-500/10 border-purple-500/30 text-purple-400', path: '/recruiter' },
  admin: { label: 'Admin', icon: ShieldAlert, color: 'text-emerald-400', text: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', path: '/admin' },
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
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900/90 border border-slate-700/80 hover:border-blue-500/50 text-slate-200 transition-all shadow-sm"
      title={`Signed in as ${presentation.label}`}
    >
      <Icon className={`w-3.5 h-3.5 ${presentation.color}`} />
      <span className="text-slate-400 font-mono text-[11px]">ROLE:</span>
      <span className="font-semibold text-slate-100 capitalize">{role}</span>
    </Link>
  );
};

export { ROLE_PRESENTATION };
