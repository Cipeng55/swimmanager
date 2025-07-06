
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { DeleteIcon } from '../components/icons/DeleteIcon';
import { SwimResult, Swimmer, SwimEvent, SelectOption } from '../types';
import { getResults, deleteResult as apiDeleteResult, getSwimmers, getEvents } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import FormField from '../components/common/FormField';
import { useAuth } from '../contexts/AuthContext'; 

const ResultsPage: React.FC = () => {
  const [results, setResults] = useState<SwimResult[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [events, setEvents] = useState<SwimEvent[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [resultToDelete, setResultToDelete] = useState<SwimResult | null>(null);
  
  const [filterSwimmerId, setFilterSwimmerId] = useState<string>('');
  const [filterEventId, setFilterEventId] = useState<string>('');

  const navigate = useNavigate();
  const { currentUser } = useAuth(); 

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [resultsData, swimmersData, eventsData] = await Promise.all([
          getResults(),
          getSwimmers(),
          getEvents(),
        ]);
        setResults(resultsData);
        setSwimmers(swimmersData);
        setEvents(eventsData);
      } catch (err: any) {
        setError('Failed to load data. Please try again. ' + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDeleteClick = (result: SwimResult) => {
    setResultToDelete(result);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (resultToDelete) {
      try {
        await apiDeleteResult(resultToDelete.id);
        setResults(prevResults => prevResults.filter(r => r.id !== resultToDelete.id));
        setIsDeleteModalOpen(false);
        setResultToDelete(null);
      } catch (err: any) {
        setError(`Failed to delete result ID: ${resultToDelete.id}. ${err.message}`);
        console.error(err);
      }
    }
  };

  const getSwimmerName = (swimmerId: string): string => swimmers.find(s => s.id === swimmerId)?.name || 'Unknown Swimmer';
  const getEventName = (eventId: string): string => events.find(e => e.id === eventId)?.name || 'Unknown Event';

  const swimmerOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'All Swimmers' },
    ...swimmers.map(s => ({ value: s.id, label: s.name }))
  ], [swimmers]);

  const eventOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'All Events' },
    ...events.map(e => ({ value: e.id, label: e.name }))
  ], [events]);

  const filteredResults = useMemo(() => {
    return results.filter(result => {
      const swimmerMatch = filterSwimmerId ? result.swimmerId === filterSwimmerId : true;
      const eventMatch = filterEventId ? result.eventId === filterEventId : true;
      return swimmerMatch && eventMatch;
    });
  }, [results, filterSwimmerId, filterEventId]);


  if (loading) {
    return <LoadingSpinner text="Loading results..." />;
  }

  if (error && results.length === 0 && swimmers.length === 0 && events.length === 0) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  }

  const canManageResult = (result: SwimResult): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    
    // An admin can manage results for events they created.
    if (currentUser.role === 'admin') {
      const resultEvent = events.find(e => e.id === result.eventId);
      return !!resultEvent && resultEvent.createdByAdminId === currentUser.id;
    }
    
    // A user can manage results they created
    if (currentUser.role === 'user' && result.createdByUserId === currentUser.id) return true;

    return false;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Swim Results</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Browse all recorded swim times.
          </p>
        </div>
        {(currentUser?.role === 'user' || currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
          <Link
            to="/results/add"
            className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center self-start sm:self-auto"
            aria-label="Add New Result"
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            Add Seed Times
          </Link>
        )}
      </header>

      {error && <div className="mb-4 text-center py-2 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}
      
      <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl mb-8">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Filter by Swimmer"
            id="filterSwimmerId"
            name="filterSwimmerId"
            type="select"
            options={swimmerOptions}
            value={filterSwimmerId}
            onChange={(e) => setFilterSwimmerId(e.target.value)}
            containerClassName="mb-0"
          />
          <FormField
            label="Filter by Event"
            id="filterEventId"
            name="filterEventId"
            type="select"
            options={eventOptions}
            value={filterEventId}
            onChange={(e) => setFilterEventId(e.target.value)}
            containerClassName="mb-0"
          />
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Result List</h2>
        {filteredResults.length === 0 && !loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No results found for the current filters.</p>
            {results.length > 0 && <p>Try adjusting the filters or add new results.</p>}
            {results.length === 0 && currentUser?.role !== 'admin' && <p>Click "Add Seed Times" to record one.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Swimmer</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Event</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Style</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Distance</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Final Time</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredResults.map(result => (
                  <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{getSwimmerName(result.swimmerId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getEventName(result.eventId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.style}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.distance}m</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{result.time || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(result.dateRecorded).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                      {canManageResult(result) ? (
                        <>
                          <button
                            onClick={() => navigate(`/results/edit/${result.id}`)}
                            className="text-primary-dark hover:text-primary p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                            aria-label={`Edit result for ${getSwimmerName(result.swimmerId)}`}
                            title="Edit Result"
                          >
                            <EditIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(result)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label={`Delete result for ${getSwimmerName(result.swimmerId)}`}
                            title="Delete Result"
                          >
                            <DeleteIcon className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                         <span className="text-xs text-gray-400 italic">No permission</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete Modal is only shown if the user could trigger delete */}
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete this result? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md">Cancel</button>
            <button type="button" onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">Delete</button>
          </div>
        </Modal>
    </div>
  );
};

export default ResultsPage;
