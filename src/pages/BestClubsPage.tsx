import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { SwimEvent, SwimResult, Swimmer, ResultEntry, BestClubInfo, BestClubsPrintData } from '../types';
import { getEventById, getResults, getSwimmers } from '../services/api';
import { timeToMilliseconds } from '../utils/timeUtils';
import { getAgeGroup } from '../utils/ageUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { PrinterIcon } from '../components/icons/PrinterIcon';
import { TrophyIcon } from '../components/icons/TrophyIcon';

const BestClubsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bestClubs, setBestClubs] = useState<BestClubInfo[]>([]);

  const calculateBestClubs = useCallback((event: SwimEvent, results: SwimResult[], swimmers: Swimmer[]): BestClubInfo[] => {
    if (!results.length || !swimmers.length) return [];

    const groupedByRace = new Map<string, ResultEntry[]>();
    const eventResults = results.filter(r => r.eventId === event.id);

    eventResults.forEach(result => {
      const swimmer = swimmers.find(s => s.id === result.swimmerId);
      if (!swimmer || !swimmer.dob) return;
      const ageGroup = getAgeGroup(swimmer, event);
      if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;
      const entry: ResultEntry = { ...result, swimmerName: swimmer.name, swimmerClubName: swimmer.clubName, swimmerSchoolName: swimmer.schoolName };
      const raceKey = `${result.style}-${result.distance}-${swimmer.gender}-${ageGroup}`;
      if (!groupedByRace.has(raceKey)) groupedByRace.set(raceKey, []);
      groupedByRace.get(raceKey)!.push(entry);
    });

    const clubMedalCounts = new Map<string, { gold: number; silver: number; bronze: number }>();
    const getClubMedalCounts = (clubName: string) => {
      if (!clubMedalCounts.has(clubName)) {
        clubMedalCounts.set(clubName, { gold: 0, silver: 0, bronze: 0 });
      }
      return clubMedalCounts.get(clubName)!;
    };

    groupedByRace.forEach((raceEntries) => {
      const eligibleEntries: ResultEntry[] = raceEntries
        .filter(entry => {
          const hasValidTime = entry.time && timeToMilliseconds(entry.time) > 0;
          if (!hasValidTime) return false;
          const remark = (entry.remarks || '').trim().toUpperCase();
          return !['SP', 'DQ', 'DNS', 'DNF'].includes(remark);
        })
        .sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));
      
      if (eligibleEntries.length === 0) return;

      let lastTimeMs = -1;
      let currentRank = 0;
      eligibleEntries.forEach((entry, index) => {
        const currentTimeMs = timeToMilliseconds(entry.time!);
        if (currentTimeMs > lastTimeMs) {
          currentRank = index + 1;
        }
        entry.rank = currentRank;
        lastTimeMs = currentTimeMs;
      });

      const goldWinners = eligibleEntries.filter(e => e.rank === 1);
      const silverWinners = eligibleEntries.filter(e => e.rank === 2);
      const bronzeWinners = eligibleEntries.filter(e => e.rank === 3);

      goldWinners.forEach(swimmer => getClubMedalCounts(swimmer.swimmerClubName).gold += 1);

      if (goldWinners.length <= 1) {
        silverWinners.forEach(swimmer => getClubMedalCounts(swimmer.swimmerClubName).silver += 1);
      }

      const numGold = goldWinners.length;
      const numSilver = (goldWinners.length <= 1) ? silverWinners.length : 0;
      if (numGold + numSilver < 3) {
        bronzeWinners.forEach(swimmer => getClubMedalCounts(swimmer.swimmerClubName).bronze += 1);
      }
    });

    const rankedClubs: BestClubInfo[] = Array.from(clubMedalCounts.entries())
        .map(([clubName, medals]) => ({
            clubName,
            goldMedalCount: medals.gold,
            silverMedalCount: medals.silver,
            bronzeMedalCount: medals.bronze,
        }))
        .filter(club => club.goldMedalCount > 0 || club.silverMedalCount > 0 || club.bronzeMedalCount > 0);

    rankedClubs.sort((a, b) => {
        if (b.goldMedalCount !== a.goldMedalCount) return b.goldMedalCount - a.goldMedalCount;
        if (b.silverMedalCount !== a.silverMedalCount) return b.silverMedalCount - a.silverMedalCount;
        return b.bronzeMedalCount - a.bronzeMedalCount;
    });

    let lastScore = { g: -1, s: -1, b: -1 };
    let currentRank = 0;
    rankedClubs.forEach((club, index) => {
        if (
            club.goldMedalCount !== lastScore.g ||
            club.silverMedalCount !== lastScore.s ||
            club.bronzeMedalCount !== lastScore.b
        ) {
            currentRank = index + 1;
            lastScore = { g: club.goldMedalCount, s: club.silverMedalCount, b: club.bronzeMedalCount };
        }
        club.rank = currentRank;
    });

    return rankedClubs;
  }, []);

  useEffect(() => {
    const fetchPageData = async () => {
      if (!eventId) {
        setError("Event ID is missing.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [eventData, resultsData, swimmersData] = await Promise.all([
          getEventById(eventId),
          getResults(),
          getSwimmers(),
        ]);

        if (!eventData) throw new Error(`Event with ID ${eventId} not found.`);

        setEvent(eventData);
        const bestClubsData = calculateBestClubs(eventData, resultsData, swimmersData);
        setBestClubs(bestClubsData);

      } catch (err: any) {
        console.error("Failed to load best clubs data:", err);
        setError(err.message || "Could not load best clubs data.");
      } finally {
        setLoading(false);
      }
    };
    if (eventId) {
      fetchPageData();
    }
  }, [eventId, calculateBestClubs]);

  const handlePrint = () => {
    if (!event || !bestClubs.length) return;

    const printData: BestClubsPrintData = {
      event,
      bestClubs
    };
    navigate(`/events/${event.id}/best-clubs/print`, { state: { printData } });
  };

  if (loading) return <LoadingSpinner text="Calculating best clubs..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  if (!event && !loading) return <div className="text-center py-10">Event not found.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className='text-center sm:text-left'>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 uppercase">PERKUMPULAN TERBAIK: {event?.name.toUpperCase()}</h1>
            <p className="text-md text-gray-600 dark:text-gray-300">{new Date(event!.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event?.location}</p>
             <div className="mt-2 flex items-center justify-center sm:justify-start space-x-4 text-sm font-medium">
              <Link to={`/events/${event.id}/program`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Buku Acara</Link>
              <Link to={`/events/${event.id}/results-book`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Buku Hasil</Link>
              <Link to={`/events/${event.id}/best-swimmers`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Pemain Terbaik</Link>
              <span className="text-primary font-bold dark:text-primary-light">Klub Terbaik</span>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <Link to="/events" className="text-primary hover:underline whitespace-nowrap">&larr; Daftar Event</Link>
            {bestClubs.length > 0 && (
              <button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center" title="Cetak / Simpan PDF Daftar Klub Terbaik">
                  <PrinterIcon className="h-5 w-5 mr-2" /> Cetak / Simpan PDF
              </button>
            )}
          </div>
        </div>
      </header>

      {bestClubs.length === 0 && !loading && (
         <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <p className="mb-2 text-xl">Belum ada klub terbaik yang dapat ditentukan.</p>
            <p>Ini bisa terjadi karena belum ada hasil final yang dimasukkan, atau belum ada klub yang berhasil meraih medali.</p>
          </div>
      )}
      
      {bestClubs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-5">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">🥇 Gold</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">🥈 Silver</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">🥉 Bronze</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {bestClubs.map((club) => (
                            <tr key={club.clubName} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">{club.rank}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">{club.clubName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{club.goldMedalCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{club.silverMedalCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{club.bronzeMedalCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default BestClubsPage;
