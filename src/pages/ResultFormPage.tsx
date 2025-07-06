

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NewSwimResult, SwimResult, Swimmer, SwimEvent, SelectOption, RaceTypeSelection } from '../types';
import { addResult, getResultById, updateResult, getSwimmers, getEvents, getResults } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircleIcon } from '../components/icons/CheckCircleIcon'; // For visual indicator

// Define common race types
const predefinedRaceTypes: RaceTypeSelection[] = [
  { id: 'fs25', label: '25m Freestyle', style: 'Freestyle', distance: 25 },
  { id: 'fs50', label: '50m Freestyle', style: 'Freestyle', distance: 50 },
  { id: 'fs100', label: '100m Freestyle', style: 'Freestyle', distance: 100 },
  { id: 'fs200', label: '200m Freestyle', style: 'Freestyle', distance: 200 },
  { id: 'bf25', label: '25m Butterfly', style: 'Butterfly', distance: 25 },
  { id: 'bf50', label: '50m Butterfly', style: 'Butterfly', distance: 50 },
  { id: 'bf100', label: '100m Butterfly', style: 'Butterfly', distance: 100 },
  { id: 'bk25', label: '25m Backstroke', style: 'Backstroke', distance: 25 },
  { id: 'bk50', label: '50m Backstroke', style: 'Backstroke', distance: 50 },
  { id: 'bk100', label: '100m Backstroke', style: 'Backstroke', distance: 100 },
  { id: 'br25', label: '25m Breaststroke', style: 'Breaststroke', distance: 25 },
  { id: 'br50', label: '50m Breaststroke', style: 'Breaststroke', distance: 50 },
  { id: 'br100', label: '100m Breaststroke', style: 'Breaststroke', distance: 100 },
  { id: 'im100', label: '100m Individual Medley', style: 'IM', distance: 100 },
  { id: 'im200', label: '200m Individual Medley', style: 'IM', distance: 200 },
  // New Kick Events
  { id: 'kfs25', label: '25m Kick Freestyle', style: 'Kick Freestyle', distance: 25 },
  { id: 'kbf25', label: '25m Kick Butterfly', style: 'Kick Butterfly', distance: 25 },
  { id: 'kbr25', label: '25m Kick Breaststroke', style: 'Kick Breaststroke', distance: 25 },
  { id: 'kfs50', label: '50m Kick Freestyle', style: 'Kick Freestyle', distance: 50 },
  { id: 'kbf50', label: '50m Kick Butterfly', style: 'Kick Butterfly', distance: 50 },
  { id: 'kbr50', label: '50m Kick Breaststroke', style: 'Kick Breaststroke', distance: 50 },
  // New Relay Events
  { id: 'fsr4x50', label: '4x50m Freestyle Relay', style: 'Freestyle Relay', distance: 200 },
  { id: 'imr4x50', label: '4x50m Medley Relay', style: 'Medley Relay', distance: 200 },
];

// Enhanced state for race entries in Add mode
interface RaceEntryState {
  selectedForSubmission: boolean; // Checkbox: "I want to submit a seed time for this race NOW"
  inputValue: string;          // Text input: "This is the seed time I'm entering NOW"
  isAlreadyRegistered: boolean;  // Is there an existing SwimResult for this swimmer/event/race?
  existingSeedTimeDisplay: string | null; // If registered, what's the current seed time?
  existingResultId?: number; // ID of the existing SwimResult record
}

const ResultFormPage: React.FC = () => {
  const { resultId } = useParams<{ resultId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(resultId);
  const { currentUser } = useAuth();

  const [raceEntries, setRaceEntries] = useState<Record<string, RaceEntryState>>({});

  const [resultData, setResultData] = useState<Partial<Omit<NewSwimResult, 'style'|'distance'|'time'> & {selectedRaceTypeId?: string} | Omit<SwimResult, 'style'|'distance'|'time'> & {selectedRaceTypeId?: string} >>({
    swimmerId: undefined,
    eventId: undefined,
    selectedRaceTypeId: undefined, 
    seedTime: '', 
    dateRecorded: new Date().toISOString().split('T')[0],
    remarks: '',
  });
  
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([]);
  const [allResults, setAllResults] = useState<SwimResult[]>([]); // Store all results
  const [events, setEvents] = useState<SwimEvent[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewSwimResult | 'selectedRaceTypeId' | 'raceEntries', string | undefined>>>({});
  const [isUnauthorizedEdit, setIsUnauthorizedEdit] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<{ successes: number, failures: number, messages: string[] } | null>(null);


  useEffect(() => {
    const fetchRelatedData = async () => {
      setLoading(true);
      setError(null);
      setIsUnauthorizedEdit(false);
      try {
        const [swimmersData, eventsData, resultsData] = await Promise.all([ // Fetch allResults here
          getSwimmers(),
          getEvents(),
          getResults(), 
        ]);
        setAllSwimmers(swimmersData);
        setEvents(eventsData);
        setAllResults(resultsData); // Store all results

        if (isEditing && resultId) {
          const result = resultsData.find(r => r.id === parseInt(resultId)); // Find from allResults
          if (result) {
            if (currentUser?.role === 'user' && result.createdByUserId !== currentUser.id) {
              setError('You are not authorized to edit this result.');
              setIsUnauthorizedEdit(true);
            }
            const raceType = predefinedRaceTypes.find(rt => rt.style === result.style && rt.distance === result.distance);
            setResultData({
                swimmerId: result.swimmerId,
                eventId: result.eventId,
                selectedRaceTypeId: raceType?.id,
                seedTime: result.seedTime === "99:99.99" ? "" : result.seedTime || '',
                dateRecorded: result.dateRecorded.split('T')[0],
                remarks: result.remarks || '',
                // @ts-ignore
                id: result.id, 
                // @ts-ignore
                createdByUserId: result.createdByUserId
            });
          } else {
            setError('Result not found.');
          }
        } else if (!isEditing) { 
          let defaultSwimmerId: number | undefined = undefined;
          if (currentUser?.role === 'user') {
            const ownedSwimmers = swimmersData.filter(s => s.createdByUserId === currentUser.id);
            if (ownedSwimmers.length > 0) defaultSwimmerId = ownedSwimmers[0].id;
          } else if (swimmersData.length > 0) {
             defaultSwimmerId = swimmersData[0].id;
          }
          setResultData(prev => ({
            ...prev,
            swimmerId: prev.swimmerId ?? defaultSwimmerId,
            eventId: prev.eventId ?? (eventsData.length > 0 ? eventsData[0].id : undefined),
            dateRecorded: new Date().toISOString().split('T')[0],
          }));
          // raceEntries will be initialized by the next useEffect based on swimmer/event
        }

      } catch (err) {
        console.error(err);
        setError('Failed to load necessary data.');
      } finally {
        setLoading(false);
      }
    };
    fetchRelatedData();
  }, [resultId, isEditing, currentUser]);


  // Effect to initialize/update raceEntries for ADD mode based on selected swimmer/event
  useEffect(() => {
    if (isEditing || loading) return; // Only for Add mode and after initial data load

    const currentSwimmerId = resultData.swimmerId;
    const currentEventId = resultData.eventId;
    const newRaceEntries: Record<string, RaceEntryState> = {};

    for (const raceType of predefinedRaceTypes) {
      let existingResultForRace: SwimResult | undefined = undefined;
      if (currentSwimmerId && currentEventId) {
        existingResultForRace = allResults.find(
          (r) =>
            r.swimmerId === currentSwimmerId &&
            r.eventId === currentEventId &&
            r.style === raceType.style &&
            r.distance === raceType.distance
        );
      }
      
      let seedTimeToDisplay: string | null = null;
      if (existingResultForRace?.seedTime && existingResultForRace.seedTime !== "99:99.99") {
        seedTimeToDisplay = existingResultForRace.seedTime;
      }


      newRaceEntries[raceType.id] = {
        selectedForSubmission: false,
        inputValue: '', 
        isAlreadyRegistered: !!existingResultForRace,
        existingSeedTimeDisplay: seedTimeToDisplay,
        existingResultId: existingResultForRace?.id,
      };
    }
    setRaceEntries(newRaceEntries);
    if (formErrors.raceEntries) {
        setFormErrors(prev => ({...prev, raceEntries: undefined}));
    }
  }, [resultData.swimmerId, resultData.eventId, allResults, isEditing, loading]);


  const swimmerOptions: SelectOption[] = useMemo(() => {
    if (currentUser?.role === 'user') {
      return allSwimmers
        .filter(s => s.createdByUserId === currentUser.id)
        .map(s => ({ value: s.id, label: s.name }));
    }
    return allSwimmers.map(s => ({ value: s.id, label: s.name }));
  }, [allSwimmers, currentUser]);

  const eventOptions: SelectOption[] = useMemo(() => 
    events.map(e => ({ value: e.id, label: `${e.name} (${new Date(e.date).toLocaleDateString('id-ID')})` })), 
  [events]);

  const validateTimeFormat = (timeValue: string | undefined): boolean => {
    if (!timeValue) return true; 
    return /^\d{2}:\d{2}\.\d{2}$/.test(timeValue);
  }

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewSwimResult | 'selectedRaceTypeId' | 'raceEntries', string | undefined>> = {};
    if (!resultData.swimmerId) errors.swimmerId = 'Swimmer is required.';
    if (!resultData.eventId) errors.eventId = 'Event is required.';

    if (isEditing) {
      if (!resultData.selectedRaceTypeId) errors.selectedRaceTypeId = 'Race type is required for editing.';
      if (resultData.seedTime && !validateTimeFormat(resultData.seedTime)) {
        errors.seedTime = 'Seed Time must be in MM:SS.ss format (e.g., 01:23.45).';
      }
    } else { // Adding mode
      const hasSelectedNewEntries = Object.values(raceEntries).some(entry => entry.selectedForSubmission && !entry.isAlreadyRegistered);
      if (!hasSelectedNewEntries) {
        errors.raceEntries = 'Select at least one new race to enter a seed time for.';
      } else {
        Object.entries(raceEntries).forEach(([raceId, entry]) => {
          if (entry.selectedForSubmission && !entry.isAlreadyRegistered && entry.inputValue && !validateTimeFormat(entry.inputValue)) {
             if (!errors.raceEntries) errors.raceEntries = '';
             errors.raceEntries += `Invalid seed time format for ${predefinedRaceTypes.find(rt=>rt.id === raceId)?.label}. `;
          }
        });
      }
    }
    
    if (currentUser?.role === 'admin' && !resultData.dateRecorded) errors.dateRecorded = 'Date recorded is required.';
    else if (currentUser?.role === 'admin' && resultData.dateRecorded && isNaN(new Date(resultData.dateRecorded).getTime())) errors.dateRecorded = 'Invalid date format.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCommonChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numValue = (name === 'swimmerId' || name === 'eventId') ? parseInt(value) : value;
    setResultData(prev => ({ ...prev, [name]: numValue }));
    if (formErrors[name as keyof NewSwimResult]) {
      setFormErrors(prev => ({...prev, [name]: undefined}));
    }
    // If swimmer or event changes, raceEntries will be rebuilt by its own useEffect.
    // No need to clear submissionStatus here, it's tied to the submit action.
  };

  const handleRaceEntryChange = (raceTypeId: string, field: 'selectedForSubmission' | 'inputValue', value: boolean | string) => {
    setRaceEntries(prev => ({
      ...prev,
      [raceTypeId]: {
        ...prev[raceTypeId],
        [field]: value,
      }
    }));
    if (formErrors.raceEntries) {
      setFormErrors(prev => ({...prev, raceEntries: undefined}));
    }
  };
  
  const handleEditRaceTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    setResultData(prev => ({ ...prev, selectedRaceTypeId: e.target.value, seedTime: prev.seedTime || '' }));
    if (formErrors.selectedRaceTypeId) {
      setFormErrors(prev => ({...prev, selectedRaceTypeId: undefined}));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionStatus(null);
    if (isUnauthorizedEdit) {
        setError("Submission denied: You are not authorized to edit this result.");
        return;
    }
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);

    const finalDateRecorded = (currentUser?.role === 'admin' && resultData.dateRecorded)
      ? new Date(resultData.dateRecorded).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]; 

    try {
      if (isEditing && 'id' in resultData && resultData.id) {
        const selectedRaceForEdit = predefinedRaceTypes.find(rt => rt.id === resultData.selectedRaceTypeId);
        if (!resultData.swimmerId || !resultData.eventId || !selectedRaceForEdit) {
          setError("Swimmer, Event, or Race Type is missing for edit.");
          setLoading(false);
          return;
        }
        const finalSeedTime = resultData.seedTime?.trim() ? resultData.seedTime.trim() : "99:99.99";
        const payload: Partial<Omit<SwimResult, 'id' | 'createdByUserId' | 'time'>> = {
          swimmerId: resultData.swimmerId,
          eventId: resultData.eventId,
          style: selectedRaceForEdit.style,
          distance: Number(selectedRaceForEdit.distance),
          seedTime: finalSeedTime,
          dateRecorded: finalDateRecorded, 
          remarks: resultData.remarks?.trim() || undefined,
        };
        // @ts-ignore
        await updateResult(resultData.id, payload);
        setSubmissionStatus({ successes: 1, failures: 0, messages: ["Result updated successfully."] });
        setTimeout(() => navigate('/results'), 1000);

      } else { // --- ADDING MODE ---
        if (!resultData.swimmerId || !resultData.eventId) {
            setError("Swimmer or Event is missing for adding results.");
            setLoading(false);
            return;
        }
        let successes = 0;
        let failures = 0;
        const messages: string[] = [];

        for (const raceTypeId in raceEntries) {
          const entry = raceEntries[raceTypeId];
          const raceType = predefinedRaceTypes.find(rt => rt.id === raceTypeId);

          if (entry.selectedForSubmission && !entry.isAlreadyRegistered && raceType) {
            const finalSeedTime = entry.inputValue.trim() ? entry.inputValue.trim() : "99:99.99";
            const payload: NewSwimResult = {
              swimmerId: resultData.swimmerId,
              eventId: resultData.eventId,
              style: raceType.style,
              distance: Number(raceType.distance),
              seedTime: finalSeedTime,
              dateRecorded: finalDateRecorded,
              remarks: resultData.remarks?.trim() || undefined,
            };
            try {
              await addResult(payload);
              successes++;
              messages.push(`Added ${raceType.label}.`);
            } catch (addErr: any) {
              failures++;
              messages.push(`Failed to add ${raceType.label}: ${addErr.message || 'Unknown error'}`);
              console.error(`Failed to add ${raceType.label}`, addErr);
            }
          }
        }
        setSubmissionStatus({ successes, failures, messages });
        if (successes > 0 && failures === 0) {
            setTimeout(() => {
              // Re-fetch allResults to include new ones before navigating or resetting form
              getResults().then(updatedResults => {
                setAllResults(updatedResults); 
                // Optionally navigate or reset form more gracefully
                navigate('/results');
              });
            }, messages.length > 1 ? 2000 : 1000);
        } else if (failures > 0) {
            setError(`Some results could not be added. See details below.`);
            // After partial failure, update raceEntries to reflect successful additions
            getResults().then(updatedResults => setAllResults(updatedResults));
        } else if (successes === 0 && failures === 0){
             setError(`No new races were selected to add, or all selected races were already registered.`);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError((isEditing ? 'Failed to update result: ' : 'Failed to add results: ') + (err.message || 'Unknown error'));
      setSubmissionStatus({ successes: 0, failures: (isEditing ? 1 : Object.values(raceEntries).filter(e=>e.selectedForSubmission && !e.isAlreadyRegistered).length || 1), messages: [err.message || 'Unknown error'] });
    } finally {
      setLoading(false);
    }
  };

  if (loading && ((isEditing && !resultData.swimmerId) || (!isEditing && (allSwimmers.length === 0 || events.length === 0 || allResults.length === 0)) ) ) {
     return <LoadingSpinner text="Loading form data..." />;
  }
  
  const noSwimmersForUserAddMode = !isEditing && currentUser?.role === 'user' && swimmerOptions.length === 0 && allSwimmers.length > 0;
  const noSwimmersAvailableAddMode = !isEditing && allSwimmers.length === 0;
  const noEventsAvailableAddMode = !isEditing && events.length === 0;

  if ((noSwimmersForUserAddMode || noSwimmersAvailableAddMode || noEventsAvailableAddMode) && !loading && !error ) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-4">Cannot Add Result(s)</h1>
        {noSwimmersAvailableAddMode && <p className="text-gray-600 dark:text-gray-300 mb-2">There are no swimmers available. Please <Link to="/swimmers/add" className="text-primary hover:underline">add a swimmer</Link> first.</p>}
        {noSwimmersForUserAddMode && <p className="text-gray-600 dark:text-gray-300 mb-2">You have not created any swimmers yet. Please <Link to="/swimmers/add" className="text-primary hover:underline">add a swimmer</Link> you own before adding results.</p>}
        {noEventsAvailableAddMode && <p className="text-gray-600 dark:text-gray-300 mb-2">There are no events available. Please ask an admin to <Link to="/events/add" className="text-primary hover:underline">add an event</Link> first.</p>}
         <Link to="/results" className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md">
            Back to Results
          </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {isEditing ? 'Edit Seed Result' : 'Add Seed Result(s)'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isEditing 
            ? "Final times are entered from the Event Program page by Admins."
            : "View existing entries and add new seed times. Final times are set on the Event Program page."}
        </p>
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}
      {submissionStatus && (
        <div className={`mb-4 p-3 rounded-md ${submissionStatus.failures > 0 ? 'bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-200' : 'bg-green-100 dark:bg-green-700 text-green-700 dark:text-green-200'}`}>
          <p className="font-semibold">Submission Summary:</p>
          <p>Successful: {submissionStatus.successes}, Failed: {submissionStatus.failures}</p>
          {submissionStatus.messages.length > 0 && (
            <ul className="list-disc list-inside text-sm mt-1 max-h-20 overflow-y-auto">
              {submissionStatus.messages.map((msg, idx) => <li key={idx}>{msg}</li>)}
            </ul>
          )}
        </div>
      )}


      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
            label="Swimmer"
            id="swimmerId"
            name="swimmerId"
            type="select"
            options={swimmerOptions}
            value={resultData.swimmerId || ''}
            onChange={handleCommonChange}
            error={formErrors.swimmerId}
            required
            disabled={loading || swimmerOptions.length === 0 || isUnauthorizedEdit}
            placeholder={swimmerOptions.length === 0 ? (currentUser?.role === 'user' ? "No swimmers you created" : "No swimmers available") : "Select a swimmer"}
            />
            <FormField
            label="Event"
            id="eventId"
            name="eventId"
            type="select"
            options={eventOptions}
            value={resultData.eventId || ''}
            onChange={handleCommonChange}
            error={formErrors.eventId}
            required
            disabled={loading || events.length === 0 || isUnauthorizedEdit}
            placeholder={events.length === 0 ? "No events available" : "Select an event"}
            />
        </div>

        {/* --- ADD MODE: Multiple Race Selection & Display --- */}
        {!isEditing && resultData.swimmerId && resultData.eventId && (
            <fieldset className="mt-4">
                <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Race(s) & Enter New Seed Times (MM:SS.ss)</legend>
                {formErrors.raceEntries && <p className="text-xs text-red-600 dark:text-red-400 mb-1">{formErrors.raceEntries}</p>}
                <div className="space-y-3 p-3 border dark:border-gray-600 rounded-md max-h-96 overflow-y-auto">
                    {predefinedRaceTypes.map((raceType) => {
                        const entry = raceEntries[raceType.id];
                        if (!entry) return null; // Should not happen if raceEntries is initialized correctly
                        
                        return (
                        <div key={raceType.id} className={`flex items-center space-x-3 p-2 rounded ${entry.isAlreadyRegistered ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                            {entry.isAlreadyRegistered ? (
                                <span className="flex items-center text-green-600 dark:text-green-400" title="Already entered for this swimmer in this event">
                                    <CheckCircleIcon className="h-5 w-5 mr-1" />
                                    <span className="text-sm">{raceType.label}</span>
                                </span>
                            ) : (
                                <input
                                id={`race-add-${raceType.id}`}
                                type="checkbox"
                                checked={entry.selectedForSubmission}
                                onChange={(e) => handleRaceEntryChange(raceType.id, 'selectedForSubmission', e.target.checked)}
                                disabled={loading || isUnauthorizedEdit}
                                className="focus:ring-primary h-4 w-4 text-primary border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:checked:bg-primary rounded"
                                />
                            )}
                            {!entry.isAlreadyRegistered && (
                               <label htmlFor={`race-add-${raceType.id}`} className="flex-1 text-sm text-gray-700 dark:text-gray-300 min-w-[150px] sm:min-w-[180px]">
                                    {raceType.label}
                                </label>
                            )}
                            
                            {entry.isAlreadyRegistered ? (
                                <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                                    Seed: {entry.existingSeedTimeDisplay || "N/A"}
                                </span>
                            ) : (
                                <input
                                type="text"
                                placeholder="00:25.10"
                                value={entry.inputValue}
                                onChange={(e) => handleRaceEntryChange(raceType.id, 'inputValue', e.target.value)}
                                disabled={loading || isUnauthorizedEdit || !entry.selectedForSubmission}
                                maxLength={8}
                                className={`w-28 sm:w-32 px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-primary focus:border-primary ${!entry.selectedForSubmission ? 'bg-gray-100 dark:bg-gray-600 opacity-50' : 'bg-white dark:bg-gray-700'}`}
                                />
                            )}
                        </div>
                        );
                    })}
                </div>
            </fieldset>
        )}
        {!isEditing && (!resultData.swimmerId || !resultData.eventId) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Please select a swimmer and an event to see available races and existing entries.</p>
        )}


        {/* --- EDIT MODE: Single Race Selection --- */}
        {isEditing && (
            <fieldset className="mt-4">
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Race Type (Editing)</legend>
            {formErrors.selectedRaceTypeId && <p className="text-xs text-red-600 dark:text-red-400 mb-1">{formErrors.selectedRaceTypeId}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 max-h-48 overflow-y-auto p-2 border dark:border-gray-600 rounded-md">
                {predefinedRaceTypes.map((raceType) => (
                <div key={`race-edit-${raceType.id}`} className="flex items-center">
                    <input
                    id={`race-edit-${raceType.id}`}
                    name="selectedRaceTypeId" 
                    type="radio"
                    value={raceType.id}
                    checked={resultData.selectedRaceTypeId === raceType.id}
                    onChange={handleEditRaceTypeChange}
                    disabled={loading || isUnauthorizedEdit}
                    className="focus:ring-primary h-4 w-4 text-primary border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:checked:bg-primary"
                    />
                    <label htmlFor={`race-edit-${raceType.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    {raceType.label}
                    </label>
                </div>
                ))}
            </div>
            </fieldset>
        )}
        
        {isEditing && (
            <FormField
            label="Seed Time (MM:SS.ss)"
            id="seedTimeEdit" 
            name="seedTime"     
            type="text" 
            placeholder="e.g., 01:25.10 (Default: 99:99.99)"
            value={resultData.seedTime || ''}
            onChange={handleCommonChange} 
            error={formErrors.seedTime}
            disabled={loading || isUnauthorizedEdit}
            maxLength={8}
            />
        )}
        
        <FormField
          label="Remarks (Optional)"
          id="remarks"
          name="remarks"
          type="textarea"
          placeholder="e.g., Personal Best (Applies to all selected races if adding multiple)"
          value={resultData.remarks || ''}
          onChange={handleCommonChange}
          disabled={loading || isUnauthorizedEdit}
        />

        {currentUser?.role === 'admin' && (
            <FormField
            label="Date Recorded"
            id="dateRecorded"
            name="dateRecorded"
            type="date"
            value={resultData.dateRecorded?.split('T')[0] || ''}
            onChange={handleCommonChange}
            error={formErrors.dateRecorded}
            required
            disabled={loading || isUnauthorizedEdit}
            />
        )}
        
        <div className="flex items-center justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <Link 
            to="/results"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || (currentUser?.role === 'user' && swimmerOptions.length === 0) || events.length === 0 || isUnauthorizedEdit || (!isEditing && (!resultData.swimmerId || !resultData.eventId))}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center"
          >
            {loading && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            {isEditing ? 'Save Seed/Remarks' : 'Add Seed Result(s)'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResultFormPage;