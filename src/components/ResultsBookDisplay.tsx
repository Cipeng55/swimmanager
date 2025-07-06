import React from 'react';
import { RaceResults, ResultEntry } from '../types';

interface ResultsBookDisplayProps {
  raceResults: RaceResults;
  isGradeSystem?: boolean; // To differentiate display for Grade system
}

const ResultsBookDisplay: React.FC<ResultsBookDisplayProps> = ({ raceResults, isGradeSystem = false }) => {
  if (!raceResults.results || raceResults.results.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No results available for this race.</p>;
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club</th>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Seed Time</th>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Final Time</th>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Remarks</th>
            <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date Recorded</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {raceResults.results.map((result: ResultEntry) => (
            <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {result.rank !== undefined ? result.rank : (result.remarks || '-')}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{result.swimmerName}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.swimmerClubName}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.seedTimeStr || '-'}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">
                {result.time && result.time !== "99:99.99" ? result.time : (result.remarks ? '' : '-')}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.remarks || '-'}</td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(result.dateRecorded).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultsBookDisplay;
