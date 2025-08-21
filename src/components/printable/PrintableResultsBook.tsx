
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { ResultsBookPrintData, SwimEvent, RaceResults, ResultEntry, Swimmer, SwimResult, RaceDefinition } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { getEventById, getResults, getSwimmers, getEventProgramOrder } from '../../services/api';
import { timeToMilliseconds } from '../../utils/timeUtils';
import { getAgeGroup, getSortableAgeGroup } from '../../utils/ageUtils';

const genderDisplayPrint = (gender: Swimmer['gender'] | 'Mixed'): string => {
  return gender === 'Male' ? 'PUTRA' : 'PUTRI';
};

const generateRaceKey = (race: RaceDefinition): string => {
  return `${race.style}-${race.distance}-${race.gender}-${race.ageGroup}`;
};

const defaultRaceSort = (a: RaceDefinition, b: RaceDefinition): number => {
  const styleOrder = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle', 'IM', 'Kick Breaststroke', 'Kick Butterfly', 'Kick Freestyle', 'Freestyle Relay', 'Medley Relay'];
  const ageGroupComparison = getSortableAgeGroup(a.ageGroup) - getSortableAgeGroup(b.ageGroup);
  if (ageGroupComparison !== 0) return ageGroupComparison;
  const styleAIndex = styleOrder.indexOf(a.style);
  const styleBIndex = styleOrder.indexOf(b.style);
   if (styleAIndex !== styleBIndex) {
    return (styleAIndex === -1 ? 99 : styleAIndex) - (styleBIndex === -1 ? 99 : styleBIndex);
  }
  if (a.distance !== b.distance) return a.distance - b.distance;
  if (a.gender === 'Male' && b.gender === 'Female') return -1;
  if (a.gender === 'Female' && b.gender === 'Male') return 1;
  return 0;
};

const PrintableResultsBook: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const initialPrintData = location.state?.printData as ResultsBookPrintData | undefined;
  const printCalled = useRef(false);

  const [printData, setPrintData] = useState<ResultsBookPrintData | null>(initialPrintData || null);
  const [loading, setLoading] = useState<boolean>(!initialPrintData);
  const [error, setError] = useState<string | null>(null);

  const processDataForBook = useCallback((event: SwimEvent, results: SwimResult[], swimmers: Swimmer[], raceKeyToAcaraNumberMap: Map<string, number>): RaceResults[] => {
    if (!results.length || !swimmers.length || !event) return [];
    
    const groupedByRace = new Map<string, ResultEntry[]>();
    results.forEach(result => {
      const swimmer = swimmers.find(s => s.id === result.swimmerId);
      if (!swimmer || !swimmer.dob) return;
      const ageGroup = getAgeGroup(swimmer, event);
      if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;
      const entry: ResultEntry = { ...result, swimmerName: swimmer.name, swimmerClubName: swimmer.clubName, swimmerSchoolName: swimmer.schoolName, seedTimeStr: result.seedTime || undefined };
      const raceKey = `${result.style}-${result.distance}-${swimmer.gender}-${ageGroup}`;
      if (!groupedByRace.has(raceKey)) groupedByRace.set(raceKey, []);
      groupedByRace.get(raceKey)!.push(entry);
    });

    const finalRaces: RaceResults[] = [];
    groupedByRace.forEach((raceEntries, raceKey) => {
      const [style, distanceStr, gender, ageGroup] = raceKey.split('-');
      
      const entriesWithTime: ResultEntry[] = [];
      const entriesWithoutTime: ResultEntry[] = [];

      raceEntries.forEach(entry => {
        const hasValidTime = entry.time && timeToMilliseconds(entry.time) > 0;
        if (hasValidTime) {
          entriesWithTime.push(entry);
        } else {
          entriesWithoutTime.push(entry);
        }
      });
      
      entriesWithTime.sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));
      
      const eligibleForRanking = entriesWithTime.filter(entry => {
          const remark = (entry.remarks || '').trim().toUpperCase();
          return !['DQ', 'DNS', 'DNF', 'SP'].includes(remark);
      });

      const spEntries = entriesWithTime.filter(entry => (entry.remarks || '').trim().toUpperCase() === 'SP');

      if (eligibleForRanking.length > 0) {
        let lastTimeMs = -1;
        let currentRank = 0;
        eligibleForRanking.forEach((entry, index) => {
            const currentTimeMs = timeToMilliseconds(entry.time!);
            if (currentTimeMs > lastTimeMs) {
                currentRank = index + 1; // Competition ranking (e.g., 1, 2, 2, 4)
            }
            entry.rank = currentRank;
            lastTimeMs = currentTimeMs;
        });
      }
      
      const allSortedEntries = [ ...eligibleForRanking, ...spEntries, ...entriesWithoutTime]
        .sort((a,b) => {
          const timeA = a.time ? timeToMilliseconds(a.time) : Infinity;
          const timeB = b.time ? timeToMilliseconds(b.time) : Infinity;
          if(timeA !== Infinity && timeB !== Infinity) return timeA - timeB;
          if(timeA !== Infinity) return -1;
          if(timeB !== Infinity) return 1;
          return a.swimmerName.localeCompare(b.swimmerName);
        });

      finalRaces.push({
        definition: { 
          style, 
          distance: parseInt(distanceStr), 
          gender: gender as Swimmer['gender'], 
          ageGroup,
          acaraNumber: raceKeyToAcaraNumberMap.get(raceKey)
        },
        results: allSortedEntries
      });
    });

    finalRaces.sort((a, b) => {
      if (a.definition.acaraNumber != null && b.definition.acaraNumber != null) {
        return a.definition.acaraNumber - b.definition.acaraNumber;
      }
      if (a.definition.acaraNumber != null) return -1;
      if (b.definition.acaraNumber != null) return 1;

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
  }, []);

  const fetchDataForPrint = useCallback(async () => {
    if (!eventId) {
      setError("Event ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isNaN(parseInt(eventId))) { throw new Error("Invalid Event ID format."); }
      
      const [eventData, resultsData, swimmersData, customOrderedKeys] = await Promise.all([
        getEventById(eventId),
        getResults(),
        getSwimmers(),
        getEventProgramOrder(eventId)
      ]);

      if (!eventData) { throw new Error(`Event with ID ${eventId} not found.`); }
      
      const filteredResults = resultsData.filter(r => r.eventId === eventId);

      const raceMap = new Map<string, RaceDefinition>();
      filteredResults.forEach(result => {
        const swimmer = swimmersData.find(s => s.id === result.swimmerId);
        if (!swimmer || !swimmer.gender || !swimmer.dob || !result.seedTime ) return;
        const ageGroup = getAgeGroup(swimmer, eventData);
        if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;
        const raceKey = generateRaceKey({ style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
        if (!raceMap.has(raceKey)) {
          raceMap.set(raceKey, { style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
        }
      });
      const initialUniqueRaces = Array.from(raceMap.values());

      let orderedRaces: RaceDefinition[] = [];
      if (customOrderedKeys) {
          const initialRacesMap: Map<string, RaceDefinition> = new Map(initialUniqueRaces.map(r => [generateRaceKey(r), r]));
          customOrderedKeys.forEach(key => {
            if (initialRacesMap.has(key)) {
              orderedRaces.push(initialRacesMap.get(key)!);
              initialRacesMap.delete(key); 
            }
          });
          const remainingRaces = Array.from(initialRacesMap.values()).sort(defaultRaceSort);
          orderedRaces = [...orderedRaces, ...remainingRaces];
      } else {
          orderedRaces = [...initialUniqueRaces].sort(defaultRaceSort);
      }
      const numberedUniqueRaces = orderedRaces.map((race, index) => ({ ...race, acaraNumber: index + 1 }));
      const raceKeyToAcaraNumberMap = new Map(numberedUniqueRaces.map(r => [generateRaceKey(r), r.acaraNumber!]));
      
      const processedRaceResults = processDataForBook(eventData, filteredResults, swimmersData, raceKeyToAcaraNumberMap);

      setPrintData({
        event: eventData,
        processedRaceResults: processedRaceResults
      });

    } catch (err: any) {
      console.error("Failed to fetch data for print:", err);
      setError(err.message || "Could not load data for printing.");
    } finally {
      setLoading(false);
    }
  }, [eventId, processDataForBook]);

  useEffect(() => {
    if (!initialPrintData && eventId) {
      fetchDataForPrint();
    }
  }, [initialPrintData, eventId, fetchDataForPrint]);

  useEffect(() => {
    if (printData && !printCalled.current) {
      printCalled.current = true;
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [printData]);

  if (loading) return <LoadingSpinner text="Preparing results book for printing..." />;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!printData) return <div className="text-center py-10">No data available to print.</div>;

  const { event, processedRaceResults } = printData;
  const isSchoolLevelEvent = event.categorySystem === 'SCHOOL_LEVEL';

  return (
    <div className="printable-container p-4 sm:p-8 bg-white text-black">
      <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 10pt; }
            .printable-container { width: 100%; margin: 0; padding: 10mm !important; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 10px; }
            th, td { border: 1px solid #ccc !important; padding: 3px 5px !important; text-align: left !important; font-size: 8pt !important; word-break: break-word; }
            thead { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; color-adjust: exact; display: table-header-group; }
            h1, h2, h3, p { color: black !important; }
            .event-header, .race-result-header { page-break-after: avoid !important; }
            .race-result-section { page-break-inside: auto; }
            .print-footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 8pt; display: block !important; }
            a { text-decoration: none; color: inherit; }
          }
          .screen-header { margin-bottom: 20px; text-align: center; }
          .screen-button { margin: 10px auto; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; display: inline-block; }
      `}</style>
      <div className="screen-header no-print">
        <h1 className="text-xl font-bold">Print Preview: Results Book</h1>
        <p>The print dialog should open automatically. If not, use your browser's print function (Ctrl/Cmd+P).</p>
        <div>
          <button onClick={() => window.print()} className="screen-button">Print Now</button>
          <button onClick={() => navigate(`/events/${eventId}/results-book`)} className="screen-button" style={{ backgroundColor: '#6c757d', marginLeft: '10px' }}>Back to Results Book</button>
        </div>
      </div>
      <div className="event-header text-center mb-4">
        <h1 className="text-xl font-bold uppercase">BUKU HASIL: {event.name.toUpperCase()}</h1>
        <p className="text-sm">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event.location}</p>
        <p className="text-xs">Sistem Kategori: {event.categorySystem || 'KU'}</p>
      </div>
      {processedRaceResults.length === 0 && <p className="text-center">No official results found for this event.</p>}
      {processedRaceResults.map((raceResult, index) => (
        <div key={`${index}-${raceResult.definition.style}`} className="race-result-section mb-6" style={{ pageBreakAfter: 'auto' }}>
          <h2 className="race-result-header text-lg font-semibold mt-4 mb-2">
            {raceResult.definition.acaraNumber && `ACARA ${raceResult.definition.acaraNumber} - `}
            {raceResult.definition.distance}m {raceResult.definition.style.toUpperCase()} - {raceResult.definition.ageGroup.toUpperCase()} - {genderDisplayPrint(raceResult.definition.gender)}
          </h2>
          {raceResult.results && raceResult.results.length > 0 ? (
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th>Rank</th><th>Name</th>{isSchoolLevelEvent && <th>School Name</th>}<th>Club</th><th>Seed Time</th><th>Final Time</th><th>Remarks</th><th>Date Recorded</th>
                </tr>
              </thead>
              <tbody>
                {raceResult.results.map((result: ResultEntry) => (
                  <tr key={result.id}>
                    <td>{result.rank !== undefined ? result.rank : (result.remarks || '-')}</td>
                    <td>{result.swimmerName}</td>
                    {isSchoolLevelEvent && <td>{result.swimmerSchoolName || '-'}</td>}
                    <td>{result.swimmerClubName}</td>
                    <td>{result.seedTimeStr || '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{result.time && result.time !== "99:99.99" ? result.time : (result.remarks ? '' : '-')}</td>
                    <td>{result.remarks || '-'}</td>
                    <td>{new Date(result.dateRecorded).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-600">No official results recorded for this race.</p>
          )}
        </div>
      ))}
      <div className="print-footer no-print">
        <p>Generated by Local Swim Manager - {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default PrintableResultsBook;
