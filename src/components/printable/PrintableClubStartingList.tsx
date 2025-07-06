// components/printable/PrintableClubStartingList.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClubStartingListPrintData, SwimEvent, RaceDefinition, SeededSwimmerInfo, Swimmer, SwimResult, ClubRaceInfo, ClubStartingListInfo } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { getEvents, getSwimmers, getResults, getEventProgramOrder } from '../../services/api';
import { generateHeats } from '../../utils/seedingUtils';
import { getAgeGroup, getSortableAgeGroup } from '../../utils/ageUtils';
import { timeToMilliseconds } from '../../utils/timeUtils';

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

const PrintableClubStartingList: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const clubName = searchParams.get('club');
  
  const initialPrintData = location.state?.printData as ClubStartingListPrintData | undefined;
  const printCalled = useRef(false);

  const [printData, setPrintData] = useState<ClubStartingListPrintData | null>(initialPrintData || null);
  const [loading, setLoading] = useState<boolean>(!initialPrintData);
  const [error, setError] = useState<string | null>(null);

  const fetchDataForPrint = useCallback(async () => {
    if (!eventId || !clubName) {
      setError("Event ID or Club Name is missing from URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
        const [allEvents, allSwimmers, allResults] = await Promise.all([
            getEvents(),
            getSwimmers(),
            getResults()
        ]);
        
        const eventDetails = allEvents.find(e => e.id === eventId);
        if (!eventDetails) throw new Error("Event not found.");

        const eventResults = allResults.filter(r => r.eventId === eventId);
        
        // --- Replicate logic from ClubStartingListPage ---
        const raceMap = new Map<string, RaceDefinition>();
        eventResults.forEach(result => {
            const swimmer = allSwimmers.find(s => s.id === result.swimmerId);
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
        const customOrderedKeys = await getEventProgramOrder(eventId);
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
                const swimmer = allSwimmers.find(s => s.id === r.swimmerId);
                if (swimmer && swimmer.dob && r.style === raceDef.style && r.distance === raceDef.distance && swimmer.gender === raceDef.gender && r.seedTime) {
                    const currentSwimmerAgeGroup = getAgeGroup(swimmer, eventDetails);
                    if (currentSwimmerAgeGroup === raceDef.ageGroup && timeToMilliseconds(r.seedTime) >= 0) {
                        raceSwimmersWithSeedTime.push({
                            resultId: r.id, swimmerId: r.swimmerId, name: swimmer.name, clubName: swimmer.clubName, gender: swimmer.gender,
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
                    if (lane.swimmer && (clubName === 'ALL_CLUBS' || lane.swimmer.clubName === clubName)) {
                        clubSwimmersInThisRace.push({
                            swimmerName: lane.swimmer.name, swimmerClubName: lane.swimmer.clubName, raceLabel: raceLabelWithAcara,
                            heatNumber: heat.heatNumber, laneNumber: lane.lane, seedTime: lane.swimmer.seedTimeStr,
                        });
                    }
                });
            });

            if (clubSwimmersInThisRace.length > 0) {
                finalStartingList.push({
                    raceLabel: raceLabelWithAcara,
                    swimmers: clubSwimmersInThisRace.sort((a, b) => a.heatNumber - b.heatNumber || a.laneNumber - b.laneNumber),
                });
            }
        });

        finalStartingList.sort((a, b) => {
            const acaraNumA = parseInt(a.raceLabel.match(/^Acara (\d+)/)?.[1] || '0');
            const acaraNumB = parseInt(b.raceLabel.match(/^Acara (\d+)/)?.[1] || '0');
            if (acaraNumA !== acaraNumB) return acaraNumA - acaraNumB;
            return a.raceLabel.localeCompare(b.raceLabel);
        });

        setPrintData({
            event: eventDetails,
            clubNameToDisplay: clubName === 'ALL_CLUBS' ? 'All Clubs (Admin View)' : clubName,
            startingList: finalStartingList,
            lanesPerEvent: eventDetails.lanesPerEvent || 8,
            isAdminAllClubsView: clubName === 'ALL_CLUBS',
        });

    } catch (err: any) {
      console.error("Failed to fetch data for print:", err);
      setError(err.message || "Could not load data for printing.");
    } finally {
      setLoading(false);
    }
  }, [eventId, clubName]);

  useEffect(() => {
    if (!initialPrintData && eventId && clubName) {
      fetchDataForPrint();
    }
  }, [initialPrintData, eventId, clubName, fetchDataForPrint]);

  useEffect(() => {
    if (printData && !printCalled.current) {
      printCalled.current = true;
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [printData]);

  if (loading) return <LoadingSpinner text="Preparing starting list for printing..." />;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!printData) return <div className="text-center py-10">No data available to print.</div>;

  const { event, clubNameToDisplay, startingList, isAdminAllClubsView } = printData;

  return (
    <div className="printable-container p-4 sm:p-8 bg-white text-black">
      <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 10pt; }
            .printable-container { width: 100%; margin: 0 auto; padding: 10mm !important; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 10px; }
            th, td { border: 1px solid #ccc !important; padding: 3px 5px !important; text-align: left !important; font-size: 8pt !important; word-break: break-word; }
            thead { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; color-adjust: exact; display: table-header-group; }
            h1, h2, h3, p { color: black !important; }
            .event-header, .list-header, .race-header { page-break-after: avoid !important; }
            .race-section { page-break-inside: auto; }
            a { text-decoration: none; color: inherit; }
          }
          .screen-header { margin-bottom: 20px; text-align: center; }
          .screen-button { margin: 10px auto; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; display: inline-block; }
        `}</style>
      <div className="screen-header no-print">
        <h1 className="text-xl font-bold">Print Preview: Club Starting List</h1>
        <p>The print dialog should open automatically. If not, please use your browser's print function (Ctrl/Cmd+P).</p>
        <div>
          <button onClick={() => window.print()} className="screen-button">Print Now</button>
          <button onClick={() => navigate('/club-starting-list')} className="screen-button" style={{ backgroundColor: '#6c757d', marginLeft: '10px' }}>Back to Starting List</button>
        </div>
      </div>
      <div className="event-header text-center mb-4">
        <h1 className="text-lg font-bold uppercase">{event.name.toUpperCase()} - STARTING LIST</h1>
        <p className="text-sm">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div className="list-header text-center mb-3">
        <h2 className="text-md font-semibold">Club: {clubNameToDisplay}</h2>
      </div>
      {startingList.map((clubRace, index) => (
        <div key={`${clubRace.raceLabel}-${index}`} className="race-section mb-4">
          <h3 className="race-header text-sm font-semibold mt-2 mb-1 text-left">{clubRace.raceLabel}</h3>
          {clubRace.swimmers && clubRace.swimmers.length > 0 ? (
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th>Swimmer Name</th>
                  {isAdminAllClubsView && <th>Club</th>}
                  <th>Heat</th>
                  <th>Lane</th>
                  <th>Seed Time</th>
                </tr>
              </thead>
              <tbody>
                {clubRace.swimmers.map((swimmerEntry, sIdx) => (
                  <tr key={`${swimmerEntry.swimmerName}-${sIdx}`}>
                    <td>{swimmerEntry.swimmerName}</td>
                    {isAdminAllClubsView && <td>{swimmerEntry.swimmerClubName}</td>}
                    <td>{swimmerEntry.heatNumber}</td>
                    <td>{swimmerEntry.laneNumber}</td>
                    <td>{swimmerEntry.seedTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-gray-500">No swimmers from {clubNameToDisplay === 'All Clubs (Admin View)' ? 'any club' : clubNameToDisplay} in this race.</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default PrintableClubStartingList;
