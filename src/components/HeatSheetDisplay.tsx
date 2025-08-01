import React from 'react';
import { RaceDefinition, Heat, SeededSwimmerInfo } from '../types';
import { EditIcon } from './icons/EditIcon';

interface HeatSheetDisplayProps {
  race: RaceDefinition;
  heats: Heat[];
  onEditLane: (swimmerInfo: SeededSwimmerInfo, laneNumber: number) => void;
  showEditButton?: boolean; 
  isGradeSystem?: boolean; // To differentiate display for Grade system
  isSchoolLevelSystem?: boolean;
}

const HeatSheetDisplay: React.FC<HeatSheetDisplayProps> = ({ race, heats, onEditLane, showEditButton = false, isGradeSystem = false, isSchoolLevelSystem = false }) => {
  if (!heats || heats.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Tidak ada seri (heat) tersedia untuk perlombaan ini.</p>;
  }

  const lanesToShow = heats[0]?.lanes.length || 8; 

  const ageOrGradeHeader = isGradeSystem ? 'Grade Level' : 'Kelas';
  const getAgeOrGradeValue = (swimmer?: SeededSwimmerInfo) => {
    if (!swimmer) return '';
    return isGradeSystem ? swimmer.ageGroup : swimmer.ageGroup;
  };

  return (
    <div className="space-y-6">
      {heats.map((heat) => (
        <div key={heat.heatNumber} className="overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2 text-left">
            SERI {heat.heatNumber}
          </h3>
          <table className="min-w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Lintasan</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Nama</th>
                {isSchoolLevelSystem && <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Nama Sekolah</th>}
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">{ageOrGradeHeader}</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Club</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Prestasi</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Waktu Final</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Keterangan</th>
                {showEditButton && <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600">Aksi</th>}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
              {[...Array(lanesToShow)].map((_, laneIndex) => {
                const laneNumber = laneIndex + 1;
                const laneItem = heat.lanes.find(l => l.lane === laneNumber);
                const swimmer = laneItem?.swimmer;

                return (
                  <tr key={laneNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100">{laneNumber}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                      {swimmer ? swimmer.name : ''}
                    </td>
                    {isSchoolLevelSystem && (
                      <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                        {swimmer ? swimmer.schoolName || '-' : ''}
                      </td>
                    )}
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {getAgeOrGradeValue(swimmer)}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {swimmer ? swimmer.clubName : ''}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {swimmer ? swimmer.seedTimeStr : ''}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {swimmer ? (swimmer.finalTimeStr || '-') : ''}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {swimmer ? (swimmer.remarks || '-') : ''}
                    </td>
                    {showEditButton && (
                      <td className="px-3 py-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600 text-center">
                        {swimmer ? (
                          <button
                            onClick={() => onEditLane(swimmer, laneNumber)}
                            className="text-primary-dark hover:text-primary p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                            aria-label={`Edit result for ${swimmer.name}`}
                            title="Edit Final Time/Remarks"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>
                        ) : ''}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default HeatSheetDisplay;