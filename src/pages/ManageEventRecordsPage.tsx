import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SwimEvent, SwimResult, Swimmer, NationalRecordDefinition, RaceDefinition } from '../types';
import { getEventById, getResults, getSwimmers, updateEvent } from '../services/api';
import { getAgeGroup } from '../utils/ageUtils';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ManageEventRecordsPage: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<SwimEvent | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);
    const [records, setRecords] = useState<NationalRecordDefinition[]>([]);
    const [activeRaces, setActiveRaces] = useState<RaceDefinition[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            if (!eventId) return;
            setLoading(true);
            try {
                const [eventData, resultsData, swimmersData] = await Promise.all([
                    getEventById(eventId),
                    getResults(),
                    getSwimmers(),
                ]);

                setEvent(eventData);
                setRecords(eventData.nationalRecords || []);

                // Find active races in this event
                const eventResults = resultsData.filter(r => r.eventId === eventId);
                const raceKeys = new Set<string>();
                const races: RaceDefinition[] = [];

                eventResults.forEach(r => {
                    const swimmer = swimmersData.find(s => s.id === r.swimmerId);
                    if (!swimmer) return;
                    const ageGroup = getAgeGroup(swimmer, eventData);
                    const key = `${r.style}-${r.distance}-${swimmer.gender}-${ageGroup}`;
                    if (!raceKeys.has(key)) {
                        raceKeys.add(key);
                        races.push({
                            style: r.style,
                            distance: r.distance,
                            gender: swimmer.gender,
                            ageGroup: ageGroup
                        });
                    }
                });

                setActiveRaces(races.sort((a, b) => a.style.localeCompare(b.style) || a.distance - b.distance));
            } catch (err: any) {
                setError(err.message || "Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [eventId]);

    const handleRecordChange = (race: RaceDefinition, time: string) => {
        setRecords(prev => {
            const existingIdx = prev.findIndex(r => 
                r.style === race.style && 
                r.distance === race.distance && 
                r.gender === race.gender && 
                r.ageGroup === race.ageGroup
            );

            if (existingIdx !== -1) {
                const newRecords = [...prev];
                newRecords[existingIdx] = { ...race, time };
                return newRecords;
            } else {
                return [...prev, { ...race, time }];
            }
        });
        setSuccess(false);
    };

    const handleSave = async () => {
        if (!event || !eventId) return;
        setSaving(true);
        setError(null);
        try {
            await updateEvent(eventId, { nationalRecords: records });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to save records");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingSpinner text="Memuat data race..." />;
    if (!event) return <div className="text-center py-10">Event tidak ditemukan.</div>;

    return (
        <div className="container mx-auto px-4 py-8">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 uppercase">Input Rekor Nasional</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Masukkan rekor nasional untuk penentuan tie-breaker Pemain Terbaik.</p>
                </div>
                <Link to={`/events/edit/${eventId}`} className="text-primary hover:underline">Kembali ke Event</Link>
            </header>

            {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            {success && <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">Rekor berhasil disimpan!</div>}

            {!event.useNationalRecords && (
                <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-bold">Sistem Rekor Nasional Sedang Nonaktif</p>
                            <p className="text-xs mt-1">
                                Data rekor ini tidak akan digunakan dalam perhitungan Pemain Terbaik kecuali Anda mengaktifkan 
                                <Link to={`/events/edit/${eventId}`} className="ml-1 underline font-bold">"Gunakan Sistem Rekor Nasional"</Link> di pengaturan event.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Race</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rekor Nasional (MM:SS.ss)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {activeRaces.map((race, idx) => {
                                const record = records.find(r => 
                                    r.style === race.style && 
                                    r.distance === race.distance && 
                                    r.gender === race.gender && 
                                    r.ageGroup === race.ageGroup
                                );
                                return (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {race.distance}m {race.style}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {race.gender === 'Male' ? 'Putra' : 'Putri'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {race.ageGroup}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input
                                                type="text"
                                                placeholder="01:23.45"
                                                className="w-32 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary"
                                                value={record?.time || ''}
                                                onChange={(e) => handleRecordChange(race, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                            {activeRaces.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                                        Belum ada hasil lomba yang diinput untuk event ini. Masukkan hasil lomba terlebih dahulu.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 text-right">
                    <button
                        onClick={handleSave}
                        disabled={saving || activeRaces.length === 0}
                        className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-6 rounded-lg shadow-md disabled:opacity-50 transition-all"
                    >
                        {saving ? 'Menyimpan...' : 'Simpan Rekor'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManageEventRecordsPage;
