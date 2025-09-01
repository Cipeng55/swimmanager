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
  id: string;
  name: string;
  date: string; // ISO date string (e.g., "2024-07-28")
  location: string;
  description?: string;
  lanesPerEvent?: number; // Number of lanes for this event (e.g., 4, 6, 8)
  categorySystem?: 'KU' | 'LETTER' | 'GRADE' | 'SCHOOL_LEVEL';
  letterAgeRanges?: Partial<Record<LetterCategory, LetterAgeRange>>; // Custom DOB ranges for A-I
  createdByAdminId: string; // ID of the admin who created the event
  authorizedUserIds: string[]; // List of user IDs (role: 'user') authorized for this event
}
export type NewSwimEvent = Omit<SwimEvent, 'id' | 'createdByAdminId'>;

// --- User Authentication and Roles ---
export type UserRole = 'superadmin' | 'admin' | 'user';

// Represents a user account in the system.
export interface User {
  id: string;
  username: string;
  password?: string; // Should not be sent to client
  role: UserRole;
  status?: 'active' | 'inactive'; // User account status
  // If role is 'user', this is the club's name. Otherwise null.
  clubName: string | null; 
  // If role is 'user' and created by an 'admin', this is the admin's ID.
  createdByAdminId?: string;
}

// For creating new users via the form.
export interface NewUserPayload {
  username: string;
  password: string;
  role: UserRole;
  clubName?: string; // Only required if role is 'user'
}

// The user object available in the AuthContext after login.
export interface CurrentUser {
  id: string;
  username: string;
  role: UserRole;
  clubId: string | null; // Added to match JWT payload
  // Display name for the user. e.g., "Dolphins SC", "Event Organizer", "System Administration"
  clubName: string; 
}

export interface CurrentUserContextType {
  currentUser: CurrentUser | null;
  isLoadingAuth: boolean;
  login: (username: string, password_plaintext: string) => Promise<void>;
  logout: () => void;
}
// --- End User Authentication ---


export interface Swimmer {
  id: string;
  name: string;
  dob: string; // ISO date string (e.g., "1998-03-15")
  gender: 'Male' | 'Female' | 'Other';
  clubName: string; // The name of the club, denormalized for display
  clubUserId: string; // The ID of the User (role 'user') that owns this swimmer
  gradeLevel?: string; // e.g., "TK A", "SD Kelas 1", "SMA Kelas XII"
  schoolName?: string; // e.g., "SDN Menteng 01"
}
export type NewSwimmer = Omit<Swimmer, 'id' | 'clubUserId' | 'clubName'>;

export interface SwimResult {
  id: string;
  swimmerId: string;
  eventId: string;
  style: string; // e.g., 'Freestyle', 'Butterfly', 'Backstroke', 'Breaststroke'
  distance: number; // in meters, e.g., 50, 100, 200
  seedTime?: string; // Optional: e.g., "00:58.63" (MM:SS.ss) - For heat sheet generation
  time?: string; // Optional: Official final time: e.g., "00:58.63" (MM:SS.ss)
  dateRecorded: string; // ISO date string
  remarks?: string; // Optional: For any notes on the result
  createdByUserId: string; // Tracks which user created this result
}
export type NewSwimResult = Omit<SwimResult, 'id' | 'createdByUserId'>;

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
  swimmerId: string;
  resultId: string; // ID of the original SwimResult, for updating
  name: string;
  clubName: string; 
  seedTimeMs: number; 
  seedTimeStr: string; 
  finalTimeStr?: string; // To display current final time
  remarks?: string;      // To display current remarks
  gender: Swimmer['gender'];
  ageGroup: string; // Swimmer's specific age group for this race, for display in "Kelas"
  swimmerDob: string; 
  swimmerGradeLevel?: string; // Added for grade system events
  schoolName?: string;
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
  swimmerClubName: string;
  swimmerSchoolName?: string;
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
  status: 'idle' | 'processing' | 'completed' | 'error';
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
  swimmerClubName: string; // Ensure this is always populated for "All Clubs" view
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

// --- Best Swimmers Types ---
export interface BestSwimmerInfo {
  swimmerId: string;
  swimmerName: string;
  swimmerClubName: string;
  swimmerSchoolName?: string;
  goldMedalCount: number;
  silverMedalCount: number;
  bronzeMedalCount: number;
}

export interface BestSwimmerCategoryResult {
  categoryTitle: string; // e.g., "KU V Putra", "A. 1-2 SD/MI Putri"
  swimmers: BestSwimmerInfo[]; // Array because of potential ties
}

export interface BestSwimmersPrintData {
    event: SwimEvent;
    bestSwimmers: BestSwimmerCategoryResult[];
}
// --- End Best Swimmers Types ---

// --- Best Clubs Types ---
export interface BestClubInfo {
  clubName: string;
  goldMedalCount: number;
  silverMedalCount: number;
  bronzeMedalCount: number;
  rank?: number;
}

export interface BestClubsPrintData {
    event: SwimEvent;
    bestClubs: BestClubInfo[];
}
// --- End Best Clubs Types ---