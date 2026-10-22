import React, { useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, UserCapabilities } from '../../types/auth';
import { authApi } from '../../services/api/auth';
import { tokenStorage } from '../../services/api/client';
import { AuthContext, type AuthContextValue } from './authContextDef';

const DEFAULT_TERMINAL_LOGIN: LoginCredentials = {
  login: 'cashier',
  password: 'password123',
  device_name: 'showroom-terminal',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const currentToken = tokenStorage.get();
    if (!currentToken) {
      try {
        const loginData = await authApi.login(DEFAULT_TERMINAL_LOGIN);
        setUser(loginData.user);
        setToken(loginData.token);
      } catch {
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const userData = await authApi.getMe();
      setUser(userData);
      setToken(currentToken);
    } catch {
      tokenStorage.clear();
      try {
        const loginData = await authApi.login(DEFAULT_TERMINAL_LOGIN);
        setUser(loginData.user);
        setToken(loginData.token);
      } catch {
        setUser(null);
        setToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const currentToken = tokenStorage.get();
      if (currentToken) {
        try {
          const userData = await authApi.getMe();
          if (isMounted) {
            setUser(userData);
            setToken(currentToken);
            setIsLoading(false);
          }
          return;
        } catch {
          tokenStorage.clear();
        }
      }

      // Automatically authenticate terminal without manual login page
      try {
        const loginData = await authApi.login(DEFAULT_TERMINAL_LOGIN);
        if (isMounted) {
          setUser(loginData.user);
          setToken(loginData.token);
        }
      } catch (err) {
        console.error('Failed station terminal auto-login', err);
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void init();

    const handleUnauthorized = () => {
      tokenStorage.clear();
      void (async () => {
        try {
          const loginData = await authApi.login(DEFAULT_TERMINAL_LOGIN);
          if (isMounted) {
            setUser(loginData.user);
            setToken(loginData.token);
          }
        } catch {
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        }
      })();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await authApi.login(credentials);
      setUser(data.user);
      setToken(data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Ignored
    } finally {
      tokenStorage.clear();
      try {
        const data = await authApi.login(DEFAULT_TERMINAL_LOGIN);
        setUser(data.user);
        setToken(data.token);
      } catch {
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isOwner = user?.role === 'owner';
  const isCashier = user?.role === 'cashier';

  const can = useCallback(
    (capability: keyof UserCapabilities): boolean => {
      if (!user) return false;
      return Boolean(user.capabilities?.[capability]);
    },
    [user]
  );

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    isOwner,
    isCashier,
    can,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
