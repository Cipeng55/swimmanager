/**
 * @file This file is a BLUEPRINT for a real authentication service.
 * All functions now communicate with a hypothetical backend API.
 * The logic of managing a user list in localStorage has been removed.
 * This code requires a backend with endpoints like /api/auth/login, /api/users, etc.
 */

import { User, NewUser, CurrentUser } from '../types';

const CURRENT_USER_KEY = 'swim_manager_current_user_auth';

// A helper function for making API requests to the backend.
const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || 'An API error occurred');
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json();
};

export const login = async (username: string, password_plaintext: string): Promise<CurrentUser> => {
  // In a real app, the backend receives the password, hashes it, compares it, and returns a user object or token.
  // The backend should never receive or store plaintext passwords. Hashing should be done on the server.
  const currentUserData = await apiFetch<CurrentUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: password_plaintext }),
  });

  if (currentUserData) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUserData));
    return currentUserData;
  } else {
    throw new Error('Login failed: No user data returned from server.');
  }
};

export const logout = async (): Promise<void> => {
  // Inform the backend that the user is logging out (e.g., to invalidate a token)
  await apiFetch('/api/auth/logout', { method: 'POST' });
  // Always clear local session data regardless of API call success
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUserFromStorage = (): CurrentUser | null => {
  try {
    const currentUserJson = localStorage.getItem(CURRENT_USER_KEY);
    return currentUserJson ? JSON.parse(currentUserJson) : null;
  } catch (error) {
    console.error("Error parsing current user from localStorage:", error);
    return null;
  }
};

export const createUser = async (userData: NewUser): Promise<User> => { // Admin only
  // The backend will handle authorization (is the caller an admin?)
  return apiFetch<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
  });
};

export const getAllUsers = async (): Promise<User[]> => { // Admin only
  // The backend will handle authorization and should not return passwords.
  return apiFetch<User[]>('/api/users');
};

export const changePassword = async (userId: number, currentPassword_plaintext: string, newPassword_plaintext: string): Promise<void> => {
  // The backend will verify the current password and update to the new one.
  return apiFetch('/api/users/change-password', {
    method: 'POST',
    body: JSON.stringify({ userId, currentPassword: currentPassword_plaintext, newPassword: newPassword_plaintext }),
  });
};
