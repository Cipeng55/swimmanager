import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { ClubParticipationPrintData } from '../../types';

const PrintableClubParticipation: React.FC = () => {
  const location = useLocation();
  const printData = location.state as ClubParticipationPrintData;

  if (!printData || !printData.event) {
    return <Navigate to="/events" replace />;
  }

  const { event, participationList } = printData;

  const totals = participationList.reduce((acc, curr) => ({
    swimmers: acc.swimmers + curr.totalSwimmers,
    individual: acc.individual + curr.individualEntries,
    relay: acc.relay + curr.relayEntries,
    overall: acc.overall + curr.totalEntries,
  }), { swimmers: 0, individual: 0, relay: 0, overall: 0 });

  return (
    <div className="bg-white p-8 max-w-5xl mx-auto text-black print:p-0 print:max-w-none">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-800 transition"
        >
          Kembali
        </button>
        <button 
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow transition"
        >
          Cetak Rekapitulasi
        </button>
      </div>

      <div className="print-section">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">
            REKAPITULASI PARTISIPASI KLUB
          </h1>
          <h2 className="text-xl font-semibold text-gray-800">{event.name}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Tanggal: {new Date(event.date).toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} | Lokasi: {event.location}
          </p>
        </div>

        <table className="w-full text-sm border-collapse border border-gray-400">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-400 px-3 py-2 text-center w-12">No</th>
              <th className="border border-gray-400 px-3 py-2 text-left">Nama Klub / Perkumpulan</th>
              <th className="border border-gray-400 px-3 py-2 text-center w-24">Total Atlet</th>
              <th className="border border-gray-400 px-3 py-2 text-center w-32">Nomor Perorangan</th>
              <th className="border border-gray-400 px-3 py-2 text-center w-32">Nomor Estafet</th>
              <th className="border border-gray-400 px-3 py-2 text-center w-32">Total Entri</th>
            </tr>
          </thead>
          <tbody>
            {participationList.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-gray-400 px-3 py-4 text-center italic text-gray-500">
                  Tidak ada data partisipasi
                </td>
              </tr>
            ) : (
              participationList.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-400 px-3 py-1.5 text-center">{index + 1}</td>
                  <td className="border border-gray-400 px-3 py-1.5 font-semibold">{item.clubName}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-center">{item.totalSwimmers}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-center">{item.individualEntries}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-center">{item.relayEntries}</td>
                  <td className="border border-gray-400 px-3 py-1.5 text-center font-bold bg-gray-50">{item.totalEntries}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-200 font-bold">
            <tr>
              <td colSpan={2} className="border border-gray-400 px-3 py-2 text-right">
                TOTAL KESELURUHAN
              </td>
              <td className="border border-gray-400 px-3 py-2 text-center">{totals.swimmers}</td>
              <td className="border border-gray-400 px-3 py-2 text-center">{totals.individual}</td>
              <td className="border border-gray-400 px-3 py-2 text-center">{totals.relay}</td>
              <td className="border border-gray-400 px-3 py-2 text-center">{totals.overall}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer info (Timestamp of printing) */}
        <div className="mt-8 text-xs text-gray-500 text-right">
          Dicetak pada: {new Date().toLocaleString('id-ID')}
        </div>
      </div>
    </div>
  );
};

export default PrintableClubParticipation;
