import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { SwimEvent, Swimmer, SwimResult, SelectOption, ClubRaceInfo, ClubStartingListInfo, RaceDefinition, SeededSwimmerInfo } from '../types';
import { getEvents, getSwimmers, getResults, getEventById, getEventProgramOrder } from '../services/api';
import { generateHeats } from '../utils/seedingUtils';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils';
import { timeToMilliseconds } from '../utils/timeUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { useAuth } from '../contexts/AuthContext';
import { PrinterIcon } from '../components/icons/PrinterIcon'; 
import { useNavigate } from 'react-router-dom'; 

// Helper to generate a consistent key for a race (moved to be reusable)
const generateRaceKey = (race: RaceDefinition): string => {
  return `${race.style}-${race.distance}-${race.gender}-${race.ageGroup}`;
};

// Default race sorting logic (moved to be reusable)
const defaultRaceSort = (a: RaceDefinition, b: RaceDefinition): number => {
    const styleOrder = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle', 'IM'];
    
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


const ClubStartingListPage: React.FC = () => {
  const [allEvents, setAllEvents] = useState<SwimEvent[]>([]);
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([]);
  const [allResults, setAllResults] = useState<SwimResult[]>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedEventDetails, setSelectedEventDetails] = useState<SwimEvent | null>(null);
  const [selectedClubName, setSelectedClubName] = useState<string>('');
  
  const [clubsForDropdown, setClubsForDropdown] = useState<SelectOption[]>([]);
  const [startingList, setStartingList] = useState<ClubRaceInfo[]>([]);
  
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const [loadingClubs, setLoadingClubs] = useState<boolean>(false);
  const [loadingStartingList, setLoadingStartingList] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const navigate = useNavigate(); 

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingEvents(true);
      setError(null);
      try {
        const [eventsData, swimmersData, resultsData] = await Promise.all([
          getEvents(),
          getSwimmers(),
          getResults()
        ]);
        setAllEvents(eventsData);
        setAllSwimmers(swimmersData);
        setAllResults(resultsData);
      } catch (err) {
        console.error("Failed to load initial data:", err);
        setError("Could not load initial data. Please try again.");
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setClubsForDropdown([]);
      setSelectedClubName('');
      setStartingList([]);
      setSelectedEventDetails(null);
      return;
    }

    setLoadingClubs(true);
    setStartingList([]); 
    setSelectedClubName(''); 

    const numericEventId = parseInt(selectedEventId);
    const currentEventDetails = allEvents.find(e => e.id === numericEventId);
    setSelectedEventDetails(currentEventDetails || null);

    const resultsForEvent = allResults.filter(r => r.eventId === numericEventId);
    const swimmerIdsInEvent = new Set(resultsForEvent.map(r => r.swimmerId));
    
    const uniqueClubs = new Set<string>();
    allSwimmers.forEach(swimmer => {
      if (swimmerIdsInEvent.has(swimmer.id) && swimmer.club) {
        uniqueClubs.add(swimmer.club);
      }
    });
    
    let clubOptionsFormatted = Array.from(uniqueClubs).sort().map(club => ({ value: club, label: club }));

    if (currentUser?.role === 'admin') {
      clubOptionsFormatted.unshift({ value: 'ALL_CLUBS', label: 'All Clubs (Admin View)' });
    }
    setClubsForDropdown(clubOptionsFormatted.length > 0 ? [{ value: '', label: 'Select a Club' }, ...clubOptionsFormatted] : []);
    setLoadingClubs(false);
  }, [selectedEventId, allEvents, allSwimmers, allResults, currentUser]);


  useEffect(() => {
    const generateList = async () => {
      if (!selectedEventId || !selectedClubName || !selectedEventDetails) {
        if (selectedClubName || selectedEventId) setStartingList([]);
        return;
      }

      setLoadingStartingList(true);
      setError(null);

      const numericEventId = parseInt(selectedEventId);
      const eventResults = allResults.filter(r => r.eventId === numericEventId);
      const eventSwimmers = allSwimmers;

      // 1. Determine unique races for the event
      const raceMap = new Map<string, RaceDefinition>();
      eventResults.forEach(result => {
        const swimmer = eventSwimmers.find(s => s.id === result.swimmerId);
        if (!swimmer || !swimmer.gender || !swimmer.dob || !result.seedTime) return;
        
        const ageGroup = getAgeGroup(swimmer, selectedEventDetails);
        if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;

        const raceKey = generateRaceKey({ style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
        if (!raceMap.has(raceKey)) {
          raceMap.set(raceKey, { style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
        }
      });
      const initialUniqueRaces = Array.from(raceMap.values());

      // 2. Sort these unique races (apply custom order if exists)
      let orderedUniqueRaces: RaceDefinition[] = [];
      const customOrderedKeys = await getEventProgramOrder(numericEventId);
      if (customOrderedKeys) {
        const initialRacesMap = new Map(initialUniqueRaces.map(r => [generateRaceKey(r), r]));
        customOrderedKeys.forEach(key => {
          if (initialRacesMap.has(key)) {
            orderedUniqueRaces.push(initialRacesMap.get(key)!);
            initialRacesMap.delete(key);
          }
        });
        const remainingRaces = Array.from(initialRacesMap.values()).sort(defaultRaceSort);
        orderedUniqueRaces = [...orderedUniqueRaces, ...remainingRaces];
      } else {
        orderedUniqueRaces = [...initialUniqueRaces].sort(defaultRaceSort);
      }
      
      // 3. Assign Acara Numbers
      const numberedUniqueRaces = orderedUniqueRaces.map((race, index) => ({
        ...race,
        acaraNumber: index + 1,
      }));


      const finalStartingList: ClubRaceInfo[] = [];

      numberedUniqueRaces.forEach((raceDef) => { // Use numberedUniqueRaces
        const raceSwimmersWithSeedTime: SeededSwimmerInfo[] = [];
        eventResults.forEach(r => {
          const swimmer = eventSwimmers.find(s => s.id === r.swimmerId);
          if (swimmer && swimmer.dob && r.style === raceDef.style && r.distance === raceDef.distance && swimmer.gender === raceDef.gender && r.seedTime) {
            const currentSwimmerAgeGroup = getAgeGroup(swimmer, selectedEventDetails);
            if (currentSwimmerAgeGroup === raceDef.ageGroup && timeToMilliseconds(r.seedTime) >= 0) {
              raceSwimmersWithSeedTime.push({
                resultId: r.id, swimmerId: r.swimmerId, name: swimmer.name, club: swimmer.club, gender: swimmer.gender,
                ageGroup: currentSwimmerAgeGroup, seedTimeMs: timeToMilliseconds(r.seedTime), seedTimeStr: r.seedTime,
                swimmerDob: swimmer.dob,
                swimmerGradeLevel: swimmer.gradeLevel,
              });
            }
          }
        });

        const lanesForThisEvent = selectedEventDetails.lanesPerEvent || 8;
        const heats = generateHeats(raceSwimmersWithSeedTime, lanesForThisEvent);

        const clubSwimmersInThisRace: ClubStartingListInfo[] = [];
        // Construct raceLabel with Acara Number
        const raceLabelWithAcara = `Acara ${raceDef.acaraNumber} - ${raceDef.distance}m ${raceDef.style.toUpperCase()} - ${raceDef.ageGroup.toUpperCase()} ${raceDef.gender === 'Male' ? 'PUTRA' : 'PUTRI'}`;

        heats.forEach(heat => {
          heat.lanes.forEach(lane => {
            if (
              lane.swimmer &&
              ((currentUser?.role === 'admin' && selectedClubName === 'ALL_CLUBS') ||
                lane.swimmer.club === selectedClubName)
            ) {
              clubSwimmersInThisRace.push({
                swimmerName: lane.swimmer.name,
                swimmerClub: lane.swimmer.club,
                raceLabel: raceLabelWithAcara, // Use the numbered label
                heatNumber: heat.heatNumber,
                laneNumber: lane.lane,
                seedTime: lane.swimmer.seedTimeStr,
              });
            }
          });
        });

        if (clubSwimmersInThisRace.length > 0) {
          finalStartingList.push({
            raceLabel: raceLabelWithAcara, // Store the numbered label
            swimmers: clubSwimmersInThisRace.sort((a, b) => a.heatNumber - b.heatNumber || a.laneNumber - b.laneNumber),
          });
        }
      });
      
      // Sort final list by Acara Number (implicitly handled by sorting numberedUniqueRaces earlier, but explicit sort on label is fine too)
      finalStartingList.sort((a, b) => {
        const acaraNumA = parseInt(a.raceLabel.match(/^Acara (\d+)/)?.[1] || '0');
        const acaraNumB = parseInt(b.raceLabel.match(/^Acara (\d+)/)?.[1] || '0');
        if (acaraNumA !== acaraNumB) return acaraNumA - acaraNumB;
        return a.raceLabel.localeCompare(b.raceLabel); // Fallback sort by full label
      });

      setStartingList(finalStartingList);
      setLoadingStartingList(false);
    };

    generateList();
  }, [selectedEventId, selectedClubName, selectedEventDetails, allResults, allSwimmers, currentUser]);


  const eventOptions: SelectOption[] = useMemo(() => 
    [{ value: '', label: 'Select an Event' }, ...allEvents.map(e => ({ value: e.id, label: `${e.name} (${new Date(e.date).toLocaleDateString('id-ID')})` }))]
  , [allEvents]);

  const handlePrintStartingList = () => {
    if (!selectedEventDetails || startingList.length === 0) return;

    const clubNameToDisplayForPrint = (currentUser?.role === 'admin' && selectedClubName === 'ALL_CLUBS') 
      ? 'All Clubs (Admin View)' 
      : selectedClubName || 'N/A';

    const printData = {
      event: selectedEventDetails,
      clubNameToDisplay: clubNameToDisplayForPrint,
      startingList: startingList, // startingList now contains numbered raceLabels
      lanesPerEvent: selectedEventDetails.lanesPerEvent || 8,
      isAdminAllClubsView: currentUser?.role === 'admin' && selectedClubName === 'ALL_CLUBS',
    };
    // The state is still passed for initial load efficiency
    navigate(`/events/${selectedEventDetails.id}/club-starting-list/print?club=${encodeURIComponent(selectedClubName)}`, { state: { printData } });
  };

  if (loadingEvents) return <LoadingSpinner text="Loading initial data..." />;
  if (error) return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Club Starting List</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          View starting list details for swimmers by club and event.
        </p>
      </header>

      <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                label="Select Event"
                id="filterEventId"
                name="filterEventId"
                type="select"
                options={eventOptions}
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={loadingEvents || allEvents.length === 0}
                containerClassName="mb-0"
            />
            <FormField
                label="Select Club"
                id="filterClubName"
                name="filterClubName"
                type="select"
                options={clubsForDropdown}
                value={selectedClubName}
                onChange={(e) => setSelectedClubName(e.target.value)}
                disabled={loadingClubs || !selectedEventId || clubsForDropdown.length <=1 }
                containerClassName="mb-0"
                placeholder={!selectedEventId ? "Select an event first" : clubsForDropdown.length <= 1 ? (currentUser?.role === 'admin' && clubsForDropdown.some(c=>c.value === 'ALL_CLUBS') ? "No clubs found or select event" : "No clubs in this event") : "Select a Club"}
            />
            </div>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-4 self-start sm:self-end">
            {startingList.length > 0 && (
                <button
                    onClick={handlePrintStartingList}
                    className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center"
                    title="Cetak / Simpan PDF Starting List"
                >
                    <PrinterIcon className="h-5 w-5 mr-2" /> Print/Save PDF
                </button>
            )}
        </div>
      </section>

      {loadingStartingList && <LoadingSpinner text="Generating starting list..." />}
      
      {!loadingStartingList && selectedEventId && selectedClubName && startingList.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No starting list entries found for {selectedClubName === 'ALL_CLUBS' ? 'any club' : selectedClubName} in the selected event.</p>
            <p>This could be because no swimmers {selectedClubName !== 'ALL_CLUBS' && selectedClubName !== '' && `from ${selectedClubName}`} are registered with seed times for races in this event.</p>
        </div>
      )}

      {!loadingStartingList && startingList.length > 0 && (
        <section className="space-y-6">
          {startingList.map((clubRace) => (
            <div key={clubRace.raceLabel} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3">{clubRace.raceLabel}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Swimmer Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Heat</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lane</th>
                      {currentUser?.role === 'admin' && selectedClubName === 'ALL_CLUBS' && (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club</th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Seed Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {clubRace.swimmers.map((swimmerEntry, idx) => (
                      <tr key={`${swimmerEntry.swimmerName}-${idx}-${swimmerEntry.heatNumber}-${swimmerEntry.laneNumber}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{swimmerEntry.swimmerName}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmerEntry.heatNumber}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmerEntry.laneNumber}</td>
                        {currentUser?.role === 'admin' && selectedClubName === 'ALL_CLUBS' && (
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmerEntry.swimmerClub}</td>
                        )}
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmerEntry.seedTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default ClubStartingListPage;