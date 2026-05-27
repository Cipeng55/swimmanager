import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SwimEvent, SwimResult, Swimmer, User, BestSwimmerInfo, RaceDefinition, SeededSwimmerInfo, Heat, ResultEntry } from '../types';
import { getEventById, getResults, getSwimmers, getAllUsers, getEventProgramOrder } from '../services/api';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils';
import { generateHeats } from '../utils/seedingUtils';
import { timeToMilliseconds } from '../utils/timeUtils';
import { processResultsForRankings } from '../utils/resultUtils';
import { 
    exportEventToExcel, 
    generateProfessionalProgramData, 
    generateProfessionalResultsData,
    generateProfessionalBestSwimmersData,
    generateProfessionalClubsData
} from '../services/excelService';
import * as XLSX from 'xlsx';
import LoadingSpinner from '../components/common/LoadingSpinner';

const OfficialReportPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [results, setResults] = useState<SwimResult[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!eventId) return;
      try {
        const [eventData, resultsData, swimmersData, usersData] = await Promise.all([
          getEventById(eventId),
          getResults(),
          getSwimmers(),
          getAllUsers(),
        ]);
        setEvent(eventData);
        setResults(resultsData.filter(r => r.eventId === eventId));
        setSwimmers(swimmersData);
        setUsers(usersData);
      } catch (err) {
        console.error("Failed to load report data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  const handleExport = async () => {
    if (!event) return;

    // 1. Group by Race and Generate Heats
    const raceMap = new Map<string, { definition: RaceDefinition; seededSwimmers: SeededSwimmerInfo[] }>();
    
    results.forEach(res => {
        const swimmer = swimmers.find(s => s.id === res.swimmerId);
        if (!swimmer || !res.seedTime) return;
        const ageGroup = getAgeGroup(swimmer, event);
        const key = `${res.style}-${res.distance}-${swimmer.gender}-${ageGroup}`;
        
        if (!raceMap.has(key)) {
            raceMap.set(key, {
                definition: { style: res.style, distance: res.distance, gender: swimmer.gender, ageGroup },
                seededSwimmers: []
            });
        }
        
        raceMap.get(key)!.seededSwimmers.push({
            resultId: res.id,
            swimmerId: swimmer.id,
            name: swimmer.name,
            clubName: swimmer.clubName,
            gender: swimmer.gender,
            ageGroup: ageGroup,
            seedTimeMs: timeToMilliseconds(res.seedTime),
            seedTimeStr: res.seedTime,
            swimmerDob: swimmer.dob,
            swimmerGradeLevel: swimmer.gradeLevel,
            schoolName: swimmer.schoolName,
            finalTimeStr: res.time,
            remarks: res.remarks
        });
    });

    // Sort races (default or custom)
    let customOrderedKeys: string[] | null = null;
    try {
        customOrderedKeys = await getEventProgramOrder(event.id);
    } catch (e) {
        console.error("Failed to fetch custom order", e);
    }

    let sortedRaces: { definition: RaceDefinition; seededSwimmers: SeededSwimmerInfo[] }[] = [];
    const initialRaces = Array.from(raceMap.values());

    if (customOrderedKeys && customOrderedKeys.length > 0) {
        const raceKeysMap = new Map(initialRaces.map(r => [`${r.definition.style}-${r.definition.distance}-${r.definition.gender}-${r.definition.ageGroup}`, r]));
        customOrderedKeys.forEach(key => {
            if (raceKeysMap.has(key)) {
                sortedRaces.push(raceKeysMap.get(key)!);
                raceKeysMap.delete(key);
            }
        });
        // Add remaining
        const remaining = Array.from(raceKeysMap.values()).sort((a,b) => getSortableAgeGroup(a.definition.ageGroup, event) - getSortableAgeGroup(b.definition.ageGroup, event));
        sortedRaces = [...sortedRaces, ...remaining];
    } else {
        sortedRaces = initialRaces.sort((a, b) => {
            const ageComp = getSortableAgeGroup(a.definition.ageGroup, event) - getSortableAgeGroup(b.definition.ageGroup, event);
            if (ageComp !== 0) return ageComp;
            return a.definition.style.localeCompare(b.definition.style);
        });
    }

    const racesWithHeats = sortedRaces.map((r, idx) => ({
        race: { ...r.definition, acaraNumber: idx + 1 },
        heats: generateHeats(r.seededSwimmers, event.lanesPerEvent || 4)
    })).filter(rh => rh.heats.length > 0);

    const programData = generateProfessionalProgramData(event, racesWithHeats);

    // 2. Process Results Data per Race
    const resultsByRace = processResultsForRankings(event, results, swimmers).map((pr, idx) => ({
      ...pr,
      definition: { ...pr.definition, acaraNumber: idx + 1 }
    }));

    const resultsData = generateProfessionalResultsData(event, resultsByRace);

    // 3. Process Best Swimmers
    const swimmersInCategory = new Map<string, BestSwimmerInfo[]>();
    
    // Aggregate medals from the ranked results
    const medalCounts = new Map<string, { gold: number; silver: number; bronze: number; perfScore: number; perfCount: number }>();

    resultsByRace.forEach(race => {
      race.results.forEach(res => {
        if (!medalCounts.has(res.swimmerId)) {
          medalCounts.set(res.swimmerId, { gold: 0, silver: 0, bronze: 0, perfScore: 0, perfCount: 0 });
        }
        const counts = medalCounts.get(res.swimmerId)!;
        
        // Count medals based on dynamic rank
        if (res.rank === 1) counts.gold++;
        else if (res.rank === 2) counts.silver++;
        else if (res.rank === 3) counts.bronze++;

        // Performance calculation (if enabled)
        if (event.useNationalRecords && res.time && event.nationalRecords) {
          const s = swimmers.find(sw => sw.id === res.swimmerId);
          if (s) {
            const ageGroup = getAgeGroup(s, event);
            const rec = event.nationalRecords.find(nr => 
              nr.style === res.style && 
              nr.distance === res.distance && 
              nr.gender === s.gender && 
              nr.ageGroup === ageGroup
            );
            if (rec) {
              const resMs = timeToMilliseconds(res.time);
              const recMs = timeToMilliseconds(rec.time);
              if (resMs > 0 && recMs > 0) {
                const score = (recMs / resMs) * 1000;
                if (score > counts.perfScore) {
                  counts.perfScore = score;
                }
                counts.perfCount++;
              }
            }
          }
        }
      });
    });

    // Group by category and create BestSwimmerInfo objects
    swimmers.forEach(s => {
      const counts = medalCounts.get(s.id);
      if (counts && (counts.gold > 0 || counts.silver > 0 || counts.bronze > 0)) {
        const ageGroup = getAgeGroup(s, event);
        const categoryTitle = `${ageGroup} ${s.gender === 'Male' ? 'Putra' : 'Putri'}`;
        
        if (!swimmersInCategory.has(categoryTitle)) {
          swimmersInCategory.set(categoryTitle, []);
        }
        
        swimmersInCategory.get(categoryTitle)!.push({
          swimmerId: s.id,
          swimmerName: s.name,
          swimmerClubName: s.clubName,
          swimmerSchoolName: s.schoolName,
          categoryTitle: categoryTitle,
          goldMedalCount: counts.gold,
          silverMedalCount: counts.silver,
          bronzeMedalCount: counts.bronze,
          performanceScore: counts.perfCount > 0 ? counts.perfScore : 0
        });
      }
    });

    // Sort each category
    swimmersInCategory.forEach((list) => {
      list.sort((a, b) => {
        if (b.goldMedalCount !== a.goldMedalCount) return b.goldMedalCount - a.goldMedalCount;
        if (b.silverMedalCount !== a.silverMedalCount) return b.silverMedalCount - a.silverMedalCount;
        if (b.bronzeMedalCount !== a.bronzeMedalCount) return b.bronzeMedalCount - a.bronzeMedalCount;
        return (b.performanceScore || 0) - (a.performanceScore || 0);
      });
    });

    const bestSwimmersData = generateProfessionalBestSwimmersData(event, swimmersInCategory);

    // 4. Process Club Medals
    const clubMap = new Map<string, { gold: number; silver: number; bronze: number; total: number }>();
    results.forEach(res => {
        if (!res.finalRank || res.finalRank > 3) return;
        const swimmer = swimmers.find(s => s.id === res.swimmerId);
        if (!swimmer || !swimmer.userId) return;
        
        const clubId = swimmer.userId;
        if (!clubMap.has(clubId)) clubMap.set(clubId, { gold: 0, silver: 0, bronze: 0, total: 0 });
        const counts = clubMap.get(clubId)!;
        if (res.finalRank === 1) counts.gold++;
        else if (res.finalRank === 2) counts.silver++;
        else if (res.finalRank === 3) counts.bronze++;
        counts.total++;
    });

    const clubMedalsSorted = Array.from(clubMap.entries()).map(([id, counts]) => {
      const user = users.find(u => u.id === id);
      return {
        clubName: user?.clubName || user?.username || 'Unknown',
        gold: counts.gold,
        silver: counts.silver,
        bronze: counts.bronze,
        total: counts.total
      };
    }).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.total - a.total;
    });

    const clubsReportData = generateProfessionalClubsData(event, clubMedalsSorted);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Program
    const wsProgram = XLSX.utils.aoa_to_sheet(programData);
    const isO2SN = event.categorySystem === 'O2SN' || event.categorySystem === 'SCHOOL_LEVEL';
    wsProgram['!cols'] = isO2SN ? [
        { wch: 8 },  // Lintasan
        { wch: 30 }, // Nama
        { wch: 25 }, // Sekolah
        { wch: 15 }, // Grade
        { wch: 20 }, // Club
        { wch: 12 }, // Prestasi
        { wch: 12 }, // Final
        { wch: 15 }, // Keterangan
    ] : [
        { wch: 8 },  // Lintasan
        { wch: 30 }, // Nama
        { wch: 25 }, // Club
        { wch: 15 }, // Seed Time
        { wch: 12 }, // Final
        { wch: 15 }, // Keterangan
    ];
    XLSX.utils.book_append_sheet(wb, wsProgram, "Buku Acara");

    // Sheet 2: Results
    const wsResults = XLSX.utils.aoa_to_sheet(resultsData);
    wsResults['!cols'] = isO2SN ? [
        { wch: 6 },  // Rank
        { wch: 30 }, // Nama
        { wch: 25 }, // Sekolah
        { wch: 25 }, // Club
        { wch: 12 }, // Seed
        { wch: 12 }, // Final
        { wch: 15 }, // Status
    ] : [
        { wch: 6 },  // Rank
        { wch: 30 }, // Nama
        { wch: 25 }, // Club
        { wch: 12 }, // Seed
        { wch: 12 }, // Final
        { wch: 15 }, // Status
    ];
    XLSX.utils.book_append_sheet(wb, wsResults, "Buku Hasil");

    // Sheet 3: Best Swimmers
    const wsBest = XLSX.utils.aoa_to_sheet(bestSwimmersData);
    wsBest['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsBest, "Pemain Terbaik");

    // Sheet 4: Top Clubs
    const wsClubs = XLSX.utils.aoa_to_sheet(clubsReportData);
    wsClubs['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsClubs, "Club Terbaik");
    
    XLSX.writeFile(wb, `${event.name.replace(/\s+/g, '_')}_Official_Report.xlsx`);
  };

  if (loading) return <LoadingSpinner text="Mempersiapkan data laporan..." />;
  if (!event) return <div>Event tidak ditemukan.</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white uppercase tracking-tight mb-2">Export Laporan Resmi</h1>
          <p className="text-gray-500 dark:text-gray-400">Generate buku acara, hasil, dan peringkat dalam satu file Excel profesional.</p>
        </header>

        <div className="space-y-6">
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Format Laporan:</h2>
            <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>Sheet 1: Buku Acara (Program sesuai lintasan)</li>
              <li>Sheet 2: Buku Hasil (Urutan juara per gaya)</li>
              <li>Sheet 3: Pemain Terbaik (Peringkat atlet per kategori)</li>
              <li>Sheet 4: Club Terbaik (Tabel medali club)</li>
              <li>Layout dioptimalkan untuk cetak kertas F4</li>
              <li>Tersedia area kosong di bagian atas untuk penempelan Logo Event</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Laporan Excel (.xlsx)
            </button>
            <Link
              to={`/events`}
              className="flex items-center justify-center gap-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 px-8 rounded-xl transition-all"
            >
              Kembali
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficialReportPage;
