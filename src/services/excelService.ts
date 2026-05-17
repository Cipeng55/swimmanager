import * as XLSX from 'xlsx';
import { SwimEvent, SwimResult, Swimmer, User, BestSwimmerInfo, ClubMedalInfo } from '../types';
import { getAgeGroup } from '../utils/ageUtils';

export const exportEventToExcel = (
  event: SwimEvent,
  results: SwimResult[],
  swimmers: Swimmer[],
  users: User[],
  bestSwimmers: BestSwimmerInfo[],
  clubMedals: ClubMedalInfo[]
) => {
  const wb = XLSX.utils.book_new();

  // --- 1. BUKU ACARA (Program) ---
  const programData: any[] = [
    [event.name.toUpperCase()],
    [`BUKU ACARA (EVENT PROGRAM)`],
    [`Sistem Kategori: ${event.categorySystem || 'KU'}`],
    [`Tanggal: ${event.date || '-'}`],
    [], // Space for logo area (User can insert above)
    ['No', 'Acara', 'Gender', 'No. Lintasan', 'Nama Atlet', 'Sekolah/Club', 'Waktu Masuk']
  ];

  // Logic to group results by race for program
  const eventResults = results.filter(r => r.eventId === event.id);
  const raceMap = new Map<string, { definition: any, heats: any[] }>();

  // This is a simplification; in a real scenario, we'd use the same grouping logic as in the components
  // To keep it consistent, we would ideally pass the processed data from the components
  // For now, let's create a decent structure.

  // --- 2. BUKU HASIL (Results) ---
  const resultsData: any[] = [
    [event.name.toUpperCase()],
    [`BUKU HASIL RESMI (OFFICIAL RESULTS)`],
    [`Tanggal: ${event.date || '-'}`],
    [],
    ['Rank', 'Acara', 'Gender', 'Nama Atlet', 'Sekolah/Club', 'Waktu Akhir', 'Status']
  ];

  // --- 3. PEMAIN TERBAIK (Best Swimmers) ---
  const bestSwimmersData: any[] = [
    [event.name.toUpperCase()],
    [`DAFTAR PEMAIN TERBAIK / BEST SWIMMERS`],
    [],
    ['Rank', 'Kategori', 'Nama Atlet', 'Sekolah/Club', 'Emas', 'Perak', 'Perunggu', 'Poin Rekor']
  ];

  bestSwimmers.forEach(s => {
    bestSwimmersData.push([
      s.rank,
      s.categoryTitle,
      s.swimmerName,
      s.swimmerSchoolName || '-',
      s.goldMedalCount,
      s.silverMedalCount,
      s.bronzeMedalCount,
      s.performanceScore?.toFixed(2) || '0.00'
    ]);
  });

  // --- 4. CLUB TERBAIK (Top Clubs) ---
  const clubsData: any[] = [
    [event.name.toUpperCase()],
    [`KLASEMEN PEROLEHAN MEDALI (CLUB/SEKOLAH)`],
    [],
    ['Rank', 'Nama Club/Sekolah', 'Emas', 'Perak', 'Perunggu', 'Total Medals']
  ];

  clubMedals.forEach(c => {
    clubsData.push([
      c.rank,
      c.clubName,
      c.goldCount,
      c.silverCount,
      c.bronzeCount,
      c.totalCount
    ]);
  });

  // Convert to sheets
  const wsProgram = XLSX.utils.aoa_to_sheet(programData);
  const wsResults = XLSX.utils.aoa_to_sheet(resultsData);
  const wsBestSwimmers = XLSX.utils.aoa_to_sheet(bestSwimmersData);
  const wsClubs = XLSX.utils.aoa_to_sheet(clubsData);

  // Add sheets to workbook
  XLSX.utils.book_append_sheet(wb, wsProgram, "Buku Acara");
  XLSX.utils.book_append_sheet(wb, wsResults, "Buku Hasil");
  XLSX.utils.book_append_sheet(wb, wsBestSwimmers, "Pemain Terbaik");
  XLSX.utils.book_append_sheet(wb, wsClubs, "Club Terbaik");

  // Set column widths for better look
  const wscols = [
    { wch: 6 },  // No/Rank
    { wch: 30 }, // Name/Acara
    { wch: 10 }, // Gender/Emas
    { wch: 25 }, // Atlet Name/Perak
    { wch: 30 }, // School/Perunggu
    { wch: 15 }, // Time/Score
    { wch: 10 }, // Status/Total
  ];

  wsProgram['!cols'] = wscols;
  wsResults['!cols'] = wscols;
  wsBestSwimmers['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }
  ];
  wsClubs['!cols'] = [
      { wch: 6 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }
  ];

  // Save the file
  XLSX.writeFile(wb, `${event.name.replace(/\s+/g, '_')}_Official_Book.xlsx`);
};

// Helper for detailed Program export
export const generateDetailedProgramData = (event: SwimEvent, groupedRaces: any[]) => {
    const data: any[] = [
        [event.name.toUpperCase()],
        [`LAPORAN BUKU ACARA (PROGRAM)`],
        [`Sistem Kategori: ${event.categorySystem}`],
        [],
        ['Acara #', 'Race', 'Lintasan', 'Nama Atlet', 'Sekolah/Club', 'Waktu Masuk']
    ];

    groupedRaces.forEach((group, idx) => {
        const { definition, heats } = group;
        const raceInfo = `${definition.distance}m ${definition.style} ${definition.gender} ${definition.ageGroup}`;
        
        heats.forEach((heat: any) => {
            heat.lanes.forEach((lane: any) => {
                if (lane.swimmer) {
                    data.push([
                        definition.acaraNumber || (idx + 1),
                        raceInfo,
                        lane.laneNumber,
                        lane.swimmer.name,
                        lane.swimmer.schoolName || '-',
                        lane.entryTime || 'NT'
                    ]);
                }
            });
            data.push([]); // Space between heats
        });
    });

    return data;
};

export const generateDetailedResultsData = (event: SwimEvent, resultsByRace: any[]) => {
    const data: any[] = [
        [event.name.toUpperCase()],
        [`LAPORAN BUKU HASIL (RESULTS)`],
        [`Sistem Kategori: ${event.categorySystem}`],
        [],
        ['Acara #', 'Race', 'Rank', 'Nama Atlet', 'Sekolah/Club', 'Waktu Akhir', 'Status']
    ];

    resultsByRace.forEach((raceResult, idx) => {
        const { definition, results } = raceResult;
        const raceInfo = `${definition.distance}m ${definition.style} ${definition.gender} ${definition.ageGroup}`;
        
        results.forEach((res: any) => {
            data.push([
                definition.acaraNumber || (idx + 1),
                raceInfo,
                res.rank,
                res.swimmerName,
                res.swimmerSchoolName || '-',
                res.time,
                res.status || 'OK'
            ]);
        });
        data.push([]); // Space between races
    });

    return data;
};
