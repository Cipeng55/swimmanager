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

// Helper for professional Program export matching PDF/Image layout
export const generateProfessionalProgramData = (event: SwimEvent, racesWithHeats: { race: RaceDefinition; heats: Heat[] }[]) => {
    const data: any[] = [
        [event.name.toUpperCase()],
        [`${event.date ? new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} - ${event.location || ''}`],
        [`Sistem Kategori: ${event.categorySystem || 'KU'} | Lintasan: ${event.lanesPerEvent || 4} | Course: ${event.courseType || 'SCM'}`],
        [],
    ];

    const isO2SN = event.categorySystem === 'O2SN' || event.categorySystem === 'SCHOOL_LEVEL';

    racesWithHeats.forEach((group) => {
        const { race, heats } = group;
        const raceHeader = `ACARA ${race.acaraNumber} - ${race.distance}M ${race.style.toUpperCase()} - ${race.ageGroup.toUpperCase()} ${race.gender === 'Male' ? 'PUTRA' : race.gender === 'Female' ? 'PUTRI' : 'MIXED'}`;
        
        data.push([raceHeader]);
        data.push([]); // Gap before seri

        heats.forEach((heat) => {
            data.push([`SERI ${heat.heatNumber}`]);
            // Table Header for this seri
            if (isO2SN) {
                data.push(['Lintasan', 'Nama', 'Nama Sekolah', 'Grade', 'Club / Instansi', 'Prestasi', 'Waktu Final', 'Keterangan']);
            } else {
                data.push(['Lintasan', 'Nama', 'Club', 'Seed Time', 'Waktu Final', 'Keterangan']);
            }
            
            heat.lanes.forEach((lane) => {
                if (lane.swimmer) {
                    if (isO2SN) {
                        data.push([
                            lane.lane,
                            lane.swimmer.name.toUpperCase(),
                            lane.swimmer.schoolName || '-',
                            lane.swimmer.swimmerGradeLevel || '-',
                            lane.swimmer.clubName || '-',
                            lane.swimmer.seedTimeStr || 'NT',
                            lane.swimmer.finalTimeStr || '-',
                            lane.swimmer.remarks || '-'
                        ]);
                    } else {
                        data.push([
                            lane.lane,
                            lane.swimmer.name.toUpperCase(),
                            lane.swimmer.clubName || '-',
                            lane.swimmer.seedTimeStr || 'NT',
                            lane.swimmer.finalTimeStr || '-',
                            lane.swimmer.remarks || '-'
                        ]);
                    }
                } else {
                    // Empty lane row
                    if (isO2SN) {
                        data.push([lane.lane, '', '', '', '', '', '', '']);
                    } else {
                        data.push([lane.lane, '', '', '', '', '']);
                    }
                }
            });
            data.push([]); // Gap after each Seri
        });
        data.push([]); // Double gap after each Acara
    });

    return data;
};

export const generateProfessionalResultsData = (event: SwimEvent, resultsByRace: { definition: any; results: any[] }[]) => {
    const data: any[] = [
        [event.name.toUpperCase()],
        [`HASIL RESMI (OFFICIAL RESULTS)`],
        [`Sistem Kategori: ${event.categorySystem || 'KU'}`],
        [],
    ];

    const isO2SN = event.categorySystem === 'O2SN' || event.categorySystem === 'SCHOOL_LEVEL';

    resultsByRace.forEach((raceResult) => {
        const { definition, results } = raceResult;
        const raceHeader = `ACARA ${definition.acaraNumber} - ${definition.distance}M ${definition.style.toUpperCase()} - ${definition.ageGroup.toUpperCase()} ${definition.gender === 'Male' ? 'PUTRA' : definition.gender === 'Female' ? 'PUTRI' : 'MIXED'}`;
        
        data.push([raceHeader]);
        if (isO2SN) {
            data.push(['Rank', 'Nama Atlet', 'Nama Sekolah', 'Club', 'Seed Time', 'Waktu Akhir', 'Status']);
        } else {
            data.push(['Rank', 'Nama Atlet', 'Club', 'Seed Time', 'Waktu Akhir', 'Status']);
        }
        
        results.forEach((res: any) => {
            if (isO2SN) {
                data.push([
                    res.rank || (res.remarks || '-'),
                    res.swimmerName.toUpperCase(),
                    res.swimmerSchoolName || '-',
                    res.swimmerClubName || '-',
                    res.seedTimeStr || 'NT',
                    res.time || 'NT',
                    res.remarks || 'OK'
                ]);
            } else {
                data.push([
                    res.rank || (res.remarks || '-'),
                    res.swimmerName.toUpperCase(),
                    res.swimmerClubName || '-',
                    res.seedTimeStr || 'NT',
                    res.time || 'NT',
                    res.remarks || 'OK'
                ]);
            }
        });
        data.push([]); // Gap between races
    });

    return data;
};

export const generateProfessionalBestSwimmersData = (event: SwimEvent, bestSwimmersByCategory: Map<string, any[]>) => {
    const data: any[] = [
        [event.name.toUpperCase()],
        [`DAFTAR PEMAIN TERBAIK / BEST SWIMMERS`],
        [],
    ];

    bestSwimmersByCategory.forEach((list, category) => {
        data.push([category.toUpperCase()]);
        data.push(['Rank', 'Nama Atlet', 'Sekolah/Club', 'Emas', 'Perak', 'Perunggu', 'Poin Rekor']);
        
        list.forEach((s, idx) => {
            data.push([
                idx + 1,
                s.swimmerName.toUpperCase(),
                s.swimmerSchoolName || s.swimmerClubName || '-',
                s.goldMedalCount,
                s.silverMedalCount,
                s.bronzeMedalCount,
                s.performanceScore?.toFixed(2) || '0.00'
            ]);
        });
        data.push([]);
    });

    return data;
};

export const generateProfessionalClubsData = (event: SwimEvent, clubMedals: any[]) => {
    const data: any[] = [
        [event.name.toUpperCase()],
        [`KLASEMEN PEROLEHAN MEDALI CLUB / SEKOLAH`],
        [],
        ['Rank', 'Nama Club/Sekolah', 'Emas', 'Perak', 'Perunggu', 'Total Medals']
    ];

    clubMedals.forEach((c, idx) => {
        data.push([
            idx + 1,
            c.clubName.toUpperCase(),
            c.gold,
            c.silver,
            c.bronze,
            c.total
        ]);
    });

    return data;
};

export const generateProfessionalRegistrationStatsData = (
  event: SwimEvent,
  results: SwimResult[],
  swimmers: Swimmer[]
) => {
  const data: any[] = [
    [event.name.toUpperCase()],
    ['LAPORAN REKAPITULASI PENDAFTAR ATLET PER CLUB/SEKOLAH'],
    [`Tanggal: ${event.date ? new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`],
    [],
  ];

  // Get swimmers registered in this event
  const eventResults = results.filter(r => r.eventId === event.id);
  const registeredSwimmerIds = Array.from(new Set(eventResults.map(r => r.swimmerId)));
  const registeredSwimmers = registeredSwimmerIds
    .map(id => swimmers.find(s => s.id === id))
    .filter((s): s is Swimmer => s !== undefined);

  // Group by club
  const clubMap: Record<string, { male: Swimmer[]; female: Swimmer[] }> = {};
  registeredSwimmers.forEach(s => {
    const club = s.clubName || 'Tanpa Club/Sekolah';
    if (!clubMap[club]) {
      clubMap[club] = { male: [], female: [] };
    }
    if (s.gender === 'Male') {
      clubMap[club].male.push(s);
    } else {
      clubMap[club].female.push(s);
    }
  });

  // 1. REKAPITULASI TABEL RINGKASAN
  data.push(['I. TABEL SUMMARY (REKAPITULASI JUMLAH)']);
  data.push(['No', 'Nama Perkumpulan / Klub / Sekolah', 'Putra (Pa)', 'Putri (Pi)', 'Total Atlet']);

  const sortedClubs = Object.entries(clubMap)
    .map(([clubName, lists]) => ({
      clubName,
      maleCount: lists.male.length,
      femaleCount: lists.female.length,
      totalCount: lists.male.length + lists.female.length,
      lists,
    }))
    .sort((a, b) => b.totalCount - a.totalCount || a.clubName.localeCompare(b.clubName));

  sortedClubs.forEach((club, idx) => {
    data.push([
      idx + 1,
      club.clubName.toUpperCase(),
      club.maleCount,
      club.femaleCount,
      club.totalCount,
    ]);
  });

  // Total Row for Summary Table
  const grandTotalMale = sortedClubs.reduce((acc, c) => acc + c.maleCount, 0);
  const grandTotalFemale = sortedClubs.reduce((acc, c) => acc + c.femaleCount, 0);
  const grandTotal = grandTotalMale + grandTotalFemale;
  data.push([
    'TOTAL',
    'KESELURUHAN ATLET',
    grandTotalMale,
    grandTotalFemale,
    grandTotal,
  ]);

  data.push([]);
  data.push([]);

  // 2. RINCIAN NAMA ATLET PER CLUB
  data.push(['II. DAFTAR NAMA ATLET (DIBEDAKAN PA & PI)']);
  data.push([]);

  sortedClubs.forEach((club) => {
    data.push([`CLUB: ${club.clubName.toUpperCase()} (Total: ${club.totalCount} Atlet - ${club.maleCount} Pa, ${club.femaleCount} Pi)`]);
    
    // List Putra (Pa)
    data.push(['', 'DAFTAR ATLET PUTRA (Pa)']);
    if (club.lists.male.length === 0) {
      data.push(['', 'Tidak ada atlet putra.']);
    } else {
      data.push(['', 'No', 'Nama Atlet', 'Kategori KU/Instansi', 'Tanggal Lahir']);
      club.lists.male
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((s, idx) => {
          const dobStr = s.dob ? new Date(s.dob).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
          const ageGroup = getAgeGroup(s, event);
          data.push(['', idx + 1, s.name.toUpperCase(), ageGroup, dobStr]);
        });
    }

    data.push([]); // Gap

    // List Putri (Pi)
    data.push(['', 'DAFTAR ATLET PUTRI (Pi)']);
    if (club.lists.female.length === 0) {
      data.push(['', 'Tidak ada atlet putri.']);
    } else {
      data.push(['', 'No', 'Nama Atlet', 'Kategori KU/Instansi', 'Tanggal Lahir']);
      club.lists.female
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((s, idx) => {
          const dobStr = s.dob ? new Date(s.dob).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
          const ageGroup = getAgeGroup(s, event);
          data.push(['', idx + 1, s.name.toUpperCase(), ageGroup, dobStr]);
        });
    }

    data.push([]); // Double gap between clubs
    data.push([]);
  });

  return data;
};
