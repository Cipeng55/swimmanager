
import { SeededSwimmerInfo, Heat, HeatLane } from '../types';

// Lane orders: The array values are the LANE NUMBERS (1-based)
// in order of preference for swimmers in a heat (fastest swimmer gets lane at index 0).
const LANE_ORDERS: { [key: number]: number[] } = {
  8: [4, 5, 3, 6, 2, 7, 1, 8], // Center-out for 8 lanes
  6: [3, 4, 2, 5, 1, 6],     // Center-out for 6 lanes
  4: [2, 3, 1, 4],         // Center-out for 4 lanes
  // Add other lane configurations as needed
};

/**
 * Creates a single heat with appropriate lane assignments.
 * @param swimmersForThisHeat Array of swimmers specifically for this heat.
 * @param heatNum The number of this heat.
 * @param lanesPerHeatConfig The number of lanes configured for this heat.
 * @returns A Heat object.
 */
const createHeat = (
  swimmersForThisHeat: SeededSwimmerInfo[],
  heatNum: number,
  lanesPerHeatConfig: number
): Heat => {
  // Sort swimmers for *this specific heat* by seedTimeMs (fastest first) for lane assignment.
  const sortedHeatSwimmers = [...swimmersForThisHeat].sort((a, b) => a.seedTimeMs - b.seedTimeMs);

  const preferredLaneOrder = LANE_ORDERS[lanesPerHeatConfig] || 
                             [...Array(lanesPerHeatConfig).keys()].map(k => Math.floor(lanesPerHeatConfig/2) + 1 - (k%2 === 0 ? -1 : 1) * Math.ceil(k/2) ); // Fallback basic center-outish

  const heatLanes: HeatLane[] = [];
  // Initialize all lanes as empty
  for (let i = 1; i <= lanesPerHeatConfig; i++) {
    heatLanes.push({ lane: i, swimmer: undefined });
  }

  // Assign swimmers to preferred lanes
  sortedHeatSwimmers.forEach((swimmer, index) => {
    if (index < preferredLaneOrder.length) {
      const targetLaneNumber = preferredLaneOrder[index];
      const laneObject = heatLanes.find(l => l.lane === targetLaneNumber);
      if (laneObject && !laneObject.swimmer) { // Ensure lane is not already taken (shouldn't happen with unique preferredLaneOrder)
        laneObject.swimmer = swimmer;
      } else { 
        // Fallback: if preferred lane is taken or order is imperfect, find first empty lane
        const emptyLane = heatLanes.find(l => l.lane > 0 && !l.swimmer); // find any numbered empty lane
        if (emptyLane) emptyLane.swimmer = swimmer;
      }
    } else {
        // More swimmers than preferred lanes specified, assign to any remaining empty lane
        const emptyLane = heatLanes.find(l => !l.swimmer);
        if (emptyLane) emptyLane.swimmer = swimmer;
    }
  });
  
  // Ensure final lanes array is sorted by lane number for display
  heatLanes.sort((a, b) => a.lane - b.lane);

  return {
    heatNumber: heatNum,
    lanes: heatLanes,
  };
};

/**
 * Generates heats for a list of seeded swimmers based on FINA-like seeding principles.
 * Heats are ordered from slowest swimmers (Heat 1) to fastest swimmers (Last Heat).
 * The first heat may have fewer swimmers if the total is not divisible by lanesPerHeat.
 * Subsequent heats, including the last one, will be full if enough swimmers.
 * @param allSeededSwimmers Array of all swimmers for the race, with seed times.
 * @param lanesPerHeat Number of lanes per heat (default is 8).
 * @returns An array of Heat objects.
 */
export const generateHeats = (
  allSeededSwimmers: SeededSwimmerInfo[],
  lanesPerHeat: number = 8
): Heat[] => {
  if (!allSeededSwimmers || allSeededSwimmers.length === 0) {
    return [];
  }
  if (lanesPerHeat <= 0) {
    console.error("lanesPerHeat must be positive.");
    return [];
  }

  // 1. Sort all swimmers globally: SLOWEST seed time first (larger ms values first).
  //    If seed times are identical, randomize order among tied swimmers.
  let sortedGlobalSwimmers = [...allSeededSwimmers].sort((a, b) => {
    if (a.seedTimeMs === b.seedTimeMs) {
      return Math.random() - 0.5; // Randomize order for ties
    }
    // Sort descending by seedTimeMs to get slowest swimmers first
    return b.seedTimeMs - a.seedTimeMs; 
  });

  const totalSwimmers = sortedGlobalSwimmers.length;
  const heats: Heat[] = [];
  
  if (totalSwimmers === 0) return heats;

  let numSwimmersInFirstHeat = totalSwimmers % lanesPerHeat;
  if (numSwimmersInFirstHeat === 0 && totalSwimmers > 0) {
    numSwimmersInFirstHeat = lanesPerHeat; // All heats are full or exactly one full heat
  }
  
  let currentSwimmerIndex = 0;
  let heatNumber = 1;

  // Create the first heat (Heat 1: slowest swimmers, possibly not full)
  if (numSwimmersInFirstHeat > 0) {
    const firstHeatSwimmers = sortedGlobalSwimmers.slice(
      currentSwimmerIndex,
      currentSwimmerIndex + numSwimmersInFirstHeat
    );
    heats.push(createHeat(firstHeatSwimmers, heatNumber++, lanesPerHeat));
    currentSwimmerIndex += numSwimmersInFirstHeat;
  }

  // Create subsequent full heats, moving towards faster swimmers
  while (currentSwimmerIndex < totalSwimmers) {
    const nextHeatSwimmers = sortedGlobalSwimmers.slice(
      currentSwimmerIndex,
      currentSwimmerIndex + lanesPerHeat
    );
    heats.push(createHeat(nextHeatSwimmers, heatNumber++, lanesPerHeat));
    currentSwimmerIndex += lanesPerHeat;
  }

  return heats; // Heats are already ordered from slowest (Heat 1) to fastest
};
