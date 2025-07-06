
import React, { createContext, useState, useContext, useEffect, PropsWithChildren } from 'react';
import { CurrentUser, CurrentUserContextType, NewUser, User } from '../types';
import * as authService from '../services/authService';

const AuthContext = createContext<CurrentUserContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true); // Start true to check storage

  useEffect(() => {
    // Check for existing user in storage on initial load
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
      setIsLoadingAuth(false);
    } catch (error) {
      setIsLoadingAuth(false);
      throw error; // Re-throw to be caught by LoginPage
    }
  };

  const logout = async () => {
    setIsLoadingAuth(true);
    await authService.logout();
    setCurrentUser(null);
    setIsLoadingAuth(false);
  };
  
  // Admin-specific functions (only available if admin is logged in, for type safety)
  const createUser = currentUser?.role === 'admin' 
    ? async (userData: NewUser): Promise<User> => authService.createUser(userData) 
    : undefined;

  const getAllUsers = currentUser?.role === 'admin' 
    ? async (): Promise<User[]> => authService.getAllUsers()
    : undefined;


  const value = {
    currentUser,
    isLoadingAuth,
    login,
    logout,
    createUser,
    getAllUsers,
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
