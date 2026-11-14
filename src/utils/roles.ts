import type { UserRole } from '../types';

/** Landing page after sign-in for a given role. */
export function homePathForRole(role: UserRole | null | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'recruiter') return '/recruiter';
  return '/candidate';
}
