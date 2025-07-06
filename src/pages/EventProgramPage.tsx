import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { SwimEvent, SwimResult, Swimmer, RaceDefinition, SeededSwimmerInfo, Heat, LaneSwimmerDetails, EventProgramPrintData } from '../types';
import { 
  getEventById, 
  getResults, 
  getSwimmers, 
  updateResult,
  getEventProgramOrder, 
  saveEventProgramOrder  
} from '../services/api';
import { timeToMilliseconds } from '../utils/timeUtils';
import { generateHeats } from '../utils/seedingUtils';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils'; 
import LoadingSpinner from '../components/common/LoadingSpinner';
import HeatSheetDisplay from '../components/HeatSheetDisplay';
import EditLaneResultModal from '../components/EditLaneResultModal';
import { PrinterIcon } from '../components/icons/PrinterIcon'; 
import { useAuth } from '../contexts/AuthContext';
import { ArrowUpIcon } from '../components/icons/ArrowUpIcon';     
import { ArrowDownIcon } from '../components/icons/ArrowDownIcon'; 

// Helper to generate a consistent key for a race
const generateRaceKey = (race: RaceDefinition): string => {
  return `${race.style}-${race.distance}-${race.gender}-${race.ageGroup}`;
};

const EventProgramPage: React.FC = () => {
  const { eventId: eventIdParam } = useParams<{ eventId: string }>(); 
  const navigate = useNavigate(); 
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [results, setResults] = useState<SwimResult[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditLaneModalOpen, setIsEditLaneModalOpen] = useState<boolean>(false);
  const [editingLaneSwimmerData, setEditingLaneSwimmerData] = useState<LaneSwimmerDetails | null>(null);
  const { currentUser } = useAuth(); 

  const [displayedRaces, setDisplayedRaces] = useState<RaceDefinition[]>([]);
  const [customOrderLoaded, setCustomOrderLoaded] = useState(false);


  const fetchPageData = useCallback(async () => {
    if (!eventIdParam) {
      setError("Event ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setCustomOrderLoaded(false); 
    try {
      const [eventData, resultsData, swimmersData] = await Promise.all([
        getEventById(eventIdParam),
        getResults(), 
        getSwimmers(),
      ]);

      if (!eventData) {
        setError(`Event with ID ${eventIdParam} not found.`);
        setEvent(null);
        setResults([]);
        setSwimmers([]);
      } else {
        setEvent(eventData);
        const filteredResultsForEvent = resultsData.filter(r => r.eventId === eventIdParam);
        setResults(filteredResultsForEvent);
        setSwimmers(swimmersData);
      }
    } catch (err) {
      console.error("Failed to load event program data:", err);
      setError("Could not load event program data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [eventIdParam]);

  useEffect(() => { 
    fetchPageData(); 
  }, [fetchPageData]);

  const initialUniqueRaces = useMemo<RaceDefinition[]>(() => { 
    if (!results.length || !swimmers.length || !event) return [];
    
    const raceMap = new Map<string, RaceDefinition>();
    results.forEach(result => {
      const swimmer = swimmers.find(s => s.id === result.swimmerId);
      if (!swimmer || !swimmer.gender || !swimmer.dob || !result.seedTime ) return; 
      
      const ageGroup = getAgeGroup(swimmer, event); // Pass full swimmer object
      if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return; // Adjusted unknown checks

      const raceKey = generateRaceKey({ style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
      
      if (!raceMap.has(raceKey)) {
        raceMap.set(raceKey, { style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
      }
    });
    return Array.from(raceMap.values());
  }, [results, swimmers, event]);

  const defaultRaceSort = useCallback((a: RaceDefinition, b: RaceDefinition): number => {
    const styleOrder = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle', 'IM', 'Kick Breaststroke', 'Kick Butterfly', 'Kick Freestyle', 'Freestyle Relay', 'Medley Relay'];
    
    // Sort by Age Group first
    const ageGroupComparison = getSortableAgeGroup(a.ageGroup) - getSortableAgeGroup(b.ageGroup);
    if (ageGroupComparison !== 0) return ageGroupComparison;

    // Then by Style
    const styleAIndex = styleOrder.indexOf(a.style);
    const styleBIndex = styleOrder.indexOf(b.style);
     if (styleAIndex !== styleBIndex) {
      return (styleAIndex === -1 ? 99 : styleAIndex) - (styleBIndex === -1 ? 99 : styleBIndex);
    }
    
    // Then by Distance
    if (a.distance !== b.distance) return a.distance - b.distance;
    
    // Then by Gender
    if (a.gender === 'Male' && b.gender === 'Female') return -1;
    if (a.gender === 'Female' && b.gender === 'Male') return 1;
    
    return 0;
  }, []); 


  useEffect(() => {
    if (loading || !event || initialUniqueRaces.length === 0 || customOrderLoaded) {
        if (initialUniqueRaces.length === 0 && customOrderLoaded && !loading) { 
             setDisplayedRaces([]); 
        }
        return;
    }

    const applyOrder = async () => {
      const customOrderedKeys = await getEventProgramOrder(event.id);
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
      setDisplayedRaces(orderedRaces);
      setCustomOrderLoaded(true); 
    };
    
    applyOrder();

  }, [initialUniqueRaces, event, loading, customOrderLoaded, defaultRaceSort]);


  const getHeatsForRace = useCallback((race: RaceDefinition): Heat[] => {  
    if (!event || !results.length || !swimmers.length) return [];
    const raceSwimmersWithSeedTime: SeededSwimmerInfo[] = [];
    results.forEach(r => {
      const swimmer = swimmers.find(s => s.id === r.swimmerId);
      if (swimmer && swimmer.dob && r.style === race.style && r.distance === race.distance && swimmer.gender === race.gender && r.seedTime) {
        const currentSwimmerAgeGroup = getAgeGroup(swimmer, event); // Pass full swimmer
        if (currentSwimmerAgeGroup === race.ageGroup && timeToMilliseconds(r.seedTime!) >= 0 ) {
          raceSwimmersWithSeedTime.push({
            resultId: r.id, swimmerId: r.swimmerId, name: swimmer.name, club: swimmer.club, gender: swimmer.gender,
            ageGroup: currentSwimmerAgeGroup, 
            seedTimeMs: timeToMilliseconds(r.seedTime!), seedTimeStr: r.seedTime!,
            finalTimeStr: r.time || undefined, remarks: r.remarks || undefined,
            swimmerDob: swimmer.dob, 
            swimmerGradeLevel: swimmer.gradeLevel, // Pass gradeLevel
          });
        }
      }
    });
    const lanesForThisEvent = event?.lanesPerEvent || 8;
    return generateHeats(raceSwimmersWithSeedTime, lanesForThisEvent);
  }, [event, results, swimmers]);
  
  const numberedUniqueRaces = useMemo(() => { 
    return displayedRaces.map((race, index) => ({ ...race, acaraNumber: index + 1 }));
  }, [displayedRaces]);
  
  const racesWithHeats = useMemo(() => {
    if (!event || !numberedUniqueRaces.length) {
      return [];
    }
    return numberedUniqueRaces.map(race => ({
      race,
      heats: getHeatsForRace(race),
    })).filter(rwh => rwh.heats.length > 0);
  }, [event, numberedUniqueRaces, getHeatsForRace]);


  const genderDisplay = (gender: Swimmer['gender'] | 'Mixed'): string => { return gender === 'Male' ? 'PUTRA' : 'PUTRI'; };

  const handlePrintProgram = () => {
    if (!event || !numberedUniqueRaces.length) return;

    const printData: EventProgramPrintData = {
      event, 
      numberedUniqueRaces, 
      racesWithHeats: racesWithHeats
    };
    navigate(`/events/${event.id}/program/print`, { state: { printData } });
  };

  const handleOpenEditLaneModal = (swimmerInfo: SeededSwimmerInfo, laneNumber: number) => {
    if (currentUser?.role !== 'admin') return; 
    setEditingLaneSwimmerData({ ...swimmerInfo, lane: laneNumber });
    setIsEditLaneModalOpen(true);
  };

  const handleCloseEditLaneModal = () => { setIsEditLaneModalOpen(false); setEditingLaneSwimmerData(null); };

  const handleSaveLaneResult = async (resultId: string, finalTime?: string, remarks?: string) => { 
    if (!eventIdParam) return;
    try {
      await updateResult(resultId, { time: finalTime, remarks: remarks });
      fetchPageData(); 
      handleCloseEditLaneModal();
    } catch (err) { 
        console.error("Failed to save result:", err);
        alert("Failed to save result. Please try again."); 
    }
  };

  const handleMoveRace = async (raceKeyToMove: string, direction: 'up' | 'down') => {
    if (!event) return;
    const currentIndex = displayedRaces.findIndex(r => generateRaceKey(r) === raceKeyToMove);
    if (currentIndex === -1) return;

    const newRaces = [...displayedRaces];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= newRaces.length) return;

    [newRaces[currentIndex], newRaces[targetIndex]] = [newRaces[targetIndex], newRaces[currentIndex]];
    
    setDisplayedRaces(newRaces); 
    const newOrderedKeys = newRaces.map(r => generateRaceKey(r));
    try {
      await saveEventProgramOrder(event.id, newOrderedKeys);
    } catch (saveError) {
      console.error("Failed to save new program order:", saveError);
      setError("Failed to save new order. Please try again.");
      // Revert to old display order on save error for UI consistency
      setDisplayedRaces(displayedRaces); 
    }
  };

  if (loading && !event) return <LoadingSpinner text="Loading event program..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  if (!event && !loading) return <div className="text-center py-10">Event not found. Check if the Event ID in the URL is correct.</div>;
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className='text-center sm:text-left'>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 uppercase">KEJUARAAN RENANG {event?.name.toUpperCase()}</h1>
                <p className="text-md text-gray-600 dark:text-gray-300">{new Date(event!.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event?.location}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Menggunakan {event?.lanesPerEvent || 8} Lintasan. Sistem Kategori: {event?.categorySystem || 'KU'}
                </p>
            </div>
            <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Link to="/events" className="text-primary hover:underline whitespace-nowrap">&larr; Daftar Event</Link>
                {numberedUniqueRaces.length > 0 && (
                  <button onClick={handlePrintProgram} className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center" title="Cetak / Simpan PDF Program">
                      <PrinterIcon className="h-5 w-5 mr-2" /> Cetak / Simpan PDF Program
                  </button>
                )}
            </div>
        </div>
      </header>

      {racesWithHeats.length === 0 && !loading && (
         <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No races could be generated for this event's program.</p>
            <p>This could be because:</p>
            <ul className="list-disc list-inside inline-block text-left">
              <li>There are no results recorded for this event yet.</li>
              <li>Recorded results for this event do not have valid seed times.</li>
              <li>Swimmers associated with results are missing Date of Birth or Gender (or Grade Level if event uses Grade System).</li>
              <li>The chosen Category System ({event?.categorySystem || 'KU'}) resulted in no valid race groupings for the available data.</li>
            </ul>
          </div>
      )}

      {racesWithHeats.map(({ race, heats }, index) => {
        const raceKey = generateRaceKey(race);
        return (
          <section key={raceKey} className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-left">
                ACARA {race.acaraNumber} - {race.distance}M {race.style.toUpperCase()} - {race.ageGroup.toUpperCase()} {genderDisplay(race.gender)} - SCM
              </h2>
              {currentUser?.role === 'admin' && (
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleMoveRace(raceKey, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Acara Up"
                  >
                    <ArrowUpIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleMoveRace(raceKey, 'down')}
                    disabled={index === numberedUniqueRaces.length - 1}
                    className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Acara Down"
                  >
                    <ArrowDownIcon className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            <HeatSheetDisplay 
              race={race} 
              heats={heats} 
              onEditLane={currentUser?.role === 'admin' ? handleOpenEditLaneModal : () => {}}
              showEditButton={currentUser?.role === 'admin'}
              isGradeSystem={event?.categorySystem === 'GRADE'}
            />
          </section>
        );
      })}

      {currentUser?.role === 'admin' && editingLaneSwimmerData && (
        <EditLaneResultModal
          isOpen={isEditLaneModalOpen}
          onClose={handleCloseEditLaneModal}
          swimmerData={editingLaneSwimmerData}
          onSave={handleSaveLaneResult}
        />
      )}
    </div>
  );
};

export default EventProgramPage;