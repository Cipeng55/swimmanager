// utils/csvParser.ts
export interface ParsedSwimmerRow {
  Name?: string;
  DOB?: string;
  Gender?: string;
  Club?: string; // This will be ignored, but kept for parsing flexibility
  GradeLevel?: string; // Added for school grade
  SchoolName?: string;
}

/**
 * Parses CSV text into an array of swimmer data objects.
 * Expects headers roughly matching: Name,DOB,Gender,GradeLevel,SchoolName (Club is ignored)
 * @param csvText The raw CSV string.
 * @returns An array of ParsedSwimmerRow objects.
 * @throws Error if essential headers (Name, DOB, Gender) are missing.
 */
export const parseSwimmerCsv = (csvText: string): ParsedSwimmerRow[] => {
  const lines = csvText.trim().split(/\r\n|\n/); 
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  if (!headerLine) throw new Error("CSV file is empty or has no header row.");

  const rawHeaders = headerLine.split(',').map(h => h.trim());
  
  // Define canonical headers (what our app expects internally)
  const canonicalExpectedHeaders: { [key: string]: keyof ParsedSwimmerRow } = {
    name: 'Name',
    dob: 'DOB',
    gender: 'Gender',
    club: 'Club', // Kept for parsing but will be ignored
    gradelevel: 'GradeLevel', 
    schoolname: 'SchoolName',
  };
  const requiredDisplayHeaders: (keyof ParsedSwimmerRow)[] = ['Name', 'DOB', 'Gender'];

  // Map raw headers from CSV to our canonical headers
  const headerMapping: { [rawHeaderFromFile: string]: keyof ParsedSwimmerRow | null } = {};
  const foundCanonicalHeaders = new Set<keyof ParsedSwimmerRow>();

  rawHeaders.forEach(rawHeader => {
    const lowerRawHeader = rawHeader.toLowerCase().replace(/\s+/g, ''); // Normalize header
    let mappedKey: keyof ParsedSwimmerRow | null = null;
    for (const canonicalKey in canonicalExpectedHeaders) {
      if (lowerRawHeader === canonicalKey) {
        mappedKey = canonicalExpectedHeaders[canonicalKey as keyof typeof canonicalExpectedHeaders];
        foundCanonicalHeaders.add(mappedKey);
        break;
      }
    }
    headerMapping[rawHeader] = mappedKey;
  });
  
  const missingRequiredDisplayHeaders = requiredDisplayHeaders.filter(
    expectedHeader => !foundCanonicalHeaders.has(expectedHeader)
  );

  if (missingRequiredDisplayHeaders.length > 0) {
    throw new Error(`CSV Headers are missing or incorrect. Missing required headers similar to: ${missingRequiredDisplayHeaders.join(', ')}. Please ensure your CSV has columns for Name, DOB, and Gender. GradeLevel and SchoolName are optional and Club is ignored.`);
  }

  if (lines.length < 2) return []; // Only header row, no data

  const dataRows: ParsedSwimmerRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; 

    const values = line.split(','); 
    const row: ParsedSwimmerRow = {};

    Object.values(canonicalExpectedHeaders).forEach(expectedHeaderKey => {
        row[expectedHeaderKey] = undefined;
    });
    
    rawHeaders.forEach((rawHeader, index) => {
      const canonicalHeaderKey = headerMapping[rawHeader];
      if (canonicalHeaderKey) {
        row[canonicalHeaderKey] = values[index]?.trim();
      }
    });
    dataRows.push(row);
  }
  return dataRows;
};