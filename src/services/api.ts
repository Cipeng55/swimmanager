
/**
 * @file This file is a BLUEPRINT for communicating with a backend server.
 * All functions have been refactored from using localStorage to using the fetch API.
 * This code will NOT work until a backend server is created with endpoints that
 * match the URLs used in the fetch calls (e.g., /api/events, /api/swimmers, etc.).
 * This is the frontend part of migrating to a full-stack application.
 */

import { SwimEvent, NewSwimEvent, Swimmer, NewSwimmer, SwimResult, NewSwimResult } from '../types';

// A helper function for making API requests to the backend.
// It sets common headers and handles HTTP errors.
const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  // In a real app, you would add an Authorization header here if the user is logged in
  // const token = localStorage.getItem('auth_token');
  // if (token) {
  //   headers['Authorization'] = `Bearer ${token}`;
  // }
  
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: response.statusText };
    }
    throw new Error(errorData.message || 'An unknown API error occurred.');
  }

  // Handle responses with no content (e.g., DELETE requests)
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
};


// --- Events API ---
export const getEvents = (): Promise<SwimEvent[]> => {
  return apiFetch('/api/events');
};

export const getEventById = (id: number): Promise<SwimEvent | undefined> => {
  return apiFetch(`/api/events/${id}`);
};

export const addEvent = (eventData: NewSwimEvent): Promise<SwimEvent> => {
  return apiFetch('/api/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
};

export const updateEvent = (id: number, eventData: Partial<Omit<SwimEvent, 'id'>>): Promise<SwimEvent> => {
  return apiFetch(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(eventData),
  });
};

export const deleteEvent = (id: number): Promise<void> => {
  return apiFetch(`/api/events/${id}`, {
    method: 'DELETE',
  });
};

// --- Swimmers API ---
export const getSwimmers = (): Promise<Swimmer[]> => {
  return apiFetch('/api/swimmers');
};

export const getSwimmerById = (id: number): Promise<Swimmer | undefined> => {
  return apiFetch(`/api/swimmers/${id}`);
};

export const addSwimmer = (swimmerData: NewSwimmer): Promise<Swimmer> => {
  return apiFetch('/api/swimmers', {
    method: 'POST',
    body: JSON.stringify(swimmerData),
  });
};

export const updateSwimmer = (id: number, swimmerData: Partial<Omit<Swimmer, 'id'>>): Promise<Swimmer> => {
  return apiFetch(`/api/swimmers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(swimmerData),
  });
};

export const deleteSwimmer = (id: number): Promise<void> => {
  return apiFetch(`/api/swimmers/${id}`, {
    method: 'DELETE',
  });
};

// --- Results API ---
export const getResults = (): Promise<SwimResult[]> => {
  return apiFetch('/api/results');
};

export const getResultById = (id: number): Promise<SwimResult | undefined> => {
  return apiFetch(`/api/results/${id}`);
};

export const addResult = (resultData: NewSwimResult): Promise<SwimResult> => {
  return apiFetch('/api/results', {
    method: 'POST',
    body: JSON.stringify(resultData),
  });
};

export const updateResult = (id: number, resultData: Partial<Omit<SwimResult, 'id'>>): Promise<SwimResult> => {
  return apiFetch(`/api/results/${id}`, {
    method: 'PUT',
    body: JSON.stringify(resultData),
  });
};

export const deleteResult = (id: number): Promise<void> => {
  return apiFetch(`/api/results/${id}`, {
    method: 'DELETE',
  });
};

// --- Event Program Order API ---
export const getEventProgramOrder = (eventId: number): Promise<string[] | null> => {
  return apiFetch(`/api/events/${eventId}/program-order`);
};

export const saveEventProgramOrder = (eventId: number, orderedRaceKeys: string[]): Promise<void> => {
  return apiFetch(`/api/events/${eventId}/program-order`, {
    method: 'POST',
    body: JSON.stringify({ orderedRaceKeys }),
  });
};

// --- Data Management API ---
export const resetAllData = (): Promise<void> => {
  // This would be a protected admin endpoint on the backend
  return apiFetch('/api/data/reset', {
    method: 'POST',
  });
};
