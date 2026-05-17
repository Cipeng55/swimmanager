import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SwimEvent, SwimResult, Swimmer, User, BestSwimmerInfo, ClubMedalInfo, RaceDefinition } from '../types';
import { getEventById, getResults, getSwimmers, getAllUsers } from '../services/api';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils';
import { exportEventToExcel, generateDetailedProgramData, generateDetailedResultsData } from '../services/excelService';
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

  const handleExport = () => {
    if (!event) return;

    // 1. Process Program Data
    // (Logic simplified to get race groups)
    const raceMap = new Map<string, { definition: RaceDefinition; lanes: any[] }>();
    results.forEach(res => {
        const swimmer = swimmers.find(s => s.id === res.swimmerId);
        if (!swimmer) return;
        const ageGroup = getAgeGroup(swimmer, event);
        const key = `${res.style}-${res.distance}-${swimmer.gender}-${ageGroup}`;
        
        if (!raceMap.has(key)) {
            raceMap.set(key, {
                definition: { style: res.style, distance: res.distance, gender: swimmer.gender, ageGroup },
                lanes: []
            });
        }
        raceMap.get(key)!.lanes.push({ swimmer, entryTime: res.entryTime, laneNumber: res.laneNumber });
    });

    const sortedRaces = Array.from(raceMap.values()).sort((a, b) => {
        const ageComp = getSortableAgeGroup(a.definition.ageGroup, event) - getSortableAgeGroup(b.definition.ageGroup, event);
        if (ageComp !== 0) return ageComp;
        return a.definition.style.localeCompare(b.definition.style);
    });

    const programData = generateDetailedProgramData(event, sortedRaces.map(r => ({ ...r, heats: [{ lanes: r.lanes }] })));

    // 2. Process Results Data
    const resultsByRace = sortedRaces.map(r => {
        const raceResults = results.filter(res => {
            const s = swimmers.find(sw => sw.id === res.swimmerId);
            return s && getAgeGroup(s, event) === r.definition.ageGroup && res.style === r.definition.style && res.distance === r.definition.distance;
        }).map(res => {
            const s = swimmers.find(sw => sw.id === res.swimmerId);
            return {
                swimmerName: s?.name || 'Unknown',
                swimmerSchoolName: s?.schoolName || '-',
                time: res.time || 'NT',
                status: res.status || 'OK',
                rank: res.finalRank || 0
            };
        }).sort((a, b) => (a.rank || 999) - (b.rank || 999));

        return { definition: r.definition, results: raceResults };
    });

    const resultsData = generateDetailedResultsData(event, resultsByRace);

    // 3. Process Best Swimmers (Logic from BestSwimmersPage)
    const medalCountsBySwimmer = new Map<string, { gold: number; silver: number; bronze: number }>();
    results.forEach(res => {
      if (res.finalRank === 1 || res.finalRank === 2 || res.finalRank === 3) {
        if (!medalCountsBySwimmer.has(res.swimmerId)) {
          medalCountsBySwimmer.set(res.swimmerId, { gold: 0, silver: 0, bronze: 0 });
        }
        const counts = medalCountsBySwimmer.get(res.swimmerId)!;
        if (res.finalRank === 1) counts.gold++;
        else if (res.finalRank === 2) counts.silver++;
        else counts.bronze++;
      }
    });

    const recordLookup = new Map<string, number>();
    if (event.nationalRecords) {
      event.nationalRecords.forEach(rec => {
        const parts = rec.time.split(/[:.]/);
        let ms = 0;
        if (parts.length === 3) {
          ms = (parseInt(parts[0]) * 60000) + (parseInt(parts[1]) * 1000) + (parseInt(parts[2]) * 10);
        }
        if (ms > 0) recordLookup.set(`${rec.style}-${rec.distance}-${rec.gender}-${rec.ageGroup}`, ms);
      });
    }

    const swimmersInCategory = new Map<string, BestSwimmerInfo[]>();
    
    // Help helper for time conversion
    const timeToMs = (timeStr: string) => {
        const parts = timeStr.split(/[:.]/);
        if (parts.length === 3) {
            return (parseInt(parts[0]) * 60000) + (parseInt(parts[1]) * 1000) + (parseInt(parts[2]) * 10);
        }
        return 0;
    };

    swimmers.forEach(swimmer => {
      if (medalCountsBySwimmer.has(swimmer.id)) {
        const ageGroup = getAgeGroup(swimmer, event);
        const categoryKey = `${ageGroup} ${swimmer.gender === 'Male' ? 'Putra' : 'Putri'}`;
        const medals = medalCountsBySwimmer.get(swimmer.id)!;
        
        // Performance Score Calculation
        let totalPerf = 0;
        let count = 0;
        results.filter(r => r.swimmerId === swimmer.id).forEach(res => {
            if (!res.time) return;
            const resMs = timeToMs(res.time);
            const key = `${res.style}-${res.distance}-${swimmer.gender}-${ageGroup}`;
            const recMs = recordLookup.get(key);
            if (recMs && resMs > 0) {
                totalPerf += (recMs / resMs) * 1000;
                count++;
            }
        });

        if (!swimmersInCategory.has(categoryKey)) {
          swimmersInCategory.set(categoryKey, []);
        }
        swimmersInCategory.get(categoryKey)!.push({
          swimmerId: swimmer.id,
          swimmerName: swimmer.name,
          swimmerSchoolName: swimmer.schoolName,
          categoryTitle: categoryKey,
          goldMedalCount: medals.gold,
          silverMedalCount: medals.silver,
          bronzeMedalCount: medals.bronze,
          performanceScore: count > 0 ? totalPerf : 0
        });
      }
    });

    const bestSwimmersData: any[] = [
        [event.name.toUpperCase()],
        [`DAFTAR PEMAIN TERBAIK / BEST SWIMMERS`],
        [],
        ['Rank', 'Kategori', 'Nama Atlet', 'Sekolah/Club', 'Emas', 'Perak', 'Perunggu', 'Poin Rekor']
    ];

    Array.from(swimmersInCategory.entries()).forEach(([cat, list]) => {
      list.sort((a, b) => {
        if (b.goldMedalCount !== a.goldMedalCount) return b.goldMedalCount - a.goldMedalCount;
        if (b.silverMedalCount !== a.silverMedalCount) return b.silverMedalCount - a.silverMedalCount;
        if (b.bronzeMedalCount !== a.bronzeMedalCount) return b.bronzeMedalCount - a.bronzeMedalCount;
        return (b.performanceScore || 0) - (a.performanceScore || 0);
      });
      list.forEach((s, idx) => {
        bestSwimmersData.push([idx + 1, s.categoryTitle, s.swimmerName, s.swimmerSchoolName || '-', s.goldMedalCount, s.silverMedalCount, s.bronzeMedalCount, s.performanceScore?.toFixed(2) || '0.00']);
      });
      bestSwimmersData.push([]); 
    });

    // 4. Process Club Medals
    const clubMap = new Map<string, { gold: number; silver: number; bronze: number }>();
    results.forEach(res => {
      const swimmer = swimmers.find(s => s.id === res.swimmerId);
      if (!swimmer || !swimmer.userId) return;
      const clubId = swimmer.userId;
      if (!clubMap.has(clubId)) clubMap.set(clubId, { gold: 0, silver: 0, bronze: 0 });
      const counts = clubMap.get(clubId)!;
      if (res.finalRank === 1) counts.gold++;
      else if (res.finalRank === 2) counts.silver++;
      else if (res.finalRank === 3) counts.bronze++;
    });

    const clubMedals: any[] = Array.from(clubMap.entries()).map(([id, counts]) => {
      const user = users.find(u => u.id === id);
      return {
        clubName: user?.clubName || user?.username || 'Unknown',
        gold: counts.gold,
        silver: counts.silver,
        bronze: counts.bronze,
        total: counts.gold + counts.silver + counts.bronze
      };
    }).sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.total - a.total;
    });

    const clubsReportData: any[] = [
        [event.name.toUpperCase()],
        [`PEROLEHAN MEDALI CLUB / SEKOLAH`],
        [],
        ['Rank', 'Nama Club/Sekolah', 'Emas', 'Perak', 'Perunggu', 'Total Medals']
    ];
    clubMedals.forEach((c, idx) => {
        clubsReportData.push([idx + 1, c.clubName, c.gold, c.silver, c.bronze, c.total]);
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Program
    const wsProgram = XLSX.utils.aoa_to_sheet(programData);
    wsProgram['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsProgram, "Buku Acara");

    // Sheet 2: Results
    const wsResults = XLSX.utils.aoa_to_sheet(resultsData);
    wsResults['!cols'] = [{ wch: 8 }, { wch: 35 }, { wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 10 }];
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
