import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { SwimEvent, SwimResult, Swimmer, ResultEntry, BestSwimmerCategoryResult, BestSwimmerInfo, BestSwimmersPrintData } from '../types';
import { getEventById, getResults, getSwimmers } from '../services/api';
import { timeToMilliseconds } from '../utils/timeUtils';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { PrinterIcon } from '../components/icons/PrinterIcon';
import { AwardIcon } from '../components/icons/AwardIcon';

const genderDisplay = (gender: Swimmer['gender']): string => {
  if (gender === 'Male') return 'Putra';
  if (gender === 'Female') return 'Putri';
  return '';
};

const BestSwimmersPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bestSwimmers, setBestSwimmers] = useState<BestSwimmerCategoryResult[]>([]);

  const calculateBestSwimmers = useCallback((event: SwimEvent, results: SwimResult[], swimmers: Swimmer[]): BestSwimmerCategoryResult[] => {
    if (!results.length || !swimmers.length) return [];

    // 1. Group results by race definition
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

    const medalCountsBySwimmer = new Map<string, { gold: number; silver: number; bronze: number }>();
    const getMedalCounts = (swimmerId: string) => {
        if (!medalCountsBySwimmer.has(swimmerId)) {
            medalCountsBySwimmer.set(swimmerId, { gold: 0, silver: 0, bronze: 0 });
        }
        return medalCountsBySwimmer.get(swimmerId)!;
    };

    // 2. For each race, rank swimmers and award medals, correctly handling ties
    groupedByRace.forEach((raceEntries) => {
      // Step A: Filter out swimmers not eligible for medals. This is the critical step.
      const eligibleEntries: ResultEntry[] = raceEntries
        .filter(entry => {
          const hasValidTime = entry.time && timeToMilliseconds(entry.time) > 0;
          if (!hasValidTime) {
            return false;
          }
          const remark = (entry.remarks || '').trim().toUpperCase();
          if (remark === 'SP' || remark === 'DQ' || remark === 'DNS' || remark === 'DNF') {
            return false;
          }
          return true;
        })
        .sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));
      
      if (eligibleEntries.length === 0) return;

      // Step B: Assign ranks correctly, handling ties (competition ranking).
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

      // Step C: Award medals based on rank, correctly handling ties per competition rules.
      const goldWinners = eligibleEntries.filter(e => e.rank === 1);
      const silverWinners = eligibleEntries.filter(e => e.rank === 2);
      const bronzeWinners = eligibleEntries.filter(e => e.rank === 3);

      // Award Gold medals to all rank 1 swimmers
      goldWinners.forEach(swimmer => getMedalCounts(swimmer.swimmerId).gold += 1);

      // Award Silver medals only if there is no tie for 1st place (i.e., only one gold medalist).
      if (goldWinners.length <= 1) {
        silverWinners.forEach(swimmer => getMedalCounts(swimmer.swimmerId).silver += 1);
      }

      // Award Bronze medals only if the top two spots are not filled by 3 or more swimmers.
      const numGold = goldWinners.length;
      // Silver is only awarded if gold is not a multi-way tie, so we check that condition again here.
      const numSilver = (goldWinners.length <= 1) ? silverWinners.length : 0;
      if (numGold + numSilver < 3) {
        bronzeWinners.forEach(swimmer => getMedalCounts(swimmer.swimmerId).bronze += 1);
      }
    });

    // 3. Group swimmers with medals by their category
    const swimmersWithMedals = swimmers.filter(s => medalCountsBySwimmer.has(s.id));
    const categories = new Map<string, BestSwimmerInfo[]>();

    swimmersWithMedals.forEach(swimmer => {
      const ageGroup = getAgeGroup(swimmer, event);
      const categoryTitle = `${ageGroup} ${genderDisplay(swimmer.gender)}`;
      const medals = medalCountsBySwimmer.get(swimmer.id)!;

      if (!categories.has(categoryTitle)) {
        categories.set(categoryTitle, []);
      }
      categories.get(categoryTitle)!.push({
        swimmerId: swimmer.id,
        swimmerName: swimmer.name,
        swimmerClubName: swimmer.clubName,
        swimmerSchoolName: swimmer.schoolName,
        goldMedalCount: medals.gold,
        silverMedalCount: medals.silver,
        bronzeMedalCount: medals.bronze,
      });
    });

    // 4. Find the best swimmer(s) in each category
    const finalResult: BestSwimmerCategoryResult[] = [];
    categories.forEach((swimmersInCategory, categoryTitle) => {
      swimmersInCategory.sort((a, b) => {
        if (b.goldMedalCount !== a.goldMedalCount) return b.goldMedalCount - a.goldMedalCount;
        if (b.silverMedalCount !== a.silverMedalCount) return b.silverMedalCount - a.silverMedalCount;
        return b.bronzeMedalCount - a.bronzeMedalCount;
      });

      const bestSwimmerScore = swimmersInCategory[0];
      if (bestSwimmerScore && (bestSwimmerScore.goldMedalCount > 0 || bestSwimmerScore.silverMedalCount > 0 || bestSwimmerScore.bronzeMedalCount > 0)) {
        const bestInCategory = swimmersInCategory.filter(s => 
            s.goldMedalCount === bestSwimmerScore.goldMedalCount &&
            s.silverMedalCount === bestSwimmerScore.silverMedalCount &&
            s.bronzeMedalCount === bestSwimmerScore.bronzeMedalCount
        );
        finalResult.push({ categoryTitle, swimmers: bestInCategory });
      }
    });

    // 5. Sort the final categories
    finalResult.sort((a, b) => {
      const ageGroupA = a.categoryTitle.split(' ')[0];
      const ageGroupB = b.categoryTitle.split(' ')[0];
      const sortA = getSortableAgeGroup(ageGroupA);
      const sortB = getSortableAgeGroup(ageGroupB);
      if (sortA !== sortB) return sortA - sortB;
      return a.categoryTitle.localeCompare(b.categoryTitle); // Fallback sort by full title
    });

    return finalResult;
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
        const bestSwimmersData = calculateBestSwimmers(eventData, resultsData, swimmersData);
        setBestSwimmers(bestSwimmersData);

      } catch (err: any) {
        console.error("Failed to load best swimmers data:", err);
        setError(err.message || "Could not load best swimmers data.");
      } finally {
        setLoading(false);
      }
    };
    if (eventId) {
      fetchPageData();
    }
  }, [eventId, calculateBestSwimmers]);

  const handlePrint = () => {
    if (!event || !bestSwimmers.length) return;

    const printData: BestSwimmersPrintData = {
      event,
      bestSwimmers
    };
    navigate(`/events/${event.id}/best-swimmers/print`, { state: { printData } });
  };

  if (loading) return <LoadingSpinner text="Calculating best swimmers..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  if (!event && !loading) return <div className="text-center py-10">Event not found.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className='text-center sm:text-left'>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 uppercase">DAFTAR PEMAIN TERBAIK: {event?.name.toUpperCase()}</h1>
            <p className="text-md text-gray-600 dark:text-gray-300">{new Date(event!.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event?.location}</p>
             <div className="mt-2 flex items-center justify-center sm:justify-start space-x-4 text-sm font-medium">
              <Link to={`/events/${event.id}/program`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Buku Acara</Link>
              <Link to={`/events/${event.id}/results-book`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Buku Hasil</Link>
              <span className="text-primary font-bold dark:text-primary-light">Pemain Terbaik</span>
              <Link to={`/events/${event.id}/best-clubs`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Klub Terbaik</Link>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <Link to="/events" className="text-primary hover:underline whitespace-nowrap">&larr; Daftar Event</Link>
            {bestSwimmers.length > 0 && (
              <button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center" title="Cetak / Simpan PDF Daftar Pemain Terbaik">
                  <PrinterIcon className="h-5 w-5 mr-2" /> Cetak / Simpan PDF
              </button>
            )}
          </div>
        </div>
      </header>

      {bestSwimmers.length === 0 && !loading && (
         <div className="text-center text-gray-500 dark:text-gray-400 py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <p className="mb-2 text-xl">Belum ada pemain terbaik yang dapat ditentukan.</p>
            <p>Ini bisa terjadi karena belum ada hasil final yang dimasukkan, atau belum ada perenang yang berhasil meraih medali.</p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bestSwimmers.map((categoryResult) => (
          <div key={categoryResult.categoryTitle} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-5 flex flex-col items-center text-center transform hover:-translate-y-1 transition-transform duration-300">
            <h3 className="text-xl font-bold text-primary dark:text-primary-light mb-3">
              {categoryResult.categoryTitle}
            </h3>
            <ul className="space-y-3 w-full">
              {categoryResult.swimmers.map((swimmer) => (
                <li key={swimmer.swimmerId} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                    <AwardIcon className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                    <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">{swimmer.swimmerName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{swimmer.swimmerClubName}</p>
                    {swimmer.swimmerSchoolName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{swimmer.swimmerSchoolName}</p>
                    )}
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mt-2">
                      🥇{swimmer.goldMedalCount} 🥈{swimmer.silverMedalCount} 🥉{swimmer.bronzeMedalCount}
                    </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BestSwimmersPage;