import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SwimEvent, Swimmer, SwimResult, ClubParticipationInfo } from '../types';
import { getEvents, getSwimmers, getResults } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { PrinterIcon } from '../components/icons/PrinterIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClipboardListIcon } from '../components/icons/ClipboardListIcon';

const ClubParticipationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<SwimEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participationList, setParticipationList] = useState<ClubParticipationInfo[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [allEvents, allSwimmers, allResults] = await Promise.all([
          getEvents(),
          getSwimmers(),
          getResults(eventId),
        ]);

        const currentEvent = allEvents.find((e) => e.id === eventId);
        if (!currentEvent) {
          throw new Error('Event not found');
        }
        setEvent(currentEvent);

        const clubDataMap = new Map<string, {
          swimmers: Set<string>;
          individualEntries: number;
          relayEntries: number;
        }>();

        allResults.forEach((result) => {
          const swimmer = allSwimmers.find((s) => s.id === result.swimmerId);
          if (!swimmer) return;

          const clubName = swimmer.clubName || "Unknown Club";

          if (!clubDataMap.has(clubName)) {
            clubDataMap.set(clubName, { swimmers: new Set(), individualEntries: 0, relayEntries: 0 });
          }

          const data = clubDataMap.get(clubName)!;
          data.swimmers.add(swimmer.id);

          if (result.style.includes('Relay')) {
            data.relayEntries++;
          } else {
            data.individualEntries++;
          }
        });

        const list: ClubParticipationInfo[] = Array.from(clubDataMap.entries()).map(([clubName, data]) => ({
          clubName,
          totalSwimmers: data.swimmers.size,
          individualEntries: data.individualEntries,
          relayEntries: data.relayEntries,
          totalEntries: data.individualEntries + data.relayEntries
        })).sort((a, b) => a.clubName.localeCompare(b.clubName));

        setParticipationList(list);
      } catch (err: any) {
        console.error("Error loading club participation data:", err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      loadData();
    }
  }, [eventId]);

  const handlePrint = () => {
    navigate(`/events/${eventId}/club-participation/print`, { 
        state: { 
            event, 
            participationList 
        } 
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        Error: {error || 'Event not found'}
      </div>
    );
  }

  const totals = participationList.reduce((acc, curr) => ({
    swimmers: acc.swimmers + curr.totalSwimmers,
    individual: acc.individual + curr.individualEntries,
    relay: acc.relay + curr.relayEntries,
    overall: acc.overall + curr.totalEntries,
  }), { swimmers: 0, individual: 0, relay: 0, overall: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardListIcon className="h-6 w-6 text-indigo-500" />
              Rekap Partisipasi Klub
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {event.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/events`)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-lg transition"
            >
              Kembali
            </button>
            <button
              onClick={handlePrint}
              disabled={participationList.length === 0}
              className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              <PrinterIcon className="h-5 w-5" />
              Print Rekapitulasi
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
              <tr>
                <th scope="col" className="px-6 py-4 rounded-tl-xl">No</th>
                <th scope="col" className="px-6 py-4">Nama Klub</th>
                <th scope="col" className="px-6 py-4 text-center">Total Atlet</th>
                <th scope="col" className="px-6 py-4 text-center">Nomor Perorangan</th>
                <th scope="col" className="px-6 py-4 text-center">Nomor Estafet</th>
                <th scope="col" className="px-6 py-4 text-center rounded-tr-xl">Total Entri</th>
              </tr>
            </thead>
            <tbody>
              {participationList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Belum ada data partisipasi untuk event ini.
                  </td>
                </tr>
              ) : (
                participationList.map((item, index) => (
                  <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {item.clubName}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                        {item.totalSwimmers}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {item.individualEntries}
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {item.relayEntries}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">
                      {item.totalEntries}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {participationList.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-700 font-bold text-gray-900 dark:text-white">
                <tr>
                  <td className="px-6 py-4 rounded-bl-xl text-right" colSpan={2}>
                    TOTAL KESELURUHAN
                  </td>
                  <td className="px-6 py-4 text-center">
                    {totals.swimmers}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {totals.individual}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {totals.relay}
                  </td>
                  <td className="px-6 py-4 text-center rounded-br-xl">
                    {totals.overall}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClubParticipationPage;
