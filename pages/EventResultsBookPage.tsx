

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { SwimEvent, SwimResult, Swimmer, RaceDefinition, RaceResults, ResultEntry, ResultsBookPrintData } from '../types';
import { getEventById, getResults, getSwimmers } from '../services/api';
import { timeToMilliseconds } from '../utils/timeUtils';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils'; 
import LoadingSpinner from '../components/common/LoadingSpinner';
import ResultsBookDisplay from '../components/ResultsBookDisplay';
import { PrinterIcon } from '../components/icons/PrinterIcon';
import { useAuth } from '../contexts/AuthContext'; 

const EventResultsBookPage: React.FC = () => {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>(); 
  const navigate = useNavigate(); 
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [results, setResults] = useState<SwimResult[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth(); 

  const fetchPageData = useCallback(async () => { 
    if (!eventIdParam) { 
      setError("Event ID is missing."); 
      setLoading(false); 
      return; 
    }
    setLoading(true); 
    setError(null);
    try {
      const numericEventId = parseInt(eventIdParam);
      if (isNaN(numericEventId)) {
        setError("Invalid Event ID format.");
        setLoading(false);
        return;
      }
      const [eventData, resultsData, swimmersData] = await Promise.all([
        getEventById(numericEventId), 
        getResults(), 
        getSwimmers()
      ]);

      if (!eventData) { 
        setError(`Event with ID ${numericEventId} not found.`); 
        setEvent(null); 
      } else { 
        setEvent(eventData); 
        setResults(resultsData.filter(r => r.eventId === numericEventId)); 
        setSwimmers(swimmersData); 
      }
    } catch (err) { 
      console.error("Failed to load event results data:", err);
      setError("Could not load event results data."); 
    } finally { 
      setLoading(false); 
    }
  }, [eventIdParam]);
  
  useEffect(() => { 
    fetchPageData();
  }, [fetchPageData]);

  const processedRaceResults = useMemo((): RaceResults[] => { 
      if (!results.length || !swimmers.length || !event) return []; 
      
      const groupedByRace = new Map<string, ResultEntry[]>();
      const nonRankingRemarkValues = ['DQ', 'DNS', 'DNF'];
      
      results.forEach(result => {
        const swimmer = swimmers.find(s => s.id === result.swimmerId);
        // Swimmer and their DOB must exist to determine age group for the race.
        // Results without time, or DQ/DNS/DNF will be handled later.
        if (!swimmer || !swimmer.dob) return; 
        
        const ageGroup = getAgeGroup(swimmer, event); 
        if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return; 
        
        const entry: ResultEntry = { 
            ...result, 
            swimmerName: swimmer.name, 
            swimmerClub: swimmer.club, 
            seedTimeStr: result.seedTime || undefined,
            // rank will be assigned later or remain undefined for non-rankable
        };
        
        const raceKey = `${result.style}-${result.distance}-${swimmer.gender}-${ageGroup}`; 
        if (!groupedByRace.has(raceKey)) groupedByRace.set(raceKey, []);
        groupedByRace.get(raceKey)!.push(entry);
      });
      
      const finalRaces: RaceResults[] = [];
      groupedByRace.forEach((raceEntries, raceKey) => {
        const [style, distanceStr, gender, ageGroup] = raceKey.split('-'); 
        
        const rankableEntries: ResultEntry[] = [];
        const nonRankableEntries: ResultEntry[] = [];

        raceEntries.forEach(entry => {
          const isNonRankableRemark = entry.remarks && nonRankingRemarkValues.includes(entry.remarks.toUpperCase());
          const hasValidTime = entry.time && timeToMilliseconds(entry.time) > 0;

          if (isNonRankableRemark || !hasValidTime) {
            nonRankableEntries.push(entry);
          } else {
            rankableEntries.push(entry);
          }
        });

        // Sort and rank the rankable entries
        rankableEntries.sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));
        rankableEntries.forEach((entry, index) => { entry.rank = index + 1; });
        
        // Non-rankable entries don't get a rank. Sort them by name or other criteria if needed.
        nonRankableEntries.sort((a,b) => a.swimmerName.localeCompare(b.swimmerName));
        
        finalRaces.push({ 
          definition: { style, distance: parseInt(distanceStr), gender: gender as Swimmer['gender'], ageGroup }, 
          results: [...rankableEntries, ...nonRankableEntries] 
        });
      });
      
      finalRaces.sort((a,b) => {
        const ageGroupComparison = getSortableAgeGroup(a.definition.ageGroup) - getSortableAgeGroup(b.definition.ageGroup);
        if (ageGroupComparison !== 0) return ageGroupComparison;
        
        const styleOrder = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle', 'IM', 'Kick Breaststroke', 'Kick Butterfly', 'Kick Freestyle', 'Freestyle Relay', 'Medley Relay'];
        const styleAIndex = styleOrder.indexOf(a.definition.style);
        const styleBIndex = styleOrder.indexOf(b.definition.style);
        if (styleAIndex !== styleBIndex) return (styleAIndex === -1 ? 99 : styleAIndex) - (styleBIndex === -1 ? 99 : styleBIndex);
        
        if (a.definition.distance !== b.definition.distance) return a.definition.distance - b.definition.distance;
        
        if (a.definition.gender === 'Male' && b.definition.gender === 'Female') return -1;
        if (a.definition.gender === 'Female' && b.definition.gender === 'Male') return 1;
        
        return 0;
      });

      return finalRaces;
  }, [results, swimmers, event]); 

  const genderDisplay = (gender: Swimmer['gender'] | 'Mixed'): string => { return gender === 'Male' ? 'PUTRA' : 'PUTRI'; };

  const handlePrintResultsBook = () => {
    if (!event || !processedRaceResults.length) return;
    const printData: ResultsBookPrintData = {
      event, 
      processedRaceResults
    };
    navigate(`/events/${event.id}/results-book/print`, { state: { printData } });
  };

  if (loading) return <LoadingSpinner text="Loading event results book..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  if (!event) return <div className="text-center py-10">Event not found. Check if the Event ID in the URL is correct.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className='text-center sm:text-left'>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Buku Hasil: {event.name.toUpperCase()}</h1>
                <p className="text-md text-gray-600 dark:text-gray-300">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event.location}</p>
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sistem Kategori: {event?.categorySystem || 'KU'}
                </p>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Link to="/events" className="text-primary hover:underline whitespace-nowrap">&larr; Daftar Event</Link>
                {processedRaceResults.length > 0 && ( 
                    <button onClick={handlePrintResultsBook} className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center" title="Cetak / Simpan PDF Buku Hasil">
                        <PrinterIcon className="h-5 w-5 mr-2" /> Cetak / Simpan PDF Buku Hasil
                    </button>
                )}
            </div>
        </div>
      </header>

      {processedRaceResults.length === 0 && !loading && (
         <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No official results found for this event.</p>
            <p>This could be because:</p>
            <ul className="list-disc list-inside inline-block text-left">
              <li>No results with final times have been recorded for this event.</li>
              <li>Swimmers associated with results are missing Date of Birth (or Grade Level for Grade System events).</li>
              <li>All valid results might have been marked as DQ, DNS, or DNF.</li>
              <li>The chosen Category System ({event?.categorySystem || 'KU'}) resulted in no valid result groupings for the available data.</li>
            </ul>
          </div>
      )}

      {processedRaceResults.map((raceResult, index) => (
        <section key={`${index}-${raceResult.definition.style}-${raceResult.definition.distance}-${raceResult.definition.gender}-${raceResult.definition.ageGroup}`} className="mb-12 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            {raceResult.definition.distance}m {raceResult.definition.style.toUpperCase()} - {raceResult.definition.ageGroup.toUpperCase()} - {genderDisplay(raceResult.definition.gender)}
          </h2>
          <ResultsBookDisplay raceResults={raceResult} isGradeSystem={event?.categorySystem === 'GRADE'} />
        </section>
      ))}
    </div>
  );
};

export default EventResultsBookPage;