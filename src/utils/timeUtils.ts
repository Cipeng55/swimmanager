
/**
 * Converts a time string in MM:SS.ss format to milliseconds.
 * @param timeStr The time string (e.g., "01:58.63").
 * @returns Total time in milliseconds, or 0 if format is invalid.
 */
export const timeToMilliseconds = (timeStr: string): number => {
  if (!timeStr || !/^\d{2}:\d{2}\.\d{2}$/.test(timeStr)) {
    // console.warn(`Invalid time format: ${timeStr}. Expected MM:SS.ss`);
    return 0; // Return a high value for sorting if invalid, or handle error as needed
  }
  const parts = timeStr.split(/[:.]/);
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  const hundredths = parseInt(parts[2], 10);

  if (isNaN(minutes) || isNaN(seconds) || isNaN(hundredths)) {
    // console.warn(`Invalid number in time string: ${timeStr}`);
    return 0;
  }

  return (minutes * 60 * 1000) + (seconds * 1000) + (hundredths * 10);
};

/**
 * Converts milliseconds to a time string in MM:SS.ss format.
 * @param ms Total time in milliseconds.
 * @returns Time string (e.g., "01:58.63").
 */
export const millisecondsToTime = (ms: number): string => {
  if (ms < 0 || isNaN(ms)) {
    return "00:00.00";
  }
  const totalHundredths = Math.round(ms / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const hs = String(hundredths).padStart(2, '0');

  return `${mm}:${ss}.${hs}`;
};
