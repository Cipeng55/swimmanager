
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DashboardSummaryItemData } from '../types';
import SummaryCard from '../components/common/SummaryCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal'; 
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClipboardListIcon } from '../components/icons/ClipboardListIcon';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import { DeleteIcon } from '../components/icons/DeleteIcon'; 
import { getEvents, getSwimmers, getResults, resetAllData as apiResetAllData } from '../services/api'; 
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const DashboardPage: React.FC = () => {
  const [summaryItems, setSummaryItems] = useState<DashboardSummaryItemData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedMsg, setUnauthorizedMsg] = useState<string | null>(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetStatus, setResetStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const { currentUser } = useAuth(); // Get current user
  const location = useLocation();


  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [events, swimmers, results] = await Promise.all([
        getEvents(),
        getSwimmers(),
        getResults()
      ]);

      setSummaryItems([
        {
          id: 'events',
          title: 'Total Events',
          value: events.length,
          icon: <CalendarIcon className="h-8 w-8 text-primary" />,
          description: 'Manage all swimming competitions.',
          linkTo: '/events',
        },
        {
          id: 'swimmers',
          title: 'Registered Swimmers',
          value: swimmers.length,
          icon: <UsersIcon className="h-8 w-8 text-primary" />,
          description: 'View and manage swimmer profiles.',
          linkTo: '/swimmers',
        },
        {
          id: 'results',
          title: 'Recorded Results',
          value: results.length,
          icon: <ClipboardListIcon className="h-8 w-8 text-primary" />,
          description: 'Browse all recorded swim times.',
          linkTo: '/results',
        },
      ]);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError("Could not load dashboard summary. Please try again or data might be reset.");
        setSummaryItems([
           { id: 'events', title: 'Total Events', value: 0, icon: <CalendarIcon className="h-8 w-8 text-primary" />, description: 'Manage all swimming competitions.', linkTo: '/events' },
           { id: 'swimmers', title: 'Registered Swimmers', value: 0, icon: <UsersIcon className="h-8 w-8 text-primary" />, description: 'View and manage swimmer profiles.', linkTo: '/swimmers' },
           { id: 'results', title: 'Recorded Results', value: 0, icon: <ClipboardListIcon className="h-8 w-8 text-primary" />, description: 'Browse all recorded swim times.', linkTo: '/results' },
        ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    if (location.state?.unauthorized) {
      setUnauthorizedMsg("You are not authorized to access the requested page.");
      // Clear the state to prevent message from showing again on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state]);

  const handleResetDataClick = () => {
    setResetStatus(null); 
    setIsResetModalOpen(true);
  };

  const confirmResetAllData = async () => {
    setIsResetModalOpen(false);
    setLoading(true); 
    try {
      await apiResetAllData();
      setResetStatus({ message: 'All application data has been successfully reset.', type: 'success' });
      setTimeout(() => {
         window.location.reload();
      }, 1500); 
    } catch (err: any) {
      console.error("Failed to reset data:", err);
      setResetStatus({ message: err.message || 'Failed to reset data. Please try again.', type: 'error' });
      setLoading(false);
    }
  };


  return (
    <div className="fade-in-effect container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Welcome, {currentUser?.username || 'Guest'}. Here's a quick overview.
        </p>
      </header>

      {unauthorizedMsg && <div className="mb-4 p-3 text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-700 rounded-md">{unauthorizedMsg}</div>}
      {error && !resetStatus && <div className="mb-4 p-3 text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-700 rounded-md">{error}</div>}
      
      {resetStatus && (
        <div className={`mb-4 p-3 rounded-md ${resetStatus.type === 'success' ? 'bg-green-100 dark:bg-green-700 text-green-700 dark:text-green-200' : 'bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-200'}`}>
          {resetStatus.message}
        </div>
      )}

      {loading && !isResetModalOpen ? ( 
        <LoadingSpinner text="Loading dashboard data..." />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {summaryItems.map((item) => (
            <SummaryCard key={item.id} item={item} />
          ))}
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {currentUser?.role === 'admin' && (
            <Link
              to="/events/add"
              className="bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center text-center"
            >
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Add New Event
            </Link>
          )}
          {/* User role can add swimmer */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'user') && (
            <Link
              to="/swimmers/add"
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center text-center"
            >
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Add New Swimmer
            </Link>
          )}
          {currentUser?.role === 'admin' && (
            <Link
              to="/results/add"
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center text-center"
            >
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Add New Result
            </Link>
          )}
           {/* If user role has no quick actions shown, provide a message or alternative */}
          {currentUser?.role === 'user' && (summaryItems.length > 0) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 md:col-span-2 lg:col-span-3">
              As a user, you can add swimmers and view all data. For other actions, please contact an administrator.
            </p>
          )}

        </div>
      </section>

      {currentUser?.role === 'admin' && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Admin Tools</h2>
            <Link
                to="/admin/users"
                className="text-primary hover:underline"
            >
                Manage Users
            </Link>
        </section>
      )}

      {currentUser?.role === 'admin' && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-red-200 dark:border-red-700">
          <h2 className="text-2xl font-semibold text-red-600 dark:text-red-400 mb-3">Data Management</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            This action will permanently delete all events, swimmers, and results from the application. This cannot be undone.
          </p>
          <button
            onClick={handleResetDataClick}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center disabled:opacity-50"
            aria-label="Reset All Application Data"
          >
            <DeleteIcon className="h-5 w-5 mr-2" />
            Reset All Application Data
          </button>
        </section>
      )}

      <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title="Confirm Data Reset">
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          <strong>Warning:</strong> You are about to delete ALL application data (events, swimmers, results). This action is irreversible.
        </p>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Are you absolutely sure you want to proceed?
        </p>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setIsResetModalOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmResetAllData}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
          >
            Confirm Reset
          </button>
        </div>
      </Modal>

    </div>
  );
};

export default DashboardPage;
