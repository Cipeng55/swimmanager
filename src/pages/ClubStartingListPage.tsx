
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwimEvent, Swimmer, SelectOption, RaceDefinition, SeededSwimmerInfo, ClubStartingListInfo, ClubRaceInfo, ClubStartingListPrintData, SwimResult, User } from '../types';
import { getEvents, getSwimmers, getResults, getEventProgramOrder, getAllUsers } from '../services/api';
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
    const [allClubs, setAllClubs] = useState<User[]>([]); // User with role 'user'
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [selectedClubUserId, setSelectedClubUserId] = useState<string>('');
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
                
                let usersData: User[] = [];
                if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') {
                    usersData = await getAllUsers();
                }

                setEvents(eventsData);
                setSwimmers(swimmersData);
                setResults(resultsData);
                
                const clubs = usersData.filter(u => u.role === 'user');
                setAllClubs(clubs);

                if (eventsData.length > 0) {
                    setSelectedEventId(eventsData[0].id.toString());
                }
                
                if (currentUser?.role === 'user') {
                    setSelectedClubUserId(currentUser.id);
                } else {
                    setSelectedClubUserId('ALL_CLUBS');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load initial data.');
            } finally {
                setLoading(false);
            }
        };
        if (currentUser) {
            loadInitialData();
        }
    }, [currentUser]);

    const eventOptions = useMemo(() => events.map(e => ({ value: e.id, label: `${e.name} (${new Date(e.date).toLocaleDateString()})` })), [events]);
    
    const clubOptions = useMemo(() => {
        if (!currentUser) return [];

        if (currentUser.role === 'user') {
            return [{ value: currentUser.id, label: currentUser.clubName }];
        }
        
        const options: SelectOption[] = allClubs.map(c => ({ value: c.id, label: c.clubName! }));
        options.unshift({ value: 'ALL_CLUBS', label: 'All Clubs' });
        
        return options;
    }, [allClubs, currentUser]);

    useEffect(() => {
        if (!selectedEventId || !selectedClubUserId) {
            setStartingList([]);
            return;
        }

        const generateStartingList = async () => {
            setLoading(true);
            setError(null);
            try {
                const eventDetails = events.find(e => e.id === selectedEventId);
                if (!eventDetails) throw new Error("Selected event not found.");

                const selectedClub = allClubs.find(c => c.id === selectedClubUserId);
                const selectedClubName = selectedClubUserId === 'ALL_CLUBS' ? 'ALL_CLUBS' : (selectedClub ? selectedClub.clubName : currentUser?.clubName);


                const eventResults = results.filter(r => r.eventId === selectedEventId);
                
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

                const finalStartingList: ClubRaceInfo[] = [];
                numberedUniqueRaces.forEach((raceDef) => {
                    const raceSwimmersWithSeedTime: SeededSwimmerInfo[] = [];
                    eventResults.forEach(r => {
                        const swimmer = swimmers.find(s => s.id === r.swimmerId);
                        if (swimmer && swimmer.dob && r.style === raceDef.style && r.distance === raceDef.distance && swimmer.gender === raceDef.gender && r.seedTime) {
                           const currentSwimmerAgeGroup = getAgeGroup(swimmer, eventDetails);
                           if (currentSwimmerAgeGroup === raceDef.ageGroup && timeToMilliseconds(r.seedTime) >= 0) {
                                raceSwimmersWithSeedTime.push({
                                    resultId: r.id, swimmerId: r.id, name: swimmer.name, clubName: swimmer.clubName, gender: swimmer.gender,
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
                            if (lane.swimmer && (selectedClubUserId === 'ALL_CLUBS' || lane.swimmer.clubName === selectedClubName)) {
                                clubSwimmersInThisRace.push({
                                    swimmerName: lane.swimmer.name,
                                    swimmerClubName: lane.swimmer.clubName,
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
    }, [selectedEventId, selectedClubUserId, events, swimmers, results, allClubs, currentUser]);

    const handlePrint = () => {
        if (!selectedEventId || !selectedClubUserId || !events.length) return;
        const event = events.find(e => e.id === selectedEventId);
        if (!event) return;

        let clubNameToDisplay = 'All Clubs';
        if (selectedClubUserId === 'ALL_CLUBS') {
           clubNameToDisplay = 'All Clubs (Admin View)';
        } else {
           const selectedClub = allClubs.find(c => c.id === selectedClubUserId);
           clubNameToDisplay = selectedClub?.clubName || currentUser?.clubName || 'My Club';
        }

        const printData: ClubStartingListPrintData = {
            event: event,
            clubNameToDisplay: clubNameToDisplay,
            startingList: startingList,
            lanesPerEvent: event.lanesPerEvent || 8,
            isAdminAllClubsView: selectedClubUserId === 'ALL_CLUBS'
        };
        const clubParam = selectedClubUserId === 'ALL_CLUBS' ? 'ALL_CLUBS' : clubNameToDisplay;
        navigate(`/events/${selectedEventId}/club-starting-list/print?club=${encodeURIComponent(clubParam)}`, { state: { printData } });
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
                    <FormField label="Select Club" id="club-select" name="club-select" type="select" options={clubOptions} value={selectedClubUserId} onChange={e => setSelectedClubUserId(e.target.value)} containerClassName="mb-0" disabled={currentUser?.role === 'user'} />
                    <button onClick={handlePrint} disabled={!selectedEventId || !selectedClubUserId || startingList.length === 0} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        <PrinterIcon className="h-5 w-5 mr-2" />
                        Print List
                    </button>
                </div>
            </section>

            {loading && <LoadingSpinner text="Generating starting list..." />}
            {error && <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>}
            
            {!loading && !error && selectedEventId && selectedClubUserId && (
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
                                                {selectedClubUserId === 'ALL_CLUBS' && <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Club</th>}
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Heat</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Lane</th>
                                                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Seed Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {clubRace.swimmers.map((swimmerEntry, sIdx) => (
                                                <tr key={`${swimmerEntry.swimmerName}-${sIdx}`} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                                                    <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.swimmerName}</td>
                                                    {selectedClubUserId === 'ALL_CLUBS' && <td className="px-4 py-2 whitespace-nowrap">{swimmerEntry.swimmerClubName}</td>}
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
                        <p className="text-xl">No entries found for the selected club in this event.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default ClubStartingListPage;
