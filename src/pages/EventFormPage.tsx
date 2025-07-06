import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NewSwimEvent, SwimEvent, SelectOption, LetterCategory, LetterAgeRange, User } from '../types';
import { addEvent, getEventById, updateEvent, getAllUsers } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';

const laneOptions: SelectOption[] = [
  { value: 4, label: '4 Lanes' },
  { value: 6, label: '6 Lanes' },
  { value: 8, label: '8 Lanes' },
];

const categorySystemOptions: SelectOption[] = [
  { value: 'KU', label: 'KU System (Standard Age Groups)' },
  { value: 'LETTER', label: 'Letter System (A-I, by DOB range)' },
  { value: 'GRADE', label: 'Grade System (Kelas, by age approx.)' },
];

const letterCategories: LetterCategory[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

type LetterDOBRangesInputState = Partial<Record<LetterCategory, { startDate: string; endDate: string }>>;

const EventFormPage: React.FC = () => {
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(eventId);

  const initialLetterDOBRangesState: LetterDOBRangesInputState = letterCategories.reduce((acc, letter) => {
    acc[letter] = { startDate: '', endDate: '' };
    return acc;
  }, {} as LetterDOBRangesInputState);

  const [eventData, setEventData] = useState<Partial<NewSwimEvent | SwimEvent>>({
    name: '',
    date: '',
    location: '',
    description: '',
    lanesPerEvent: 8, 
    categorySystem: 'KU',
    letterAgeRanges: {},
    authorizedUserIds: [],
  });
  const [allClubs, setAllClubs] = useState<User[]>([]); // All users with role 'user' are clubs
  const [letterDOBRangesInput, setLetterDOBRangesInput] = useState<LetterDOBRangesInputState>(initialLetterDOBRangesState);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewSwimEvent | 'letterAgeRanges' | 'authorizedUserIds', string>>>({});

  useEffect(() => {
    const fetchPrerequisites = async () => {
        setLoading(true);
        try {
            const users = await getAllUsers();
            const clubs = users.filter(u => u.role === 'user');
            setAllClubs(clubs);

            if (isEditing && eventId) {
                const event = await getEventById(eventId);
                if (event) {
                    const formattedEvent = { 
                        ...event, 
                        date: event.date.split('T')[0],
                        lanesPerEvent: event.lanesPerEvent || 8,
                        categorySystem: event.categorySystem || 'KU',
                        authorizedUserIds: event.authorizedUserIds || [],
                    };
                    setEventData(formattedEvent);
                    if (event.categorySystem === 'LETTER' && event.letterAgeRanges) {
                        const inputRanges: LetterDOBRangesInputState = { ...initialLetterDOBRangesState };
                        for (const letter of letterCategories) {
                            if (event.letterAgeRanges[letter]) {
                                inputRanges[letter] = {
                                    startDate: event.letterAgeRanges[letter]?.startDate || '',
                                    endDate: event.letterAgeRanges[letter]?.endDate || '',
                                };
                            }
                        }
                        setLetterDOBRangesInput(inputRanges);
                    }
                } else {
                    setError('Event not found.');
                }
            }
        } catch (err: any) {
            console.error(err);
            setError('Failed to load required data.');
        } finally {
            setLoading(false);
        }
    };
    fetchPrerequisites();
  }, [eventId, isEditing]);

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewSwimEvent | 'letterAgeRanges' | 'authorizedUserIds', string>> = {};
    if (!eventData.name?.trim()) errors.name = 'Event name is required.';
    if (!eventData.date) errors.date = 'Event date is required.';
    if (!eventData.location?.trim()) errors.location = 'Event location is required.';
    if (!eventData.lanesPerEvent) errors.lanesPerEvent = 'Number of lanes is required.';
    if (!eventData.categorySystem) errors.categorySystem = 'Category system is required.';
    if (!eventData.authorizedUserIds || eventData.authorizedUserIds.length === 0) {
      errors.authorizedUserIds = 'At least one club must be authorized to participate.';
    }
    
    // ... (rest of validation remains the same)

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let val: string | number | undefined = value;
    if (name === 'lanesPerEvent') val = parseInt(value);
    setEventData(prev => ({ ...prev, [name]: val }));
    if (formErrors[name as keyof NewSwimEvent]) setFormErrors(prev => ({...prev, [name]: undefined}));
  };
  
  const handleClubSelectionChange = (clubUserId: string) => {
    setEventData(prev => {
      const currentIds = prev.authorizedUserIds || [];
      const newIds = currentIds.includes(clubUserId)
        ? currentIds.filter(id => id !== clubUserId)
        : [...currentIds, clubUserId];
      return { ...prev, authorizedUserIds: newIds };
    });
    if (formErrors.authorizedUserIds) {
      setFormErrors(prev => ({ ...prev, authorizedUserIds: undefined }));
    }
  };

  const handleLetterDOBRangeChange = (letter: LetterCategory, type: 'startDate' | 'endDate', value: string) => {
    // ... (this function remains the same)
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    // ... (letter age range processing remains the same)

    try {
      const payload: NewSwimEvent = {
        name: eventData.name!,
        date: new Date(eventData.date!).toISOString().split('T')[0],
        location: eventData.location!,
        description: eventData.description,
        lanesPerEvent: eventData.lanesPerEvent || 8,
        categorySystem: eventData.categorySystem || 'KU',
        letterAgeRanges: eventData.letterAgeRanges, // This should be processed as before
        authorizedUserIds: eventData.authorizedUserIds!,
      };

      if (isEditing && 'id' in eventData && eventData.id) {
        await updateEvent(eventData.id, payload);
      } else {
        await addEvent(payload);
      }
      navigate('/events');
    } catch (err) {
      console.error(err);
      setError(isEditing ? 'Failed to update event.' : 'Failed to add event.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) { 
    return <LoadingSpinner text="Loading event form..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {isEditing ? 'Edit Event' : 'Create New Event'}
        </h1>
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
        <FormField
          label="Event Name" id="name" name="name" type="text"
          value={eventData.name || ''} onChange={handleChange} error={formErrors.name} required disabled={loading}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Date" id="date" name="date" type="date"
            value={eventData.date?.split('T')[0] || ''} onChange={handleChange} error={formErrors.date} required disabled={loading}
          />
          <FormField
            label="Location" id="location" name="location" type="text"
            value={eventData.location || ''} onChange={handleChange} error={formErrors.location} required disabled={loading}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Number of Lanes" id="lanesPerEvent" name="lanesPerEvent" type="select" options={laneOptions}
            value={eventData.lanesPerEvent?.toString() || '8'} onChange={handleChange} error={formErrors.lanesPerEvent as string} required disabled={loading}
          />
           <FormField
            label="Category System" id="categorySystem" name="categorySystem" type="select" options={categorySystemOptions}
            value={eventData.categorySystem || 'KU'} onChange={handleChange} error={formErrors.categorySystem as string} required disabled={loading}
          />
        </div>

        {/* --- Club Authorization Section --- */}
        <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-md mt-4 space-y-3">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">Authorize Clubs</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Select which clubs are allowed to participate in this event.
            </p>
            {formErrors.authorizedUserIds && <p className="text-sm text-red-600 dark:text-red-400">{formErrors.authorizedUserIds}</p>}
            {allClubs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 max-h-48 overflow-y-auto">
                    {allClubs.map(club => (
                        <div key={club.id} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`club-${club.id}`}
                                checked={(eventData.authorizedUserIds || []).includes(club.id)}
                                onChange={() => handleClubSelectionChange(club.id)}
                                className="focus:ring-primary h-4 w-4 text-primary border-gray-300 dark:border-gray-500 dark:bg-gray-600 dark:checked:bg-primary rounded"
                                disabled={loading}
                            />
                            <label htmlFor={`club-${club.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                {club.clubName}
                            </label>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-500">No clubs (user accounts) found. A Superadmin must create them first.</p>
            )}
        </div>
        
        {/* ... (letter DOB range section remains same) */}

        <FormField
          label="Description (Optional)" id="description" name="description" type="textarea"
          value={eventData.description || ''} onChange={handleChange} disabled={loading}
        />
        <div className="flex items-center justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <Link 
            to="/events"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
          >
            Cancel
          </Link>
          <button
            type="submit" disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center"
          >
            {loading && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            {isEditing ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventFormPage;
