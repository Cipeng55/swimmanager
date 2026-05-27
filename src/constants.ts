import { SelectOption, RaceTypeSelection } from './types';

export const gradeLevelOptions: SelectOption[] = [
  { value: '', label: 'Select Grade (Optional)' },
  { value: 'Belum Sekolah / PAUD', label: 'Belum Sekolah / PAUD' },
  { value: 'TK A', label: 'TK A' },
  { value: 'TK B', label: 'TK B' },
  { value: 'SD Kelas 1', label: 'SD Kelas 1' },
  { value: 'SD Kelas 2', label: 'SD Kelas 2' },
  { value: 'SD Kelas 3', label: 'SD Kelas 3' },
  { value: 'SD Kelas 4', label: 'SD Kelas 4' },
  { value: 'SD Kelas 5', label: 'SD Kelas 5' },
  { value: 'SD Kelas 6', label: 'SD Kelas 6' },
  { value: 'SMP Kelas VII', label: 'SMP Kelas VII' },
  { value: 'SMP Kelas VIII', label: 'SMP Kelas VIII' },
  { value: 'SMP Kelas IX', label: 'SMP Kelas IX' },
  { value: 'SMA Kelas X', label: 'SMA Kelas X' },
  { value: 'SMA Kelas XI', label: 'SMA Kelas XI' },
  { value: 'SMA Kelas XII', label: 'SMA Kelas XII' },
  { value: 'Lulus / Mahasiswa / Umum', label: 'Lulus / Mahasiswa / Umum' },
];

export const genderOptions: SelectOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
];

export const predefinedRaceTypes: RaceTypeSelection[] = [
  { id: 'fs25', label: '25m Freestyle', style: 'Freestyle', distance: 25 },
  { id: 'fs50', label: '50m Freestyle', style: 'Freestyle', distance: 50 },
  { id: 'fs100', label: '100m Freestyle', style: 'Freestyle', distance: 100 },
  { id: 'fs200', label: '200m Freestyle', style: 'Freestyle', distance: 200 },
  { id: 'bf25', label: '25m Butterfly', style: 'Butterfly', distance: 25 },
  { id: 'bf50', label: '50m Butterfly', style: 'Butterfly', distance: 50 },
  { id: 'bf100', label: '100m Butterfly', style: 'Butterfly', distance: 100 },
  { id: 'bk25', label: '25m Backstroke', style: 'Backstroke', distance: 25 },
  { id: 'bk50', label: '50m Backstroke', style: 'Backstroke', distance: 50 },
  { id: 'bk100', label: '100m Backstroke', style: 'Backstroke', distance: 100 },
  { id: 'br25', label: '25m Breaststroke', style: 'Breaststroke', distance: 25 },
  { id: 'br50', label: '50m Breaststroke', style: 'Breaststroke', distance: 50 },
  { id: 'br100', label: '100m Breaststroke', style: 'Breaststroke', distance: 100 },
  { id: 'im100', label: '100m Individual Medley', style: 'IM', distance: 100 },
  { id: 'im200', label: '200m Individual Medley', style: 'IM', distance: 200 },
  // Kick Events
  { id: 'kfs25', label: '25m Kick Freestyle', style: 'Kick Freestyle', distance: 25 },
  { id: 'kbf25', label: '25m Kick Butterfly', style: 'Kick Butterfly', distance: 25 },
  { id: 'kbr25', label: '25m Kick Breaststroke', style: 'Kick Breaststroke', distance: 25 },
  { id: 'kfs50', label: '50m Kick Freestyle', style: 'Kick Freestyle', distance: 50 },
  { id: 'kbf50', label: '50m Kick Butterfly', style: 'Kick Butterfly', distance: 50 },
  { id: 'kbr50', label: '50m Kick Breaststroke', style: 'Kick Breaststroke', distance: 50 },
  // Relay Events
  { id: 'fsr4x50', label: '4x50m Freestyle Relay', style: 'Freestyle Relay', distance: 200 },
  { id: 'imr4x50', label: '4x50m Medley Relay', style: 'Medley Relay', distance: 200 },
];

