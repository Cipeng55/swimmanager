import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BestSwimmersPrintData } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import { AwardIcon } from '../icons/AwardIcon';

const PrintableBestSwimmers: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const printData = location.state?.printData as BestSwimmersPrintData | undefined;
  const printCalled = useRef(false);

  useEffect(() => {
    if (printData && !printCalled.current) {
      printCalled.current = true;
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [printData]);

  if (!printData) {
    // This could happen if the page is accessed directly without state.
    // Ideally, we'd fetch data, but for now, we show a message and a way back.
    return (
        <div className="text-center py-10">
            <p>Data untuk dicetak tidak ditemukan.</p>
            <p className='text-sm text-gray-600'>Halaman ini harus diakses dari tombol "Cetak" di halaman Pemain Terbaik.</p>
            {eventId && (
                <button
                    onClick={() => navigate(`/events/${eventId}/best-swimmers`)}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
                >
                    Kembali ke Halaman Pemain Terbaik
                </button>
            )}
        </div>
    );
  }

  const { event, bestSwimmers } = printData;

  return (
    <div className="printable-container p-4 sm:p-8 bg-white text-black font-sans">
      <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 11pt; }
            .printable-container { width: 100%; margin: 0; padding: 10mm !important; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
            .category-card { border: 1px solid #ccc !important; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
            h1, h2, h3, p { color: black !important; }
            a { text-decoration: none; color: inherit; }
          }
          .screen-header { margin-bottom: 20px; text-align: center; }
          .screen-button { margin: 10px auto; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; display: inline-block; }
          .category-card { border: 1px solid #eee; }
      `}</style>
      <div className="screen-header no-print">
        <h1 className="text-xl font-bold">Print Preview: Best Swimmers</h1>
        <p>Dialog cetak akan terbuka otomatis. Jika tidak, gunakan fungsi cetak browser Anda (Ctrl/Cmd+P).</p>
        <div>
          <button onClick={() => window.print()} className="screen-button">Cetak Sekarang</button>
          <button onClick={() => navigate(`/events/${eventId}/best-swimmers`)} className="screen-button" style={{ backgroundColor: '#6c757d', marginLeft: '10px' }}>Kembali</button>
        </div>
      </div>
      <div className="event-header text-center mb-6">
        <h1 className="text-2xl font-bold uppercase">DAFTAR PEMAIN TERBAIK</h1>
        <h2 className="text-xl font-semibold uppercase">{event.name.toUpperCase()}</h2>
        <p className="text-sm">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event.location}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {bestSwimmers.map((categoryResult) => (
          <div key={categoryResult.categoryTitle} className="category-card rounded-lg">
            <h3 className="text-lg font-bold text-center border-b-2 border-gray-400 pb-2 mb-3">
              {categoryResult.categoryTitle}
            </h3>
            <ul className="space-y-2">
              {categoryResult.swimmers.map((swimmer) => (
                <li key={swimmer.swimmerId} className="flex flex-col items-center text-center">
                    <AwardIcon className="h-8 w-8 text-gray-700 mb-1" />
                    <p className="font-semibold text-base">{swimmer.swimmerName}</p>
                    <p className="text-sm text-gray-600">{swimmer.swimmerClubName}</p>
                    <p className="text-xs font-bold text-gray-800">
                      {swimmer.goldMedalCount} Medali Emas
                    </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrintableBestSwimmers;
