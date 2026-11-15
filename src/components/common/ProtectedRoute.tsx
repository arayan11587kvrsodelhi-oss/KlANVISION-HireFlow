import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';
import { Button } from './Button';

interface ProtectedRouteProps {
  /** Roles allowed to render the nested routes. */
  allow: UserRole[];
  children: React.ReactNode;
}

/**
 * Client-side route guard.
 *
 * This is a **UX** control, not a security boundary: it stops an anonymous
 * visitor from seeing an empty dashboard and sends them to the login page with
 * a return path. Every request behind these routes is independently authorised
 * by the API, which is what actually protects the data.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allow, children }) => {
  const { user, role, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span>Restoring your session…</span>
        </div>
      </div>
    );
  }

  if (!user || !role) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (!allow.includes(role)) {
    const home = role === 'admin' ? '/admin' : role === 'recruiter' ? '/recruiter' : '/candidate';
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white/85 backdrop-blur-xl border border-slate-200/80 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-slate-900">Access restricted</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your account has the <span className="font-mono text-slate-700">{role}</span> role,
              which cannot open this area. If you believe this is a mistake, contact your
              platform administrator.
            </p>
          </div>
          <Link to={home}>
            <Button variant="primary" size="sm">
              Go to my dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
