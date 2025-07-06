/**
 * @file This file provides an authentication service using JWT
 * and a backend API for user verification and management.
 */

import { User, NewUser, CurrentUser } from '../types';
import { jwtDecode } from 'jwt-decode'; // Using a community-standard library

const AUTH_TOKEN_KEY = 'swim_manager_auth_token';

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'An API error occurred');
    }
    return response.json();
};

// Decodes the JWT to get user payload.
const decodeToken = (token: string): CurrentUser | null => {
  try {
    const decoded: any = jwtDecode(token);
    // 'iat' and 'exp' are standard JWT claims (issued at, expiration time)
    // The payload we set on the server will be available here.
    return {
      id: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      clubId: decoded.clubId,
      clubName: decoded.clubName,
    };
  } catch (error) {
    console.error("Invalid token:", error);
    return null;
  }
};


export const login = async (username: string, password_plaintext: string): Promise<CurrentUser> => {
    const { token } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password: password_plaintext }),
    });
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    const user = decodeToken(token);
    if (!user) throw new Error("Failed to decode token after login.");
    return user;
};

export const logout = async (): Promise<void> => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  return Promise.resolve();
};

export const getCurrentUserFromStorage = (): CurrentUser | null => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return null;
    return decodeToken(token);
  } catch (error) {
    console.error("Error processing user from storage:", error);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return null;
  }
};
