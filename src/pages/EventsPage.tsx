import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { DeleteIcon } from '../components/icons/DeleteIcon';
import { ListOrderedIcon } from '../components/icons/ListOrderedIcon';
import { TrophyIcon } from '../components/icons/TrophyIcon';
import { AwardIcon } from '../components/icons/AwardIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClipboardCheckIcon } from '../components/icons/ClipboardCheckIcon';
import { ClipboardListIcon } from '../components/icons/ClipboardListIcon';
import { SwimEvent } from '../types';
import { getEvents, deleteEvent as apiDeleteEvent } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { useAuth } from '../contexts/AuthContext';

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<SwimEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [eventToDelete, setEventToDelete] = useState<SwimEvent | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const fetchEventsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (err) {
      setError('Gagal memuat kompetisi. Silakan coba lagi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventsData();
  }, []);

  const handleDeleteClick = (event: SwimEvent) => {
    setEventToDelete(event);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (eventToDelete) {
      try {
        await apiDeleteEvent(eventToDelete.id);
        setEvents(prevEvents => prevEvents.filter(e => e.id !== eventToDelete.id));
        setIsDeleteModalOpen(false);
        setEventToDelete(null);
      } catch (err) {
        setError(`Gagal menghapus kompetisi: ${eventToDelete.name}.`);
        console.error(err);
      }
    }
  };

  if (loading) {
    return <LoadingSpinner text="Memuat daftar kompetisi..." />;
  }

  const canManageEvent = (event: SwimEvent) => {
    if (!currentUser) return false;
    return currentUser.role === 'superadmin' || (currentUser.role === 'admin' && event.createdByAdminId === currentUser.id);
  };

  const getEventStatus = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (eventDateStart.getTime() === todayStart.getTime()) {
      return { 
        label: 'Sedang Berlangsung', 
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' 
      };
    } else if (eventDateStart < todayStart) {
      return { 
        label: 'Selesai', 
        color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' 
      };
    } else {
      return { 
        label: 'Mendatang', 
        color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' 
      };
    }
  };

  const getRegistrationStatus = (event: SwimEvent) => {
    if (event.registrationClosed) {
      return {
        label: 'Pendaftaran Tutup',
        color: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900'
      };
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const eventDateStr = event.date.split('T')[0];
    if (eventDateStr < todayStr) {
      return {
        label: 'Pendaftaran Tutup',
        color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900'
      };
    }
    return {
      label: 'Pendaftaran Buka',
      color: 'bg-emerald-55 text-emerald-800 border-emerald-250 dark:bg-emerald-950/45 dark:text-emerald-250 dark:border-emerald-900'
    };
  };

  const formatCalendarBadge = (dateStr: string) => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = months[d.getMonth()] || '';
    const year = d.getFullYear();
    return { day, month, year };
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (event.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = event.location.toLowerCase().includes(locationFilter.toLowerCase());
    return matchesSearch && matchesLocation;
  });

  const uniqueLocations = Array.from(new Set(events.map(e => e.location))).filter(Boolean);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header Banner */}
      <header className="mb-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl border border-blue-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Kompetisi Renang</h1>
          <p className="mt-2 text-md text-gray-600 dark:text-gray-300">
            {currentUser?.role === 'user' 
              ? "Telusuri seluruh kompetisi resmi dan hasil rekapitulasi poin Anda." 
              : "Kelola agenda, heat sheet, rekor nasional, dan hasil kejuaraan renang."}
          </p>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
          <Link
            to="/events/add"
            className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 ease-in-out self-start sm:self-center"
            aria-label="Create New Event"
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            Tambah Kompetisi Baru
          </Link>
        )}
      </header>

      {/* Search and Filters */}
      <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-gray-800/90 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="md:col-span-2">
          <label htmlFor="search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cari Kompetisi</label>
          <input
            id="search"
            type="text"
            placeholder="Cari berdasarkan nama kompetisi atau deskripsi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          />
        </div>
        <div>
          <label htmlFor="location" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lokasi / Kolam</label>
          <select
            id="location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          >
            <option value="">Semua Lokasi</option>
            {uniqueLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </section>

      {error && (
        <div className="mb-6 p-4 text-center text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Main Grid View */}
      {filteredEvents.length === 0 ? (
        <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-gray-900 text-blue-500 mb-4">
            <ClipboardListIcon className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Tidak Ada Kompetisi Ditemukan</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Kami tidak menemukan agenda kejuaraan renang yang cocok dengan kriteria filter Anda saat ini.
          </p>
          {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
            <Link
              to="/events/add"
              className="mt-4 inline-flex items-center text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              Ubah kriteria pencarian atau buat baru &rarr;
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredEvents.map(event => {
            const status = getEventStatus(event.date);
            const regStatus = getRegistrationStatus(event);
            const { day, month, year } = formatCalendarBadge(event.date);
            const isAuthorized = canManageEvent(event);

            return (
              <article key={event.id} className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 flex flex-col justify-between overflow-hidden">
                {/* Visual Accent Top Bar */}
                <div className="h-1 w-full bg-gradient-to-r from-primary to-indigo-500" />
                
                <div className="p-6">
                  {/* Event Meta Line */}
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${regStatus.color}`}>
                        {regStatus.label}
                      </span>
                    </div>
                    <span className="flex items-center text-xs font-medium text-gray-400 dark:text-gray-500">
                      ID: {event.id.toUpperCase().slice(0, 8)}
                    </span>
                  </div>

                  {/* Calendar & Name Row */}
                  <div className="flex gap-4 items-start">
                    {/* Modern Calendar Badge */}
                    <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-2.5 w-16 h-16 flex-shrink-0 text-center shadow-inner">
                      <span className="text-lg font-black text-primary dark:text-blue-400 leading-none">{day}</span>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wider mt-1">{month}</span>
                      <span className="text-[9px] font-medium text-gray-400 mt-0.5">{year}</span>
                    </div>

                    <div className="flex-grow min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug group-hover:text-primary transition-colors truncate" title={event.name}>
                        {event.name}
                      </h2>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {/* Map Pin Icon */}
                        <svg className="h-4 w-4 mr-1.5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Description Box */}
                  {event.description && (
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {event.description}
                    </p>
                  )}

                  {/* Public Reports & Outputs Segment */}
                  <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                      Laporan & Hasil Kejuaraan
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigate(`/events/${event.id}/program`)}
                        className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-950/60 dark:text-blue-300 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/30 font-semibold text-xs transition duration-200"
                        title="Melihat jadwal tanding, line-up, dan nomor lintasan perenang."
                      >
                        <ListOrderedIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">Program & Heat</span>
                      </button>

                      <button
                        onClick={() => navigate(`/events/${event.id}/results-book`)}
                        className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 dark:text-emerald-300 p-2.5 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 font-semibold text-xs transition duration-200"
                        title="Melihat buku hasil pertandingan seluruh nomor."
                      >
                        <TrophyIcon className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                        <span className="truncate">Buku Hasil</span>
                      </button>

                      <button
                        onClick={() => navigate(`/events/${event.id}/best-swimmers`)}
                        className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 dark:text-amber-300 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-900/30 font-semibold text-xs transition duration-200"
                        title="Melihat rekapitulasi poin perenang terbaik (Best Swimmers)."
                      >
                        <AwardIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <span className="truncate">Perenang Terbaik</span>
                      </button>

                      <button
                        onClick={() => navigate(`/events/${event.id}/best-clubs`)}
                        className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:hover:bg-purple-950/60 dark:text-purple-300 p-2.5 rounded-xl border border-purple-100/50 dark:border-purple-900/30 font-semibold text-xs transition duration-200"
                        title="Melihat peringkat dan skor poin antar perkumpulan/klub."
                      >
                        <UsersIcon className="h-5 w-5 text-purple-500 flex-shrink-0" />
                        <span className="truncate">Klub Terbaik</span>
                      </button>
                    </div>
                  </div>

                  {/* Admin Only Segment */}
                  {isAuthorized && (
                    <div className="mt-5 pt-4 border-t border-dashed border-gray-150 dark:border-gray-700">
                      <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">
                        Pusat Panel Operasional Event
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => navigate(`/events/${event.id}/manage-records`)}
                          className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 dark:text-indigo-300 p-2.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50 font-semibold text-xs transition duration-200"
                          title="Melakukan setup acuan catatan waktu rekor nasional."
                        >
                          <ClipboardCheckIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
                          <span className="truncate">Rekor Nasional</span>
                        </button>

                        <button
                          onClick={() => navigate(`/events/${event.id}/official-report`)}
                          className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:hover:bg-teal-950/60 dark:text-teal-300 p-2.5 rounded-xl border border-teal-100/50 dark:border-teal-900/50 font-semibold text-xs transition duration-200"
                          title="Mengekspor laporan perlombaan resmi kedalam format Excel spreadsheet."
                        >
                          <ClipboardListIcon className="h-5 w-5 text-teal-500 flex-shrink-0" />
                          <span className="truncate">Laporan Resmi</span>
                        </button>

                        <button
                          onClick={() => navigate(`/events/edit/${event.id}`)}
                          className="flex items-center gap-2 bg-gray-50 hover:bg-gray-150 text-gray-700 dark:bg-gray-900 dark:hover:bg-gray-750 dark:text-gray-300 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-xs transition duration-200"
                          title="Mengubah informasi umum kompetisi, tanggal, atau venue."
                        >
                          <EditIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                          <span className="truncate">Ubah Event</span>
                        </button>

                        <button
                          onClick={() => handleDeleteClick(event)}
                          className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-300 p-2.5 rounded-xl border border-red-100/50 dark:border-red-900/30 font-semibold text-xs transition duration-200"
                          title="Menghapus permanen event beserta seluruh data hasil tandingnya."
                        >
                          <DeleteIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                          <span className="truncate text-red-600 dark:text-red-400">Hapus Event</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modern Deletion Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Konfirmasi Penghapusan Event">
        <div className="p-1">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-900/50 flex gap-3 mb-4">
            <svg className="h-6 w-6 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-bold text-sm">Tindakan ini tidak dapat dibatalkan!</h4>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                Seluruh data hasil pertandingan, program lomba, lintasan (heats), dan catatan rekor yang terkait akan terhapus secara permanen dari sistem database.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-650 dark:text-gray-300 mb-6">
            Apakah Anda yakin ingin menghapus kompetisi <strong className="text-gray-900 dark:text-white font-semibold">"{eventToDelete?.name}"</strong>?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-150 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition focus:outline-none"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition focus:outline-none"
            >
              Ya, Hapus Permanen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EventsPage;
