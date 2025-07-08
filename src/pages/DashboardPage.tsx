import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DashboardSummaryItemData, SwimEvent } from '../types';
import SummaryCard from '../components/common/SummaryCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClipboardListIcon } from '../components/icons/ClipboardListIcon';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import { ListOrderedIcon } from '../components/icons/ListOrderedIcon';
import { TrophyIcon } from '../components/icons/TrophyIcon';
import { getEvents, getSwimmers, getResults } from '../services/api'; 
import { useAuth } from '../contexts/AuthContext';

const DashboardPage: React.FC = () => {
  const [summaryItems, setSummaryItems] = useState<DashboardSummaryItemData[]>([]);
  const [authorizedEvents, setAuthorizedEvents] = useState<SwimEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedMsg, setUnauthorizedMsg] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const location = useLocation();

  const fetchDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const [events, swimmers, results] = await Promise.all([
        getEvents(),
        getSwimmers(),
        getResults()
      ]);

      if (currentUser.role === 'user') {
        setAuthorizedEvents(events);
      }

      const allItems: DashboardSummaryItemData[] = [
        {
          id: 'events',
          title: 'Total Events',
          value: events.length,
          icon: <CalendarIcon className="h-8 w-8 text-primary" />,
          description: 'Manage all available competitions.',
          linkTo: '/events',
        },
        {
          id: 'swimmers',
          title: 'Registered Swimmers',
          value: swimmers.length,
          icon: <UsersIcon className="h-8 w-8 text-primary" />,
          description: 'Manage your club\'s swimmer profiles.',
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
      ];
      
      let itemsToShow = allItems;
      if (currentUser.role === 'user') {
        itemsToShow = allItems.filter(item => item.id !== 'events');
      }
      setSummaryItems(itemsToShow);

    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      setError("Could not load dashboard summary. Please try again. Error: " + err.message);
      setSummaryItems([]);
      setAuthorizedEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
        fetchDashboardData();
    }
    if (location.state?.unauthorized) {
      setUnauthorizedMsg("You are not authorized to access the requested page.");
      window.history.replaceState({}, document.title)
    }
  }, [location.state, currentUser]);

  return (
    <div className="fade-in-effect container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Welcome, {currentUser?.username || 'Guest'} to your dashboard.
        </p>
      </header>

      {unauthorizedMsg && <div className="mb-4 p-3 text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-700 rounded-md">{unauthorizedMsg}</div>}
      {error && <div className="mb-4 p-3 text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-700 rounded-md">{error}</div>}
      
      {loading ? ( 
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
          {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
            <Link
              to="/events/add"
              className="bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center text-center"
            >
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              Create New Event
            </Link>
          )}
          {currentUser?.role === 'user' && (
            <>
              <Link
                to="/swimmers/add"
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center text-center"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add New Swimmer
              </Link>
              <Link
                to="/results/add"
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center text-center"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add Seed Times
              </Link>
            </>
          )}
        </div>
      </section>

      {currentUser?.role === 'user' && (
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">My Events</h2>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl">
            {loading ? (
              <LoadingSpinner text="Loading your events..." />
            ) : authorizedEvents.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {authorizedEvents.map(event => (
                  <div key={event.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md transition-colors">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{event.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(event.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })} &bull; {event.location}
                      </p>
                    </div>
                    <div className="flex space-x-2 mt-3 sm:mt-0">
                      <Link
                        to={`/events/${event.id}/program`}
                        className="flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/70 font-semibold py-2 px-3 rounded-lg shadow-sm transition-all duration-200"
                        title="Open Program & Heat Sheets"
                      >
                        <ListOrderedIcon className="h-5 w-5" />
                        <span>Program</span>
                      </Link>
                      <Link
                        to={`/events/${event.id}/results-book`}
                        className="flex items-center space-x-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/70 font-semibold py-2 px-3 rounded-lg shadow-sm transition-all duration-200"
                        title="Open Results Book"
                      >
                        <TrophyIcon className="h-5 w-5" />
                        <span>Results</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                <p>You have not been authorized for any events yet.</p>
                <p className="text-sm">Please contact an event organizer.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {currentUser?.role === 'superadmin' && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-3">Superadmin Tools</h2>
            <Link
                to="/users/manage"
                className="text-primary hover:underline"
            >
                Manage All Accounts
            </Link>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;