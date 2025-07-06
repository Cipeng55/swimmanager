/**
 * @file This file provides a mocked API using localStorage.
 * It simulates a backend server by storing and retrieving data from the browser's
 * local storage, allowing the application to be fully functional without a real backend.
 */

import { SwimEvent, NewSwimEvent, Swimmer, NewSwimmer, SwimResult, NewSwimResult } from '../types';

// --- Helper Functions ---
const getNextId = (items: { id: number }[]): number => {
  return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
};

const readFromStorage = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return [];
  }
};

const writeToStorage = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
};

// --- Events API ---
export const getEvents = async (): Promise<SwimEvent[]> => {
  return Promise.resolve(readFromStorage<SwimEvent>('swim_manager_events'));
};

export const getEventById = async (id: number): Promise<SwimEvent | undefined> => {
  const events = await getEvents();
  return Promise.resolve(events.find(event => event.id === id));
};

export const addEvent = async (eventData: NewSwimEvent): Promise<SwimEvent> => {
  const events = await getEvents();
  const newEvent: SwimEvent = { ...eventData, id: getNextId(events) };
  events.push(newEvent);
  writeToStorage('swim_manager_events', events);
  return Promise.resolve(newEvent);
};

export const updateEvent = async (id: number, eventData: Partial<Omit<SwimEvent, 'id'>>): Promise<SwimEvent> => {
  let events = await getEvents();
  const eventIndex = events.findIndex(event => event.id === id);
  if (eventIndex === -1) return Promise.reject(new Error('Event not found'));
  
  events[eventIndex] = { ...events[eventIndex], ...eventData };
  writeToStorage('swim_manager_events', events);
  return Promise.resolve(events[eventIndex]);
};

export const deleteEvent = async (id: number): Promise<void> => {
  let events = await getEvents();
  events = events.filter(event => event.id !== id);
  writeToStorage('swim_manager_events', events);

  // Cascade delete: also remove associated results
  let results = await getResults();
  results = results.filter(result => result.eventId !== id);
  writeToStorage('swim_manager_results', results);

  // Cascade delete: also remove program order
  localStorage.removeItem(`swim_manager_program_order_${id}`);
  
  return Promise.resolve();
};

// --- Swimmers API ---
export const getSwimmers = async (): Promise<Swimmer[]> => {
  return Promise.resolve(readFromStorage<Swimmer>('swim_manager_swimmers'));
};

export const getSwimmerById = async (id: number): Promise<Swimmer | undefined> => {
  const swimmers = await getSwimmers();
  return Promise.resolve(swimmers.find(swimmer => swimmer.id === id));
};

export const addSwimmer = async (swimmerData: NewSwimmer): Promise<Swimmer> => {
    const swimmers = await getSwimmers();
    const { currentUser } = JSON.parse(localStorage.getItem('swim_manager_current_user_auth') || '{}');
    const newSwimmer: Swimmer = { 
        ...swimmerData, 
        id: getNextId(swimmers),
        createdByUserId: currentUser?.id,
    };
    swimmers.push(newSwimmer);
    writeToStorage('swim_manager_swimmers', swimmers);
    return Promise.resolve(newSwimmer);
};

export const updateSwimmer = async (id: number, swimmerData: Partial<Omit<Swimmer, 'id'>>): Promise<Swimmer> => {
  let swimmers = await getSwimmers();
  const swimmerIndex = swimmers.findIndex(swimmer => swimmer.id === id);
  if (swimmerIndex === -1) return Promise.reject(new Error('Swimmer not found'));
  
  swimmers[swimmerIndex] = { ...swimmers[swimmerIndex], ...swimmerData };
  writeToStorage('swim_manager_swimmers', swimmers);
  return Promise.resolve(swimmers[swimmerIndex]);
};

export const deleteSwimmer = async (id: number): Promise<void> => {
  let swimmers = await getSwimmers();
  swimmers = swimmers.filter(swimmer => swimmer.id !== id);
  writeToStorage('swim_manager_swimmers', swimmers);

  // Cascade delete: also remove associated results
  let results = await getResults();
  results = results.filter(result => result.swimmerId !== id);
  writeToStorage('swim_manager_results', results);

  return Promise.resolve();
};

// --- Results API ---
export const getResults = async (): Promise<SwimResult[]> => {
  return Promise.resolve(readFromStorage<SwimResult>('swim_manager_results'));
};

export const getResultById = async (id: number): Promise<SwimResult | undefined> => {
  const results = await getResults();
  return Promise.resolve(results.find(result => result.id === id));
};

export const addResult = async (resultData: NewSwimResult): Promise<SwimResult> => {
    const results = await getResults();
    const { currentUser } = JSON.parse(localStorage.getItem('swim_manager_current_user_auth') || '{}');
    const newResult: SwimResult = { 
        ...resultData, 
        id: getNextId(results),
        createdByUserId: currentUser?.id,
    };
    results.push(newResult);
    writeToStorage('swim_manager_results', results);
    return Promise.resolve(newResult);
};

export const updateResult = async (id: number, resultData: Partial<Omit<SwimResult, 'id'>>): Promise<SwimResult> => {
  let results = await getResults();
  const resultIndex = results.findIndex(result => result.id === id);
  if (resultIndex === -1) return Promise.reject(new Error('Result not found'));

  results[resultIndex] = { ...results[resultIndex], ...resultData };
  writeToStorage('swim_manager_results', results);
  return Promise.resolve(results[resultIndex]);
};

export const deleteResult = async (id: number): Promise<void> => {
  let results = await getResults();
  results = results.filter(result => result.id !== id);
  writeToStorage('swim_manager_results', results);
  return Promise.resolve();
};

// --- Event Program Order API ---
export const getEventProgramOrder = async (eventId: number): Promise<string[] | null> => {
  const key = `swim_manager_program_order_${eventId}`;
  const data = localStorage.getItem(key);
  return Promise.resolve(data ? JSON.parse(data) : null);
};

export const saveEventProgramOrder = async (eventId: number, orderedRaceKeys: string[]): Promise<void> => {
  const key = `swim_manager_program_order_${eventId}`;
  localStorage.setItem(key, JSON.stringify(orderedRaceKeys));
  return Promise.resolve();
};


// --- Data Management API ---
export const resetAllData = async (): Promise<void> => {
  // Clear primary data keys
  localStorage.removeItem('swim_manager_events');
  localStorage.removeItem('swim_manager_swimmers');
  localStorage.removeItem('swim_manager_results');
  localStorage.removeItem('swim_manager_users');
  localStorage.removeItem('swim_manager_current_user_auth');
  
  // Clear all program order keys
  Object.keys(localStorage)
    .filter(key => key.startsWith('swim_manager_program_order_'))
    .forEach(key => localStorage.removeItem(key));
    
  return Promise.resolve();
};
