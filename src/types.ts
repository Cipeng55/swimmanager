
import React from 'react';

export interface DashboardSummaryItemData {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  linkTo: string;
}

export type LetterCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export interface LetterAgeRange {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface SwimEvent {
  id: number;
  name: string;
  date: string; // ISO date string (e.g., "2024-07-28")
  location: string;
  description?: string;
  lanesPerEvent?: number; // Number of lanes for this event (e.g., 4, 6, 8)
  order?: number; // Optional: for custom ordering of events
  categorySystem?: 'KU' | 'LETTER' | 'GRADE';
  letterAgeRanges?: Partial<Record<LetterCategory, LetterAgeRange>>; // Custom DOB ranges for A-I
}
export type NewSwimEvent = Omit<SwimEvent, 'id'>;

// --- User Authentication and Roles ---
export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  password?: string; // Should be hashed in a real backend. Plaintext for simulation.
  role: UserRole;
}
export type NewUser = Omit<User, 'id'>;

export interface CurrentUser {
  id: number;
  username: string;
  role: UserRole;
}

export interface CurrentUserContextType {
  currentUser: CurrentUser | null;
  isLoadingAuth: boolean;
  login: (username: string, password_plaintext: string) => Promise<void>;
  logout: () => void;
  createUser?: (userData: NewUser) => Promise<User>; // Admin only
  getAllUsers?: () => Promise<User[]>; // Admin only
}
// --- End User Authentication ---


export interface Swimmer {
  id: number;
  name: string;
  dob: string; // ISO date string (e.g., "1998-03-15")
  gender: 'Male' | 'Female' | 'Other';
  club: string; 
  gradeLevel?: string; // e.g., "TK A", "SD Kelas 1", "SMA Kelas XII"
  createdByUserId?: number; // Tracks which user created this swimmer
}
export type NewSwimmer = Omit<Swimmer, 'id'>;

export interface SwimResult {
  id: number;
  swimmerId: number;
  eventId: number;
  style: string; // e.g., 'Freestyle', 'Butterfly', 'Backstroke', 'Breaststroke'
  distance: number; // in meters, e.g., 50, 100, 200
  seedTime?: string; // Optional: e.g., "00:58.63" (MM:SS.ss) - For heat sheet generation
  time?: string; // Optional: Official final time: e.g., "00:58.63" (MM:SS.ss)
  dateRecorded: string; // ISO date string
  remarks?: string; // Optional: For any notes on the result
  createdByUserId?: number; // Tracks which user created this result
}
export type NewSwimResult = Omit<SwimResult, 'id'>;

// For select options
export interface SelectOption {
  value: string | number;
  label: string;
}

// For Heat Sheet Generation
export interface RaceDefinition {
  style: string;
  distance: number;
  gender: Swimmer['gender'] | 'Mixed';
  ageGroup: string; 
  acaraNumber?: number; // Added for display
}

export interface SeededSwimmerInfo {
  swimmerId: number;
  resultId: number; // ID of the original SwimResult, for updating
  name: string;
  club: string; 
  seedTimeMs: number; 
  seedTimeStr: string; 
  finalTimeStr?: string; // To display current final time
  remarks?: string;      // To display current remarks
  gender: Swimmer['gender'];
  ageGroup: string; // Swimmer's specific age group for this race, for display in "Kelas"
  swimmerDob: string; 
  swimmerGradeLevel?: string; // Added for grade system events
}

export interface HeatLane {
  lane: number;
  swimmer?: SeededSwimmerInfo; 
}

export interface Heat {
  heatNumber: number;
  lanes: HeatLane[];
}

export interface LaneSwimmerDetails extends SeededSwimmerInfo {
  lane: number;
}

// For Results Book
export interface ResultEntry extends SwimResult {
  swimmerName: string;
  swimmerClub: string;
  rank?: number; 
  seedTimeStr?: string; 
}

export interface RaceResults {
  definition: RaceDefinition; 
  results: ResultEntry[];
}

// For Swimmer Import
export interface RowError {
  rowNumber: number; // Original CSV row number (data starts at row 2, header is row 1)
  rowData: string; // The problematic row's original text
  errors: string[]; // Array of error messages for this row
}

export interface ImportFeedback {
  successCount: number;
  skippedCount: number;
  rowErrors: RowError[];
  generalError?: string; // For errors like bad headers, file read issues
  status: 'idle' | 'processing' | 'completed' | 'error'; // To manage UI state
}

// For ResultFormPage race type selection
export interface RaceTypeSelection {
  id: string; // e.g., "fs50", "bf100"
  label: string; // e.g., "50m Freestyle", "100m Butterfly"
  style: string;
  distance: number;
}

// --- Print Specific Types ---
export interface PrintLayoutProps {
  title?: string;
  children: React.ReactNode;
}

export interface EventProgramPrintData {
  event: SwimEvent;
  numberedUniqueRaces: RaceDefinition[];
  // Pass generated heats data directly if getHeatsForRace is complex or relies on more context
  racesWithHeats: { race: RaceDefinition; heats: Heat[] }[];
}

export interface ResultsBookPrintData {
  event: SwimEvent;
  processedRaceResults: RaceResults[];
}
// --- End Print Specific Types ---

// --- Club Starting List Types ---
export interface ClubStartingListInfo {
  swimmerName: string;
  swimmerClub: string; // Ensure this is always populated for "All Clubs" view
  raceLabel: string; 
  heatNumber: number;
  laneNumber: number;
  seedTime: string; 
}

export interface ClubRaceInfo {
  raceLabel: string; 
  swimmers: ClubStartingListInfo[]; 
}
// --- End Club Starting List Types ---


// --- Club Starting List Print Types ---
export interface ClubStartingListPrintData {
  event: SwimEvent;
  clubNameToDisplay: string; 
  startingList: ClubRaceInfo[];
  lanesPerEvent: number;
  isAdminAllClubsView: boolean; 
}
// --- End Club Starting List Print Types ---
