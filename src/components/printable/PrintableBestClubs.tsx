import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BestClubsPrintData } from '../../types';

const PrintableBestClubs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const printData = location.state?.printData as BestClubsPrintData | undefined;
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
    return (
        <div className="text-center py-10">
            <p>Data untuk dicetak tidak ditemukan.</p>
            <p className='text-sm text-gray-600'>Halaman ini harus diakses dari tombol "Cetak" di halaman Klub Terbaik.</p>
            {eventId && (
                <button
                    onClick={() => navigate(`/events/${eventId}/best-clubs`)}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-md"
                >
                    Kembali ke Halaman Klub Terbaik
                </button>
            )}
        </div>
    );
  }

  const { event, bestClubs } = printData;

  return (
    <div className="printable-container p-4 sm:p-8 bg-white text-black font-sans">
      <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 11pt; }
            .printable-container { width: 100%; margin: 0; padding: 10mm !important; box-shadow: none !important; border: none !important; }
            .no-print { display: none !important; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 10px; }
            th, td { border: 1px solid #ccc !important; padding: 4px 6px !important; text-align: left !important; font-size: 10pt !important; }
            thead { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; color-adjust: exact; display: table-header-group; }
            h1, h2, h3, p { color: black !important; }
            a { text-decoration: none; color: inherit; }
          }
          .screen-header { margin-bottom: 20px; text-align: center; }
          .screen-button { margin: 10px auto; padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; display: inline-block; }
      `}</style>
      <div className="screen-header no-print">
        <h1 className="text-xl font-bold">Print Preview: Best Clubs</h1>
        <p>Dialog cetak akan terbuka otomatis. Jika tidak, gunakan fungsi cetak browser Anda (Ctrl/Cmd+P).</p>
        <div>
          <button onClick={() => window.print()} className="screen-button">Cetak Sekarang</button>
          <button onClick={() => navigate(`/events/${eventId}/best-clubs`)} className="screen-button" style={{ backgroundColor: '#6c757d', marginLeft: '10px' }}>Kembali</button>
        </div>
      </div>
      <div className="event-header text-center mb-6">
        <h1 className="text-2xl font-bold uppercase">DAFTAR PERKUMPULAN TERBAIK</h1>
        <h2 className="text-xl font-semibold uppercase">{event.name.toUpperCase()}</h2>
        <p className="text-sm">{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - {event.location}</p>
      </div>

      <table className="min-w-full">
          <thead>
              <tr>
                  <th>Rank</th>
                  <th>Club Name</th>
                  <th>🥇 Gold</th>
                  <th>🥈 Silver</th>
                  <th>🥉 Bronze</th>
              </tr>
          </thead>
          <tbody>
              {bestClubs.map((club) => (
                  <tr key={club.clubName}>
                      <td style={{textAlign: 'center', fontWeight: 'bold'}}>{club.rank}</td>
                      <td>{club.clubName}</td>
                      <td style={{textAlign: 'center'}}>{club.goldMedalCount}</td>
                      <td style={{textAlign: 'center'}}>{club.silverMedalCount}</td>
                      <td style={{textAlign: 'center'}}>{club.bronzeMedalCount}</td>
                  </tr>
              ))}
          </tbody>
      </table>
    </div>
  );
};

export default PrintableBestClubs;
