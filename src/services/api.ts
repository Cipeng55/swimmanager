
/**
 * @file This file provides an API service layer that communicates with the backend
 * serverless functions.
 */

import { SwimEvent, NewSwimEvent, Swimmer, NewSwimmer, SwimResult, NewSwimResult, User, NewUserPayload } from '../types';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || 'An unknown API error occurred');
  }
  // Handle 204 No Content case
  if (response.status === 204) {
    return;
  }
  return response.json();
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('swim_manager_auth_token');
    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };
    const response = await fetch(url, config);
    return handleResponse(response);
};

// --- Events API ---
export const getEvents = (): Promise<SwimEvent[]> => apiFetch('/api/events');

export const getEventById = (id: string): Promise<SwimEvent> => apiFetch(`/api/events/${id}`);

export const addEvent = (eventData: NewSwimEvent): Promise<SwimEvent> => 
  apiFetch('/api/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });

export const updateEvent = (id: string, eventData: Partial<Omit<SwimEvent, 'id'>>): Promise<SwimEvent> => 
  apiFetch(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(eventData),
  });

export const deleteEvent = (id: string): Promise<void> => 
  apiFetch(`/api/events/${id}`, {
    method: 'DELETE',
  });

// --- Swimmers API ---
export const getSwimmers = (): Promise<Swimmer[]> => apiFetch('/api/swimmers');

export const getSwimmerById = (id: string): Promise<Swimmer> => apiFetch(`/api/swimmers/${id}`);

export const addSwimmer = (swimmerData: any): Promise<Swimmer> => {
    return apiFetch('/api/swimmers', {
        method: 'POST',
        body: JSON.stringify(swimmerData),
    });
};

export const updateSwimmer = (id: string, swimmerData: Partial<Omit<Swimmer, 'id'>>): Promise<Swimmer> => 
  apiFetch(`/api/swimmers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(swimmerData),
  });

export const deleteSwimmer = (id: string): Promise<void> => 
  apiFetch(`/api/swimmers/${id}`, {
    method: 'DELETE',
  });

// --- Results API ---
export const getResults = (): Promise<SwimResult[]> => apiFetch('/api/results');

export const getResultById = (id: string): Promise<SwimResult> => apiFetch(`/api/results/${id}`);

export const addResult = (resultData: NewSwimResult): Promise<SwimResult> => {
    return apiFetch('/api/results', {
        method: 'POST',
        body: JSON.stringify(resultData),
    });
};

export const updateResult = (id: string, resultData: Partial<Omit<SwimResult, 'id'>>): Promise<SwimResult> =>
  apiFetch(`/api/results/${id}`, {
    method: 'PUT',
    body: JSON.stringify(resultData),
  });

export const deleteResult = (id: string): Promise<void> =>
  apiFetch(`/api/results/${id}`, {
    method: 'DELETE',
  });

// --- Event Program Order API ---
export const getEventProgramOrder = (eventId: string): Promise<string[] | null> =>
  apiFetch(`/api/program-order/${eventId}`);

export const saveEventProgramOrder = (eventId: string, orderedRaceKeys: string[]): Promise<void> =>
  apiFetch(`/api/program-order/${eventId}`, {
    method: 'POST',
    body: JSON.stringify({ orderedRaceKeys }),
  });

// --- Users API ---
export const getAllUsers = (): Promise<User[]> => apiFetch('/api/users');

export const createUser = (userData: NewUserPayload): Promise<User> => {
    return apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
};

export const updateUserPassword = (userId: string, password: string): Promise<void> =>
  apiFetch(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  });
