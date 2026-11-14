import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserRole, CandidateProfile } from '../types';
import { authService, profileService } from '../services/api';
import { setUnauthenticatedHandler } from '../services/http';

/**
 * Authentication state.
 *
 * The server is the single source of truth:
 * - on mount, a silent `POST /auth/refresh` (using the HttpOnly cookie) is
 *   attempted, then `GET /auth/me` populates the user. If either fails the user
 *   is simply anonymous. No identity is ever read from browser storage.
 * - `role` is whatever the backend returned; it cannot be changed client-side.
 *   (The previous `switchRole` let any visitor "become" an admin locally; it is
 *   removed, not merely hidden.)
 */
interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True until the initial session probe has completed. */
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    role: 'candidate' | 'recruiter';
    companyName?: string;
  }) => Promise<{ email: string; role: UserRole }>;
  logout: () => Promise<void>;
  profile: CandidateProfile | null;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadProfile = useCallback(async (current: User | null) => {
    if (!current || current.role !== 'candidate') {
      setProfile(null);
      return;
    }
    try {
      const loaded = await profileService.getProfile({ id: current.id, email: current.email });
      setProfile(loaded);
    } catch (error) {
      // A profile failure must not break the dashboard shell.
      console.error('Failed to load candidate profile', error);
      setProfile(null);
    }
  }, []);

  const establishSession = useCallback(
    async (nextUser: User | null) => {
      setUser(nextUser);
      await loadProfile(nextUser);
    },
    [loadProfile]
  );

  // A 401 that survives a refresh attempt means the session is gone.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      setProfile(null);
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  // Initial session probe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await authService.getCurrentUser();
        if (!cancelled) await establishSession(me);
      } catch (error) {
        console.error('Failed to probe session', error);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [establishSession]);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      await authService.login(email, password);
      const me = await authService.getCurrentUser();
      if (!me) throw new Error('Login succeeded but the session could not be loaded.');
      await establishSession(me);
      return me;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    fullName: string;
    email: string;
    password: string;
    role: 'candidate' | 'recruiter';
    companyName?: string;
  }) => {
    setIsLoading(true);
    try {
      const result = await authService.register({
        full_name: payload.fullName,
        email: payload.email,
        password: payload.password,
        role: payload.role,
        ...(payload.role === 'recruiter' ? { company_name: payload.companyName } : {}),
      });
      return { email: result.email, role: result.role };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user || user.role !== 'candidate') return;
    await loadProfile(user);
  };

  const refreshUser = async () => {
    const me = await authService.getCurrentUser();
    await establishSession(me);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isLoading,
        isAuthenticated: user !== null,
        isBootstrapping,
        login,
        register,
        logout,
        profile,
        refreshProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
