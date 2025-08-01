import { SwimEvent, LetterCategory, Swimmer } from '../types'; 

/**
 * Calculates the age of a person given their date of birth and a reference date.
 * @param dobString Date of birth in "YYYY-MM-DD" format.
 * @param eventDateString The date on which to calculate the age, in "YYYY-MM-DD" format.
 * @returns The age in years.
 */
export const calculateAge = (dobString: string, eventDateString: string): number => {
  if (!dobString || !eventDateString) return -1; // Indicate error or invalid input

  const dob = new Date(dobString);
  const eventDate = new Date(eventDateString);

  if (isNaN(dob.getTime()) || isNaN(eventDate.getTime())) return -1; // Indicate error

  let age = eventDate.getFullYear() - dob.getFullYear();
  const monthDiff = eventDate.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && eventDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

/**
 * Determines the age group category based on swimmer's DOB/Grade and the event's category system.
 * @param swimmer The swimmer object, containing dob and optional gradeLevel.
 * @param event The swim event object, containing event.date, categorySystem, and optional letterAgeRanges.
 * @returns A string representing the age group label.
 */
export const getAgeGroup = (
  swimmer: Pick<Swimmer, 'dob' | 'gradeLevel'>,
  event: Pick<SwimEvent, 'date' | 'categorySystem' | 'letterAgeRanges'>
): string => {
  const categorySystem = event.categorySystem || 'KU';
  
  if (categorySystem === 'GRADE') {
    return swimmer.gradeLevel || "Grade Not Specified";
  }
  
  if (categorySystem === 'SCHOOL_LEVEL') {
    const grade = swimmer.gradeLevel;
    if (!grade || grade.trim() === '') return "Grade Not Specified";

    if (grade === 'SD Kelas 1' || grade === 'SD Kelas 2') return "A. 1-2 SD/MI";
    if (grade === 'SD Kelas 3' || grade === 'SD Kelas 4') return "B. 3-4 SD/MI";
    if (grade === 'SD Kelas 5' || grade === 'SD Kelas 6') return "C. 5-6 SD/MI";
    if (grade === 'SMP Kelas VII' || grade === 'SMP Kelas VIII' || grade === 'SMP Kelas IX') return "D. 7-9 SMP/MTS";
    if (grade === 'SMA Kelas X' || grade === 'SMA Kelas XI' || grade === 'SMA Kelas XII') return "E. 10-12 SMA/MA";
    
    return "Ungrouped Grade"; // For grades not in a group (e.g., TK, Umum)
  }

  const ageAtEvent = calculateAge(swimmer.dob, event.date);
  if (ageAtEvent < 0) return "Unknown Age"; // Invalid age calculation

  switch (categorySystem) {
    case 'LETTER':
      if (event.letterAgeRanges) {
        const letterOrder: LetterCategory[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']; 
        for (const letter of letterOrder) {
          const customRange = event.letterAgeRanges[letter];
          if (customRange && customRange.startDate && customRange.endDate) {
            try {
              const swimmerDobDate = new Date(swimmer.dob + 'T00:00:00');
              const rangeStartDate = new Date(customRange.startDate + 'T00:00:00');
              const rangeEndDate = new Date(customRange.endDate + 'T23:59:59');

              if (isNaN(swimmerDobDate.getTime()) || isNaN(rangeStartDate.getTime()) || isNaN(rangeEndDate.getTime())) {
                continue; 
              }
              if (swimmerDobDate >= rangeStartDate && swimmerDobDate <= rangeEndDate) {
                return letter; 
              }
            } catch (e) {
                console.error("Error parsing dates for letter category:", e);
                continue;
            }
          }
        }
      }
      return `Unknown Letter (${ageAtEvent}y)`; 

    case 'KU':
    default:
      if (ageAtEvent <= 9) return "KU V";
      if (ageAtEvent >= 10 && ageAtEvent <= 11) return "KU IV";
      if (ageAtEvent >= 12 && ageAtEvent <= 13) return "KU III";
      if (ageAtEvent >= 14 && ageAtEvent <= 15) return "KU II";
      if (ageAtEvent >= 16 && ageAtEvent <= 18) return "KU I";
      if (ageAtEvent >= 19) return "KU Senior";
      return "Unknown KU";
  }
};

/**
 * Returns a sortable numeric value for an age group label, considering different category systems.
 * Lower numbers indicate younger/earlier groups.
 * @param ageGroupLabel The age group string label (e.g., "KU V", "A", "A. 1-2 SD/MI", "SD Kelas 1").
 * @returns A number for sorting.
 */
export const getSortableAgeGroup = (ageGroupLabel: string): number => {
  // KU System
  if (ageGroupLabel === "KU V") return 1;
  if (ageGroupLabel === "KU IV") return 2;
  if (ageGroupLabel === "KU III") return 3;
  if (ageGroupLabel === "KU II") return 4;
  if (ageGroupLabel === "KU I") return 5;
  if (ageGroupLabel === "KU Senior") return 6;

  // LETTER System (A is youngest/earliest DOB range)
  if (ageGroupLabel === "A") return 10;
  if (ageGroupLabel === "B") return 11;
  if (ageGroupLabel === "C") return 12;
  if (ageGroupLabel === "D") return 13;
  if (ageGroupLabel === "E") return 14;
  if (ageGroupLabel === "F") return 15;
  if (ageGroupLabel === "G") return 16;
  if (ageGroupLabel === "H") return 17;
  if (ageGroupLabel === "I") return 18;
  
  // New SCHOOL_LEVEL System (Grouped Grade)
  if (ageGroupLabel === "A. 1-2 SD/MI") return 20;
  if (ageGroupLabel === "B. 3-4 SD/MI") return 21;
  if (ageGroupLabel === "C. 5-6 SD/MI") return 22;
  if (ageGroupLabel === "D. 7-9 SMP/MTS") return 23;
  if (ageGroupLabel === "E. 10-12 SMA/MA") return 24;
  
  // GRADE System (Individual Grade)
  if (ageGroupLabel === 'Belum Sekolah / PAUD') return 30;
  if (ageGroupLabel === 'TK A') return 31;
  if (ageGroupLabel === 'TK B') return 32;
  if (ageGroupLabel === 'SD Kelas 1') return 33;
  if (ageGroupLabel === 'SD Kelas 2') return 34;
  if (ageGroupLabel === 'SD Kelas 3') return 35;
  if (ageGroupLabel === 'SD Kelas 4') return 36;
  if (ageGroupLabel === 'SD Kelas 5') return 37;
  if (ageGroupLabel === 'SD Kelas 6') return 38;
  if (ageGroupLabel === 'SMP Kelas VII') return 39;
  if (ageGroupLabel === 'SMP Kelas VIII') return 40;
  if (ageGroupLabel === 'SMP Kelas IX') return 41;
  if (ageGroupLabel === 'SMA Kelas X') return 42;
  if (ageGroupLabel === 'SMA Kelas XI') return 43;
  if (ageGroupLabel === 'SMA Kelas XII') return 44;
  if (ageGroupLabel === 'Lulus / Mahasiswa / Umum') return 45;

  if (ageGroupLabel === "Ungrouped Grade") return 97;
  if (ageGroupLabel === "Grade Not Specified") return 98;
  
  return 99; // Unknown or other groups sort last
};