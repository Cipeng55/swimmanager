import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { EventProgramPrintData, SwimEvent, RaceDefinition, Heat, SeededSwimmerInfo, Swimmer, SwimResult } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { getEventById, getResults, getSwimmers, getEventProgramOrder } from '../../services/api';
import { timeToMilliseconds } from '../../utils/timeUtils';
import { generateHeats } from '../../utils/seedingUtils';
import { getAgeGroup, getSortableAgeGroup } from '../../utils/ageUtils';

const generateRaceKey = (race: RaceDefinition): string => {
  return `${race.style}-${race.distance}-${race.gender}-${race.ageGroup}`;
};

const genderDisplayPrint = (gender: Swimmer['gender'] | 'Mixed'): string => {
  return gender === 'Male' ? 'PUTRA' : 'PUTRI';
};

const PrintableEventProgram: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const initialPrintData = location.state?.printData as EventProgramPrintData | undefined;
  const printCalled = useRef(false);

  const [printData, setPrintData] = useState<EventProgramPrintData | null>(initialPrintData || null);
  const [loading, setLoading] = useState<boolean>(!initialPrintData);
  const [error, setError] = useState<string | null>(null);

  const defaultRaceSort = useCallback((a: RaceDefinition, b: RaceDefinition): number => {
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
  }, []);

  const getHeatsForRace = useCallback((race: RaceDefinition, event: SwimEvent, results: SwimResult[], swimmers: Swimmer[]): Heat[] => {
    if (!event || !results.length || !swimmers.length) return [];
    const raceSwimmersWithSeedTime: SeededSwimmerInfo[] = [];
    results.forEach(r => {
      const swimmer = swimmers.find(s => s.id === r.swimmerId);
      if (swimmer && swimmer.dob && r.style === race.style && r.distance === race.distance && swimmer.gender === race.gender && r.seedTime) {
        const currentSwimmerAgeGroup = getAgeGroup(swimmer, event);
        if (currentSwimmerAgeGroup === race.ageGroup && timeToMilliseconds(r.seedTime!) >= 0) {
          raceSwimmersWithSeedTime.push({
            resultId: r.id, swimmerId: r.swimmerId, name: swimmer.name, clubName: swimmer.clubName, gender: swimmer.gender,
            ageGroup: currentSwimmerAgeGroup,
            seedTimeMs: timeToMilliseconds(r.seedTime!), seedTimeStr: r.seedTime!,
            finalTimeStr: r.time || undefined, remarks: r.remarks || undefined,
            swimmerDob: swimmer.dob,
            swimmerGradeLevel: swimmer.gradeLevel,
          });
        }
      }
    });
    const lanesForThisEvent = event?.lanesPerEvent || 8;
    return generateHeats(raceSwimmersWithSeedTime, lanesForThisEvent);
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
      if (isNaN(parseInt(eventId))) {
        throw new Error("Invalid Event ID format.");
      }

      const [eventData, resultsData, swimmersData, customOrderedKeys] = await Promise.all([
        getEventById(eventId),
        getResults(),
        getSwimmers(),
        getEventProgramOrder(eventId)
      ]);

      if (!eventData) {
        throw new Error(`Event with ID ${eventId} not found.`);
      }

      const filteredResults = resultsData.filter(r => r.eventId === eventId);

      const raceMap = new Map<string, RaceDefinition>();
      filteredResults.forEach(result => {
        const swimmer = swimmersData.find(s => s.id === result.swimmerId);
        if (!swimmer || !swimmer.gender || !swimmer.dob || !result.seedTime) return;
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
        const initialRacesMap = new Map(initialUniqueRaces.map(r => [generateRaceKey(r), r]));
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

      const racesWithHeats = numberedUniqueRaces.map(race => ({
        race: race,
        heats: getHeatsForRace(race, eventData, filteredResults, swimmersData)
      })).filter(rwh => rwh.heats.length > 0);

      setPrintData({
        event: eventData,
        numberedUniqueRaces: numberedUniqueRaces,
        racesWithHeats: racesWithHeats,
      });

    } catch (err: any) {
      console.error("Failed to fetch data for print:", err);
      setError(err.message || "Could not load data for printing.");
    } finally {
      setLoading(false);
    }
  }, [eventId, defaultRaceSort, getHeatsForRace]);

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

  if (loading) return <LoadingSpinner text="Preparing program for printing..." />;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!printData) return <div className="text-center py-10">No data available to print.</div>;

  const { event, racesWithHeats } = printData;
  const isGradeSystemEvent = event.categorySystem === 'GRADE' || event.categorySystem === 'SCHOOL_LEVEL';

  return (
    <div className="printable-container p-4 sm:p-8 bg-white text-black">
      <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 10pt; height: auto !important; overflow: visible !important; }
            html { height: auto !important; overflow: visible !important; }
            .printable-container { width: 100%; margin: 0; padding: 10mm !important; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 10px; }
            th, td { border: 1px solid #ccc !important; padding: 4px 6px !important; text-align: left !important; font-size: 9pt !important; }
            thead { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; color-adjust: exact; display: table-header-group; }
            h1, h2, h3, p { color: black !important; }
            .event-header, .race-header, .heat-header { page-break-after: avoid !important; }
            .race-section { page-break-inside: auto; }
            .heat-section { page-break-inside: auto; }
            a { text-decoration: none; color: inherit; }
          }
          .screen-header { margin-bottom: 20px; text-align: center; }
          .screen-button { margin: 20px auto; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; display: block; }
      `}</style>
      <div className="screen-header no-print">
        <h1 className="text-xl font-bold">Print Preview: Event Program</h1>
        <p>The print dialog should open automatically. If not, please use your browser's print function (Ctrl/Cmd+P).</p>
        <button onClick={() => window.print()} className="screen-button">Print Now</button>
        <button onClick={() => navigate(`/events/${eventId}/program`)} className="screen-button" style={{ backgroundColor: '#6c757d' }}>Back to Program</button>
      </div>
      <div className="event-header text-center mb-4">
        <h1 className="text-xl font-bold uppercase">KEJUARAAN RENANG {event.name.toUpperCase()}</h1>
        <p className="text-sm">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event.location}</p>
        <p className="text-xs">Menggunakan {event.lanesPerEvent || 8} Lintasan. Sistem Kategori: {event.categorySystem || 'KU'}</p>
      </div>
      {racesWithHeats.length === 0 && <p className="text-center">No heats generated for this program.</p>}
      {racesWithHeats.map(({ race, heats }) => {
        const lanesToShow = event.lanesPerEvent || 8;
        const categoryHeaderLabel = isGradeSystemEvent ? 'Grade' : 'Kelas';
        return (
          <div key={`${race.style}-${race.distance}-${race.gender}-${race.ageGroup}`} className="race-section mb-6">
            <h2 className="race-header text-lg font-semibold mt-4 mb-2 text-left">
              ACARA {race.acaraNumber} - {race.distance}M {race.style.toUpperCase()} - {race.ageGroup.toUpperCase()} {genderDisplayPrint(race.gender)} - SCM
            </h2>
            {heats.map((heat) => (
              <div key={heat.heatNumber} className="heat-section mb-3">
                <h3 className="heat-header text-md font-medium mb-1 text-left">SERI {heat.heatNumber}</h3>
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th>Lintasan</th><th>Nama</th><th>{categoryHeaderLabel}</th><th>Club</th><th>Prestasi</th><th>Waktu Final</th><th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(lanesToShow)].map((_, laneIndex) => {
                      const laneNumber = laneIndex + 1;
                      const laneItem = heat.lanes.find(l => l.lane === laneNumber);
                      const swimmer = laneItem?.swimmer;
                      const displayCategory = swimmer ? (isGradeSystemEvent ? (swimmer.swimmerGradeLevel || swimmer.ageGroup) : swimmer.ageGroup) : '';
                      return (
                        <tr key={laneNumber}>
                          <td>{laneNumber}</td>
                          <td>{swimmer ? swimmer.name : ''}</td>
                          <td>{displayCategory}</td>
                          <td>{swimmer ? swimmer.clubName : ''}</td>
                          <td>{swimmer ? swimmer.seedTimeStr : ''}</td>
                          <td>{swimmer ? (swimmer.finalTimeStr || '-') : ''}</td>
                          <td>{swimmer ? (swimmer.remarks || '-') : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default PrintableEventProgram;