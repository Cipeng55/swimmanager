import { SwimResult, Swimmer, SwimEvent, ResultEntry } from '../types';
import { getAgeGroup } from './ageUtils';
import { timeToMilliseconds } from './timeUtils';

export const processResultsForRankings = (
  event: SwimEvent,
  results: SwimResult[],
  swimmers: Swimmer[]
): { definition: any; results: ResultEntry[] }[] => {
  if (!results.length || !swimmers.length || !event) return [];
  
  const groupedByRace = new Map<string, ResultEntry[]>();
  results.forEach(result => {
    const swimmer = swimmers.find(s => s.id === result.swimmerId);
    if (!swimmer || !swimmer.dob) return;
    const ageGroup = getAgeGroup(swimmer, event);
    if (ageGroup === "Unknown Age" || ageGroup === "Grade Not Specified") return;
    const entry: ResultEntry = { 
        ...result, 
        swimmerName: swimmer.name, 
        swimmerClubName: swimmer.clubName, 
        swimmerSchoolName: swimmer.schoolName, 
        seedTimeStr: result.seedTime || undefined,
        swimmerGrade: swimmer.gradeLevel || '-'
    };
    const raceKey = `${result.style}-${result.distance}-${swimmer.gender}-${ageGroup}`;
    if (!groupedByRace.has(raceKey)) groupedByRace.set(raceKey, []);
    groupedByRace.get(raceKey)!.push(entry);
  });

  const finalRaces: { definition: any; results: ResultEntry[] }[] = [];
  groupedByRace.forEach((raceEntries, raceKey) => {
    const [style, distanceStr, gender, ageGroup] = raceKey.split('-');
    
    // 1. Separate entries into timed and non-timed groups.
    const timedEntries: ResultEntry[] = [];
    const nonTimedEntries: ResultEntry[] = [];

    raceEntries.forEach(entry => {
        const remark = (entry.remarks || '').trim().toUpperCase();
        const hasValidTime = entry.time && timeToMilliseconds(entry.time) > 0;
        if (hasValidTime && !['DQ', 'DNS', 'DNF'].includes(remark)) {
            timedEntries.push(entry);
        } else {
            nonTimedEntries.push(entry);
        }
    });

    // 2. Sort timed entries by performance.
    timedEntries.sort((a, b) => timeToMilliseconds(a.time!) - timeToMilliseconds(b.time!));
    
    // 3. Assign ranks
    let rankCounter = 0;
    let lastTimeMs = -1;
    let swimmersAtLastRank = 1;

    timedEntries.forEach((entry) => {
        const isSP = (entry.remarks || '').trim().toUpperCase() === 'SP';
        
        if (!isSP) {
            const currentTimeMs = timeToMilliseconds(entry.time!);
            if (currentTimeMs > lastTimeMs) {
                rankCounter += swimmersAtLastRank;
                swimmersAtLastRank = 1;
            } else { // Tie
                swimmersAtLastRank++;
            }
            entry.rank = rankCounter;
            lastTimeMs = currentTimeMs;
        } else {
            entry.rank = undefined;
        }
    });
    
    // 4. Sort non-timed entries by swimmer name
    nonTimedEntries.sort((a, b) => a.swimmerName.localeCompare(b.swimmerName));

    finalRaces.push({
      definition: { 
        style, 
        distance: parseInt(distanceStr), 
        gender: gender as Swimmer['gender'], 
        ageGroup
      },
      results: [...timedEntries, ...nonTimedEntries]
    });
  });

  return finalRaces;
};
