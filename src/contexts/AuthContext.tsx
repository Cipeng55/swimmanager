import React, { createContext, useState, useContext, useEffect, PropsWithChildren } from 'react';
import { CurrentUser, CurrentUserContextType, User } from '../types';
import * as authService from '../services/authService';

const AuthContext = createContext<CurrentUserContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  useEffect(() => {
    // Check for existing user token in storage on initial load
    const userFromStorage = authService.getCurrentUserFromStorage();
    if (userFromStorage) {
      setCurrentUser(userFromStorage);
    }
    setIsLoadingAuth(false);
  }, []);

  const login = async (username: string, password_plaintext: string) => {
    setIsLoadingAuth(true);
    try {
      const user = await authService.login(username, password_plaintext);
      setCurrentUser(user);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = async () => {
    setIsLoadingAuth(true);
    await authService.logout();
    setCurrentUser(null);
    setIsLoadingAuth(false);
  };
  
  const value = {
    currentUser,
    isLoadingAuth,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): CurrentUserContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};