import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, CandidateProfile } from '../types';
import { authService, profileService } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isLoading: boolean;
  login: (role: UserRole, email?: string) => Promise<void>;
  register: (name: string, email: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => Promise<void>;
  profile: CandidateProfile | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      const candidateId = currentUser?.role === 'candidate' ? currentUser.id : undefined;
      const candProfile = await profileService.getProfile(candidateId);
      setProfile(candProfile);
    } catch (err) {
      console.error('Failed to load initial auth state', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const login = async (role: UserRole, email?: string) => {
    setIsLoading(true);
    try {
      const loggedUser = await authService.login(role, email);
      setUser(loggedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const newUser = await authService.register(name, email, role);
      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (newRole: UserRole) => {
    setIsLoading(true);
    try {
      const switched = await authService.login(newRole);
      setUser(switched);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    const candProfile = await profileService.getProfile();
    setProfile(candProfile);
  };

  const role = user?.role || 'candidate';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        login,
        register,
        logout,
        switchRole,
        profile,
        refreshProfile,
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
