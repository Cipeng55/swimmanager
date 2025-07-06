import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { DeleteIcon } from '../components/icons/DeleteIcon';
import { ListOrderedIcon } from '../components/icons/ListOrderedIcon';
import { TrophyIcon } from '../components/icons/TrophyIcon';
import { SwimEvent } from '../types';
import { getEvents, deleteEvent as apiDeleteEvent } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<SwimEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [eventToDelete, setEventToDelete] = useState<SwimEvent | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get current user

  const fetchEventsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (err) {
      setError('Failed to load events. Please try again.');
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
        setError(`Failed to delete event: ${eventToDelete.name}.`);
        console.error(err);
      }
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading events..." />;
  }

  if (error && events.length === 0) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Swim Events</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Manage all upcoming and past swimming competitions.
          </p>
        </div>
        {currentUser?.role === 'admin' && (
          <Link
            to="/events/add"
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center"
            aria-label="Add New Event"
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            Add New Event
          </Link>
        )}
      </header>

      {error && <div className="mb-4 text-center py-2 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Event List</h2>
        {events.length === 0 && !loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No events found.</p>
            {currentUser?.role === 'admin' && <p>Click "Add New Event" to get started.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {events.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{event.name}</div>
                      {event.description && <div className="text-xs text-gray-500 dark:text-gray-400">{event.description}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(event.date).toLocaleDateString('id-ID')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{event.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 sm:space-x-2 flex items-center">
                      {currentUser?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => navigate(`/events/${event.id}/program`)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`View program for ${event.name}`}
                            title="Open Program & Heat Sheets (Admin)"
                          >
                            <ListOrderedIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => navigate(`/events/${event.id}/results-book`)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            aria-label={`View results book for ${event.name}`}
                            title="Open Results Book (Admin)"
                          >
                            <TrophyIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => navigate(`/events/edit/${event.id}`)}
                            className="text-primary-dark hover:text-primary p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                            aria-label={`Edit ${event.name}`}
                             title="Edit Event"
                          >
                            <EditIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(event)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label={`Delete ${event.name}`}
                            title="Delete Event"
                          >
                            <DeleteIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {/* If user role has no specific actions here, this area will be empty for them */}
                       {currentUser?.role !== 'admin' && (
                        <span className="text-xs text-gray-400 italic">View details via Club Starting List</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {currentUser?.role === 'admin' && (
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete the event "{eventToDelete?.name}"? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EventsPage;