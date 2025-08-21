

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
  return gender === 'Male' ? 'Putra' : 'Putri';
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
      // Step A: Create a list of swimmers eligible for medals for this specific race.
      // A swimmer is ONLY eligible if they have a valid final time AND
      // do NOT have a disqualifying remark (SP, DQ, DNS, DNF).
      const eligibleEntries = raceEntries.filter(entry => {
          const hasValidTime = entry.time && timeToMilliseconds(entry.time) > 0;
          if (!hasValidTime) return false;

          const remark = (entry.remarks || '').trim().toUpperCase();
          const isDisqualified = ['SP', 'DQ', 'DNS', 'DNF'].includes(remark);
          
          return !isDisqualified; // Only return true if they are NOT disqualified
      });

      // If no swimmers are eligible for this race, skip to the next race.
      if (eligibleEntries.length === 0) {
          return;
      }

      // Step B: Sort the eligible swimmers by their final time, fastest first.
      eligibleEntries.sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));

      // Step C: Assign ranks based on time, correctly handling ties (e.g., 1, 2, 2, 4).
      let lastTimeMs = -1;
      let currentRank = 0;
      eligibleEntries.forEach((entry, index) => {
          const currentTimeMs = timeToMilliseconds(entry.time!);
          if (currentTimeMs > lastTimeMs) {
              currentRank = index + 1; // Rank is the 1-based index
          }
          entry.rank = currentRank;
          lastTimeMs = currentTimeMs;
      });

      // Step D: Award medals based on the assigned ranks, following competition rules for ties.
      const goldWinners = eligibleEntries.filter(e => e.rank === 1);
      const silverWinners = eligibleEntries.filter(e => e.rank === 2);
      const bronzeWinners = eligibleEntries.filter(e => e.rank === 3);

      // Gold is awarded to all rank 1 finishers.
      goldWinners.forEach(swimmer => getMedalCounts(swimmer.swimmerId).gold += 1);

      // Silver is awarded only if there's no tie for first place.
      if (goldWinners.length <= 1) {
          silverWinners.forEach(swimmer => getMedalCounts(swimmer.swimmerId).silver += 1);
      }

      // Bronze is awarded only if the top two ranks are not filled by 3 or more swimmers.
      const numGold = goldWinners.length;
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
        console.error("Failed to load data for Best Swimmers page:", err);
        setError(err.message || "Could not load data.");
      } finally {
        setLoading(false);
      }
    };
    fetchPageData();
  }, [eventId, calculateBestSwimmers]);

  const handlePrint = () => {
    if (!event || bestSwimmers.length === 0) return;
    const printData: BestSwimmersPrintData = { event, bestSwimmers };
    navigate(`/events/${event.id}/best-swimmers/print`, { state: { printData } });
  };

  if (loading) return <LoadingSpinner text="Calculating Best Swimmers..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  if (!event) return <div className="text-center py-10">Event not found.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className='text-center sm:text-left'>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 uppercase">PEMAIN TERBAIK: {event.name.toUpperCase()}</h1>
            <p className="text-md text-gray-600 dark:text-gray-300">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event.location}</p>
            <div className="mt-2 flex items-center justify-center sm:justify-start space-x-4 text-sm font-medium">
              <Link to={`/events/${event.id}/program`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Buku Acara</Link>
              <Link to={`/events/${event.id}/results-book`} className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light">Buku Hasil</Link>
              <span className="text-primary font-bold dark:text-primary-light">Pemain Terbaik</span>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <Link to="/events" className="text-primary hover:underline whitespace-nowrap">&larr; Daftar Event</Link>
            {bestSwimmers.length > 0 && (
              <button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center" title="Cetak / Simpan PDF">
                <PrinterIcon className="h-5 w-5 mr-2" /> Cetak / Simpan PDF
              </button>
            )}
          </div>
        </div>
      </header>

      {bestSwimmers.length === 0 && !loading && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="mb-2 text-xl">Belum ada data untuk menentukan Pemain Terbaik.</p>
          <p>Pastikan hasil akhir (final time) dan peringkat (rank) sudah dihitung di Buku Hasil.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bestSwimmers.map((categoryResult) => (
          <div key={categoryResult.categoryTitle} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-primary dark:text-primary-light mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
              {categoryResult.categoryTitle}
            </h2>
            <ul className="space-y-3">
              {categoryResult.swimmers.map((swimmer) => (
                <li key={swimmer.swimmerId} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <AwardIcon className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{swimmer.swimmerName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{swimmer.swimmerClubName}</p>
                    {swimmer.swimmerSchoolName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">{swimmer.swimmerSchoolName}</p>
                    )}
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 flex items-center justify-start space-x-3">
                        <span title="Emas" className="font-bold">🥇 {swimmer.goldMedalCount}</span>
                        <span title="Perak" className="font-bold">🥈 {swimmer.silverMedalCount}</span>
                        <span title="Perunggu" className="font-bold">🥉 {swimmer.bronzeMedalCount}</span>
                    </div>
                  </div>
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