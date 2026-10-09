import { createContext } from 'react';
import type { User, LoginCredentials, UserCapabilities } from '../../types/auth';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOwner: boolean;
  isCashier: boolean;
  can: (capability: keyof UserCapabilities) => boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
