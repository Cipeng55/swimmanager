import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NewSwimEvent, SwimEvent, SelectOption, LetterCategory, LetterAgeRange, User } from '../types';
import { addEvent, getEventById, updateEvent, getAllUsers } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';

const laneOptions: SelectOption[] = [
  { value: 4, label: '4 Lanes' },
  { value: 5, label: '5 Lanes' },
  { value: 6, label: '6 Lanes' },
  { value: 8, label: '8 Lanes' },
];

const categorySystemOptions: SelectOption[] = [
  { value: 'KU', label: 'KU System (Standard Age Groups)' },
  { value: 'LETTER', label: 'Letter System (A-I, by DOB range)' },
  { value: 'GRADE', label: 'Grade System (Individual Grade)' },
  { value: 'SCHOOL_LEVEL', label: 'School Level System (Grouped Grade)' },
];

const courseTypeOptions: SelectOption[] = [
  { value: 'SCM', label: 'SCM (Short Course Meters - 25m)' },
  { value: 'LCM', label: 'LCM (Long Course Meters - 50m)' },
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
    courseType: 'SCM',
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
                        courseType: event.courseType || 'SCM',
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
    if (!eventData.courseType) errors.courseType = 'Course type is required.';
    
    // Validation for authorizedUserIds is removed as it's optional.
    
    if (eventData.categorySystem === 'LETTER') {
      let isAnyLetterRangeFilled = false;
      let hasError = false;
      for (const letter of letterCategories) {
        const range = letterDOBRangesInput[letter];
        if (range && (range.startDate || range.endDate)) {
          isAnyLetterRangeFilled = true;
          if (!range.startDate || !range.endDate) {
            errors.letterAgeRanges = `Both start and end date are required for Category ${letter}.`;
            hasError = true;
            break; 
          }
        }
      }
      if (!isAnyLetterRangeFilled) {
         errors.letterAgeRanges = 'At least one letter category date range must be defined for the Letter System.';
         hasError = true;
      }
      if (hasError) {
        setFormErrors(errors);
        return false;
      }
    }

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
    setLetterDOBRangesInput(prev => ({
      ...prev,
      [letter]: {
        ...prev[letter],
        [type]: value,
      },
    }));
    if (formErrors.letterAgeRanges) setFormErrors(prev => ({...prev, letterAgeRanges: undefined}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    let processedLetterAgeRanges: Partial<Record<LetterCategory, LetterAgeRange>> | undefined;
    if (eventData.categorySystem === 'LETTER') {
      processedLetterAgeRanges = {};
      for (const letter of letterCategories) {
        const range = letterDOBRangesInput[letter];
        if (range && range.startDate && range.endDate) {
          processedLetterAgeRanges[letter] = {
            startDate: range.startDate,
            endDate: range.endDate,
          };
        }
      }
    }

    try {
      const payload: NewSwimEvent = {
        name: eventData.name!,
        date: new Date(eventData.date!).toISOString().split('T')[0],
        location: eventData.location!,
        description: eventData.description,
        lanesPerEvent: eventData.lanesPerEvent || 8,
        courseType: eventData.courseType || 'SCM',
        categorySystem: eventData.categorySystem || 'KU',
        letterAgeRanges: processedLetterAgeRanges,
        authorizedUserIds: eventData.authorizedUserIds || [],
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

  if (loading && !eventData.name) { 
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
        
        <FormField
            label="Course Type" id="courseType" name="courseType" type="select" options={courseTypeOptions}
            value={eventData.courseType || 'SCM'} onChange={handleChange} error={formErrors.courseType as string} required disabled={loading}
        />

        {/* --- Club Authorization Section --- */}
        <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-md mt-4 space-y-3">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">Authorize Clubs (Optional)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Select which clubs can participate. If none are selected, only clubs created by you can join.
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
                <p className="text-sm text-gray-500 dark:text-gray-400">No clubs (user accounts) found. Please go to the <Link to="/users/manage" className="text-primary hover:underline">Manage Accounts</Link> page to create them.</p>
            )}
        </div>
        
        {eventData.categorySystem === 'LETTER' && (
          <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-md mt-4 space-y-3">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">Letter Category Date of Birth Ranges</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Define the DOB range for each letter category. Swimmers will be automatically assigned based on their DOB.</p>
            {formErrors.letterAgeRanges && <p className="text-sm text-red-600 dark:text-red-400">{formErrors.letterAgeRanges}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              {letterCategories.map(letter => (
                <div key={letter}>
                  <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Category {letter}</p>
                   <FormField
                      label="Start Date"
                      id={`start-date-${letter}`}
                      type="date"
                      value={letterDOBRangesInput[letter]?.startDate || ''}
                      onChange={(e) => handleLetterDOBRangeChange(letter, 'startDate', e.target.value)}
                      containerClassName="mb-2"
                      disabled={loading}
                    />
                    <FormField
                      label="End Date"
                      id={`end-date-${letter}`}
                      type="date"
                      value={letterDOBRangesInput[letter]?.endDate || ''}
                      onChange={(e) => handleLetterDOBRangeChange(letter, 'endDate', e.target.value)}
                       containerClassName="mb-0"
                       disabled={loading}
                    />
                </div>
              ))}
            </div>
          </div>
        )}

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