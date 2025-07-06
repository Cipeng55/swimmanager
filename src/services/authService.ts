/**
 * @file This file provides a mocked authentication service using localStorage.
 * It manages users and login sessions locally in the browser, creating default
 * users on first load to ensure the app is usable out-of-the-box.
 */

import { User, NewUser, CurrentUser } from '../types';

const USERS_KEY = 'swim_manager_users';
const CURRENT_USER_KEY = 'swim_manager_current_user_auth';

// Initialize with default users if none exist. This makes the app work on first load.
const initializeUsers = (): User[] => {
  try {
    const usersJson = localStorage.getItem(USERS_KEY);
    if (usersJson && JSON.parse(usersJson).length > 0) {
      return JSON.parse(usersJson);
    }
  } catch (e) {
    console.error("Could not parse users from localStorage, resetting.", e);
  }

  // No users found or data is corrupt, create default admin and user
  const defaultUsers: User[] = [
    { id: 1, username: 'admin', password: 'admin', role: 'admin' }, // Passwords are plaintext for this simulation
    { id: 2, username: 'user', password: 'user', role: 'user' },
  ];
  localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  return defaultUsers;
};

// Ensure users are initialized on module load
initializeUsers();


export const login = async (username: string, password_plaintext: string): Promise<CurrentUser> => {
  const users = initializeUsers(); // Read fresh list
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password_plaintext);

  if (user) {
    const currentUserData: CurrentUser = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUserData));
    return Promise.resolve(currentUserData);
  } else {
    return Promise.reject(new Error('Invalid username or password.'));
  }
};

export const logout = async (): Promise<void> => {
  localStorage.removeItem(CURRENT_USER_KEY);
  return Promise.resolve();
};

export const getCurrentUserFromStorage = (): CurrentUser | null => {
  try {
    const currentUserJson = localStorage.getItem(CURRENT_USER_KEY);
    return currentUserJson ? JSON.parse(currentUserJson) : null;
  } catch (error) {
    console.error("Error parsing current user from localStorage:", error);
    localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
};

export const createUser = async (userData: NewUser): Promise<User> => {
  const users = initializeUsers();
  if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
    return Promise.reject(new Error('Username already exists.'));
  }
  const newUser: User = {
    ...userData,
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    password: userData.password,
  };
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return Promise.resolve(newUser);
};

export const getAllUsers = async (): Promise<User[]> => {
  const users = initializeUsers();
  // IMPORTANT: Never return passwords to the client, even in a simulation.
  const usersWithoutPasswords = users.map(({ password, ...user }) => user);
  // @ts-ignore
  return Promise.resolve(usersWithoutPasswords);
};

export const changePassword = async (userId: number, currentPassword_plaintext: string, newPassword_plaintext: string): Promise<void> => {
    let users = initializeUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return Promise.reject(new Error("User not found."));
    }
    if (users[userIndex].password !== currentPassword_plaintext) {
        return Promise.reject(new Error("Current password is incorrect."));
    }

    users[userIndex].password = newPassword_plaintext;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return Promise.resolve();
};
