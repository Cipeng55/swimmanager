/**
 * @file exportUtils.ts
 * Contains utility functions for exporting data from the application,
 * primarily to CSV format.
 */

/**
 * Escapes a value for CSV format. If the value contains a comma, double quote,
 * or newline, it will be enclosed in double quotes. Existing double quotes
 * within the value will be escaped by doubling them.
 * @param value The value to escape.
 * @returns The CSV-safe string.
 */
const escapeCsvValue = (value: any): string => {
  const stringValue = String(value ?? ''); // Handle null/undefined by converting to empty string
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Converts an array of objects into a CSV string.
 * @param data An array of objects to be converted.
 * @param headers Optional array of strings to use as headers. If not provided, keys of the first object are used.
 * @returns A string in CSV format.
 */
export const arrayToCsv = (data: Record<string, any>[], headers?: string[]): string => {
  if (!data || data.length === 0) {
    return '';
  }

  const csvHeaders = headers || Object.keys(data[0]);
  const headerRow = csvHeaders.map(escapeCsvValue).join(',');

  const rows = data.map(row =>
    csvHeaders.map(header => escapeCsvValue(row[header])).join(',')
  );

  return [headerRow, ...rows].join('\n');
};


/**
 * Triggers a browser download for the given text content.
 * @param content The string content to be downloaded.
 * @param fileName The name of the file to be saved (e.g., 'export.csv').
 * @param mimeType The MIME type of the file (e.g., 'text/csv;charset=utf-8;').
 */
export const downloadFile = (content: string, fileName: string, mimeType: string): void => {
  // Add BOM for UTF-8 to ensure Excel opens it correctly
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, content], { type: mimeType });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.style.visibility = 'hidden';
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
