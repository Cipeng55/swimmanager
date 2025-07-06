import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwimEvent, Swimmer, SelectOption, RaceDefinition, SeededSwimmerInfo, Heat, ClubStartingListInfo, ClubRaceInfo, ClubStartingListPrintData, SwimResult } from '../types';
import { getEvents, getSwimmers, getResults, getEventProgramOrder } from '../services/api';
import { generateHeats } from '../utils/seedingUtils';
import { getAgeGroup, getSortableAgeGroup } from '../utils/ageUtils';
import { timeToMilliseconds } from '../utils/timeUtils';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { PrinterIcon } from '../components/icons/PrinterIcon';

const generateRaceKey = (race: RaceDefinition): string => {
  return `${race.style}-${race.distance}-${race.gender}-${race.ageGroup}`;
};

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
    const [events, setEvents] = useState<SwimEvent[]>([]);
    const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
    const [results, setResults] = useState<SwimResult[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [selectedClub, setSelectedClub] = useState<string>('');
    const [startingList, setStartingList] = useState<ClubRaceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [eventsData, swimmersData, resultsData] = await Promise.all([getEvents(), getSwimmers(), getResults()]);
                setEvents(eventsData);
                setSwimmers(swimmersData);
                setResults(resultsData);
                if (eventsData.length > 0) {
                    setSelectedEventId(eventsData[0].id.toString());
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load initial data.');
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const eventOptions = useMemo(() => events.map(e => ({ value: e.id, label: `${e.name} (${new Date(e.date).toLocaleDateString()})` })), [events]);
    const clubOptions = useMemo(() => {
        const allClubs = [...new Set(swimmers.map(s => s.club))].sort();
        const options: SelectOption[] = allClubs.map(c => ({ value: c, label: c }));
        if (currentUser?.role === 'admin') {
            options.unshift({ value: 'ALL_CLUBS', label: 'All Clubs (Admin)' });
        }
        return options;
    }, [swimmers, currentUser]);

    useEffect(() => {
        if (!selectedEventId || !selectedClub) {
            setStartingList([]);
            return;
        }

        const generateStartingList = async () => {
            setLoading(true);
            setError(null);
            try {
                const eventDetails = events.find(e => e.id === selectedEventId);
                if (!eventDetails) throw new Error("Selected event not found.");

                const eventResults = results.filter(r => r.eventId === selectedEventId);
                
                // 1. Determine all unique races in the event
                const raceMap = new Map<string, RaceDefinition>();
                eventResults.forEach(result => {
                    const swimmer = swimmers.find(s => s.id === result.swimmerId);
                    if (!swimmer || !swimmer.gender || !swimmer.dob || !result.seedTime) return;
                    const ageGroup = getAgeGroup(swimmer, eventDetails);
                    if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;
                    const raceKey = generateRaceKey({ style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
                    if (!raceMap.has(raceKey)) {
                        raceMap.set(raceKey, { style: result.style, distance: result.distance, gender: swimmer.gender, ageGroup: ageGroup });
                    }
                });
                const initialUniqueRaces = Array.from(raceMap.values());
                
                // 2. Order the races
                let orderedUniqueRaces: RaceDefinition[] = [];
                const customOrderedKeys = await getEventProgramOrder(selectedEventId);
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
                
                const numberedUniqueRaces = orderedUniqueRaces.map((race, index) => ({ ...race, acaraNumber: index + 1 }));

                // 3. For each race, generate heats and find swimmers from the selected club
                const finalStartingList: ClubRaceInfo[] = [];
                numberedUniqueRaces.forEach((raceDef) => {
                    const raceSwimmersWithSeedTime: SeededSwimmerInfo[] = [];
                    eventResults.forEach(r => {
                        const swimmer = swimmers.find(s => s.id === r.swimmerId);
                        if (swimmer && swimmer.dob && r.style === raceDef.style && r.distance === raceDef.distance && swimmer.gender === raceDef.gender && r.seedTime) {
                           const currentSwimmerAgeGroup = getAgeGroup(swimmer, eventDetails);
                           if (currentSwimmerAgeGroup === raceDef.ageGroup && timeToMilliseconds(r.seedTime) >= 0) {
                                raceSwimmersWithSeedTime.push({
                                    resultId: r.id, swimmerId: r.swimmerId, name: swimmer.name, club: swimmer.club, gender: swimmer.gender,
                                    ageGroup: currentSwimmerAgeGroup, seedTimeMs: timeToMilliseconds(r.seedTime), seedTimeStr: r.seedTime,
                                    swimmerDob: swimmer.dob, swimmerGradeLevel: swimmer.gradeLevel,
                                });
                           }
                        }
                    });

                    const heats = generateHeats(raceSwimmersWithSeedTime, eventDetails.lanesPerEvent || 8);
                    const clubSwimmersInThisRace: ClubStartingListInfo[] = [];
                    const raceLabelWithAcara = `Acara ${raceDef.acaraNumber} - ${raceDef.distance}m ${raceDef.style.toUpperCase()} - ${raceDef.ageGroup.toUpperCase()} ${raceDef.gender === 'Male' ? 'PUTRA' : 'PUTRI'}`;

                    heats.forEach(heat => {
                        heat.lanes.forEach(lane => {
                            if (lane.swimmer && (selectedClub === 'ALL_CLUBS' || lane.swimmer.club === selectedClub)) {
                                clubSwimmersInThisRace.push({
                                    swimmerName: lane.swimmer.name,
                                    swimmerClub: lane.swimmer.club,
                                    raceLabel: raceLabelWithAcara,
                                    heatNumber: heat.heatNumber,
                                    laneNumber: lane.lane,
                                    seedTime: lane.swimmer.seedTimeStr,
                                });
                            }
                        });
                    });

                    if (clubSwimmersInThisRace.length > 0) {
                        finalStartingList.push({
                            raceLabel: raceLabelWithAcara,
                            swimmers: clubSwimmersInThisRace.sort((a,b) => a.heatNumber - b.heatNumber || a.laneNumber - b.laneNumber),
                        });
                    }
                });
                
                // Sort the final list by acara number
                finalStartingList.sort((a,b) => {
                    const acaraNumA = parseInt(a.raceLabel.match(/^Acara (\d+)/)?.[1] || '0');
                    const acaraNumB = parseInt(b.raceLabel.match(/^Acara (\d+)/)?.[1] || '0');
                    if(acaraNumA !== acaraNumB) return acaraNumA - acaraNumB;
                    return a.raceLabel.localeCompare(b.raceLabel);
                });

                setStartingList(finalStartingList);
            } catch (err: any) {
                setError(err.message || "Failed to generate starting list.");
            } finally {
                setLoading(false);
            }
        };

        generateStartingList();
    }, [selectedEventId, selectedClub, events, swimmers, results]);

    const handlePrint = () => {
        if (!selectedEventId || !selectedClub || !events.length) return;
        const event = events.find(e => e.id === selectedEventId);
        if (!event) return;

        const printData: ClubStartingListPrintData = {
            event: event,
            clubNameToDisplay: selectedClub === 'ALL_CLUBS' ? 'All Clubs (Admin View)' : selectedClub,
            startingList: startingList,
            lanesPerEvent: event.lanesPerEvent || 8,
            isAdminAllClubsView: selectedClub === 'ALL_CLUBS'
        };
        navigate(`/events/${selectedEventId}/club-starting-list/print?club=${encodeURIComponent(selectedClub)}`, { state: { printData } });
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Club Starting List</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300">View start lists for a specific club and event.</p>
            </header>

            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <FormField label="Select Event" id="event-select" name="event-select" type="select" options={eventOptions} value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} containerClassName="mb-0" />
                    <FormField label="Select Club" id="club-select" name="club-select" type="select" options={clubOptions} value={selectedClub} onChange={e => setSelectedClub(e.target.value)} containerClassName="mb-0" />
                    <button onClick={handlePrint} disabled={!selectedEventId || !selectedClub || startingList.length === 0} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <PrinterIcon className="h-5 w-5 mr-2" />
                        Print List
                    </button>
                </div>
            </section>

            {loading && <LoadingSpinner text="Generating starting list..." />}
            {error && <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>}
            
            {!loading && !error && selectedEventId && selectedClub && (
                startingList.length > 0 ? (
                    <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
                        {startingList.map((clubRace, index) => (
                            <div key={`${clubRace.raceLabel}-${index}`} className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 border-b pb-1 mb-2">{clubRace.raceLabel}</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Swimmer</th>
                                                {selectedClub === 'ALL_CLUBS' && <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Club</th>}
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Heat</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Lane</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Seed Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {clubRace.swimmers.map((swimmerEntry, sIdx) => (
                                                <tr key={`${swimmerEntry.swimmerName}-${sIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                                                    <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.swimmerName}</td>
                                                    {selectedClub === 'ALL_CLUBS' && <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.swimmerClub}</td>}
                                                    <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.heatNumber}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.laneNumber}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.seedTime}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </section>
                ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                        <p className="text-xl">No entries found for {selectedClub === 'ALL_CLUBS' ? 'any club' : selectedClub} in this event.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default ClubStartingListPage;
