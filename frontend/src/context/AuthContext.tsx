import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await api.get<User>('/auth/me');
      setUser(res.data);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; token_type: string; role: string; user_id: string }>(
      '/auth/login',
      {
        email,
        password,
      }
    );
    const accessToken = res.data.access_token;
    localStorage.setItem('access_token', accessToken);
    setToken(accessToken);

    // Backend /auth/login returns Token ({ access_token, token_type, role, user_id }).
    // Fetch full profile via /auth/me
    const userRes = await api.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setUser(userRes.data);
  };

  const register = async (fullName: string, email: string, password: string, phone?: string) => {
    // Backend requires phone (10 to 15 chars)
    const userPhone = phone && phone.trim().length >= 10 ? phone.trim() : '9876543210';
    await api.post('/auth/register', {
      full_name: fullName,
      email,
      phone: userPhone,
      password,
    });

    // Automatically login to retrieve JWT and user profile
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};