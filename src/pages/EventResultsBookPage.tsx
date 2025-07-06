
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { SwimEvent, SwimResult, Swimmer, RaceResults, ResultEntry, ResultsBookPrintData } from '../types';
import { getEventById, getResults, getSwimmers } from '../services/api';
import { timeToMilliseconds } from '../utils/timeUtils';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils'; 
import LoadingSpinner from '../components/common/LoadingSpinner';
import ResultsBookDisplay from '../components/ResultsBookDisplay';
import { PrinterIcon } from '../components/icons/PrinterIcon'; 

const genderDisplay = (gender: Swimmer['gender'] | 'Mixed'): string => { return gender === 'Male' ? 'PUTRA' : 'PUTRI'; };

const EventResultsBookPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>(); 
  const navigate = useNavigate(); 
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processedRaceResults, setProcessedRaceResults] = useState<RaceResults[]>([]);

  // This data processing logic is similar to PrintableResultsBook, now used on the interactive page
  const processDataForBook = useCallback((event: SwimEvent, results: SwimResult[], swimmers: Swimmer[]): RaceResults[] => {
    if (!results.length || !swimmers.length || !event) return [];
    
    const groupedByRace = new Map<string, ResultEntry[]>();
    const nonRankingRemarkValues = ['DQ', 'DNS', 'DNF'];

    const eventResults = results.filter(r => r.eventId === event.id);

    eventResults.forEach(result => {
      const swimmer = swimmers.find(s => s.id === result.swimmerId);
      if (!swimmer || !swimmer.dob) return;
      const ageGroup = getAgeGroup(swimmer, event);
      if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;
      
      const entry: ResultEntry = { ...result, swimmerName: swimmer.name, swimmerClub: swimmer.club, seedTimeStr: result.seedTime || undefined };
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
      
      rankableEntries.sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));
      rankableEntries.forEach((entry, index) => { entry.rank = index + 1; });
      nonRankableEntries.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));
      
      finalRaces.push({
        definition: { style, distance: parseInt(distanceStr), gender: gender as Swimmer['gender'], ageGroup },
        results: [...rankableEntries, ...nonRankableEntries]
      });
    });

    finalRaces.sort((a, b) => {
        const styleOrder = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle', 'IM', 'Kick Breaststroke', 'Kick Butterfly', 'Kick Freestyle', 'Freestyle Relay', 'Medley Relay'];
        const ageGroupComparison = getSortableAgeGroup(a.definition.ageGroup) - getSortableAgeGroup(b.definition.ageGroup);
        if (ageGroupComparison !== 0) return ageGroupComparison;
        const styleAIndex = styleOrder.indexOf(a.definition.style);
        const styleBIndex = styleOrder.indexOf(b.definition.style);
        if (styleAIndex !== styleBIndex) return (styleAIndex === -1 ? 99 : styleAIndex) - (styleBIndex === -1 ? 99 : styleBIndex);
        if (a.definition.distance !== b.definition.distance) return a.definition.distance - b.definition.distance;
        if (a.definition.gender === 'Male' && b.definition.gender === 'Female') return -1;
        if (a.definition.gender === 'Female' && b.definition.gender === 'Male') return 1;
        return 0;
    });

    return finalRaces;
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
        const numericEventId = parseInt(eventId);
        if (isNaN(numericEventId)) {
          throw new Error("Invalid Event ID format.");
        }
        
        const [eventData, resultsData, swimmersData] = await Promise.all([
          getEventById(numericEventId),
          getResults(),
          getSwimmers(),
        ]);

        if (!eventData) {
          throw new Error(`Event with ID ${numericEventId} not found.`);
        }
        
        setEvent(eventData);
        const processedData = processDataForBook(eventData, resultsData, swimmersData);
        setProcessedRaceResults(processedData);

      } catch (err: any) {
        console.error("Failed to load event results book data:", err);
        setError(err.message || "Could not load event results book data.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchPageData();
  }, [eventId, processDataForBook]);

  const handlePrintResultsBook = () => {
    if (!event || processedRaceResults.length === 0) return;

    const printData: ResultsBookPrintData = {
      event,
      processedRaceResults
    };
    navigate(`/events/${event.id}/results-book/print`, { state: { printData } });
  };

  if (loading) return <LoadingSpinner text="Loading event results book..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  if (!event && !loading) return <div className="text-center py-10">Event not found. Check if the Event ID in the URL is correct.</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className='text-center sm:text-left'>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 uppercase">BUKU HASIL: {event?.name.toUpperCase()}</h1>
            <p className="text-md text-gray-600 dark:text-gray-300">{new Date(event!.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event?.location}</p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <Link to="/events" className="text-primary hover:underline whitespace-nowrap">&larr; Daftar Event</Link>
            {processedRaceResults.length > 0 && (
              <button onClick={handlePrintResultsBook} className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center" title="Cetak / Simpan PDF Buku Hasil">
                  <PrinterIcon className="h-5 w-5 mr-2" /> Cetak / Simpan PDF
              </button>
            )}
          </div>
        </div>
      </header>

      {processedRaceResults.length === 0 && !loading && (
         <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No official results could be generated for this event.</p>
            <p>This could be because results have not been recorded or finalized yet. Check the Event Program page to enter times.</p>
          </div>
      )}

      {processedRaceResults.map((raceResult, index) => (
        <section key={`${index}-${raceResult.definition.style}`} className="mb-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            {raceResult.definition.distance}m {raceResult.definition.style.toUpperCase()} - {raceResult.definition.ageGroup.toUpperCase()} - {genderDisplay(raceResult.definition.gender)}
          </h2>
          <ResultsBookDisplay raceResults={raceResult} isGradeSystem={event?.categorySystem === 'GRADE'}/>
        </section>
      ))}
    </div>
  );
};

export default EventResultsBookPage;
