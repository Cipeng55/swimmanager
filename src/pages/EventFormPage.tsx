
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NewSwimEvent, SwimEvent, SelectOption, LetterCategory, LetterAgeRange } from '../types';
import { addEvent, getEventById, updateEvent } from '../services/api';
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
  });
  const [letterDOBRangesInput, setLetterDOBRangesInput] = useState<LetterDOBRangesInputState>(initialLetterDOBRangesState);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewSwimEvent | 'letterAgeRanges', string>>>({});


  useEffect(() => {
    if (isEditing && eventId) {
      setLoading(true);
      getEventById(parseInt(eventId))
        .then(event => {
          if (event) {
            const formattedEvent = { 
              ...event, 
              date: event.date.split('T')[0],
              lanesPerEvent: event.lanesPerEvent || 8,
              categorySystem: event.categorySystem || 'KU',
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
            } else {
              setLetterDOBRangesInput(initialLetterDOBRangesState);
            }
          } else {
            setError('Event not found.');
          }
        })
        .catch(err => {
          console.error(err);
          setError('Failed to load event data.');
        })
        .finally(() => setLoading(false));
    } else {
      if (eventData.categorySystem !== 'LETTER') {
        setLetterDOBRangesInput(initialLetterDOBRangesState);
      }
    }
  }, [eventId, isEditing]); // Removed eventData.categorySystem dependency to avoid loop, handled in handleChange

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewSwimEvent | 'letterAgeRanges', string>> = {};
    if (!eventData.name?.trim()) errors.name = 'Event name is required.';
    if (!eventData.date) errors.date = 'Event date is required.';
    if (!eventData.location?.trim()) errors.location = 'Event location is required.';
    if (!eventData.lanesPerEvent) errors.lanesPerEvent = 'Number of lanes is required.';
    if (!eventData.categorySystem) errors.categorySystem = 'Category system is required.';
    
    if (eventData.date) {
        const today = new Date();
        today.setHours(0,0,0,0); 
        const inputDate = new Date(eventData.date);
         if (isNaN(inputDate.getTime())) {
            errors.date = 'Invalid event date format.';
        }
    }

    if (eventData.categorySystem === 'LETTER') {
      let letterRangeErrorFound = false;
      let atLeastOneRangeDefined = false;

      for (const letter of letterCategories) {
        const startDateStr = letterDOBRangesInput[letter]?.startDate;
        const endDateStr = letterDOBRangesInput[letter]?.endDate;

        if (startDateStr && endDateStr) { // Both fields have some value
          atLeastOneRangeDefined = true;
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            errors.letterAgeRanges = `Invalid date format for letter ${letter}. Use YYYY-MM-DD.`;
            letterRangeErrorFound = true;
            break;
          }
          if (startDate > endDate) {
            errors.letterAgeRanges = `Start DOB cannot be after End DOB for letter ${letter}.`;
            letterRangeErrorFound = true;
            break;
          }
        } else if (startDateStr || endDateStr) { // Only one of the pair is filled
          errors.letterAgeRanges = `Both Start DOB and End DOB are required for letter ${letter} if one is entered.`;
          letterRangeErrorFound = true;
          break;
        }
      }
      if (!letterRangeErrorFound && !atLeastOneRangeDefined) {
        errors.letterAgeRanges = 'At least one DOB range (A-I) must be defined for the Letter System.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let val: string | number | undefined = value;

    if (name === 'lanesPerEvent') {
      val = parseInt(value);
    } else if (name === 'categorySystem') {
      val = value as SwimEvent['categorySystem'];
      if (val !== 'LETTER') {
        setLetterDOBRangesInput(initialLetterDOBRangesState); // Reset if not letter system
      }
    }
    
    setEventData(prev => ({ ...prev, [name]: val }));

    if (formErrors[name as keyof NewSwimEvent]) {
      setFormErrors(prev => ({...prev, [name]: undefined}));
    }
  };

  const handleLetterDOBRangeChange = (letter: LetterCategory, type: 'startDate' | 'endDate', value: string) => {
    setLetterDOBRangesInput(prev => ({
      ...prev,
      [letter]: {
        ...(prev[letter] || { startDate: '', endDate: '' }), // Ensure object exists
        [type]: value,
      }
    }));
     if (formErrors.letterAgeRanges) {
      setFormErrors(prev => ({...prev, letterAgeRanges: undefined}));
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    let finalLetterAgeRanges: SwimEvent['letterAgeRanges'] | undefined = undefined;
    if (eventData.categorySystem === 'LETTER') {
      const parsedRanges: Partial<Record<LetterCategory, LetterAgeRange>> = {};
      let atLeastOneValidRange = false;
      for (const letter of letterCategories) {
        const startDateStr = letterDOBRangesInput[letter]?.startDate;
        const endDateStr = letterDOBRangesInput[letter]?.endDate;

        if (startDateStr && endDateStr) { // Both must be present to be considered a valid range
          parsedRanges[letter] = { startDate: startDateStr, endDate: endDateStr };
          atLeastOneValidRange = true;
        }
      }
      if (atLeastOneValidRange) {
         finalLetterAgeRanges = parsedRanges;
      } else {
        // This case should be caught by validateForm, but as a safeguard.
        setError("For Letter System, at least one valid DOB range must be provided.");
        setLoading(false);
        return;
      }
    }


    try {
      const payload: NewSwimEvent = {
        name: eventData.name!,
        date: new Date(eventData.date!).toISOString().split('T')[0],
        location: eventData.location!,
        description: eventData.description,
        lanesPerEvent: eventData.lanesPerEvent || 8,
        categorySystem: eventData.categorySystem || 'KU',
        letterAgeRanges: finalLetterAgeRanges,
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

  if (loading && isEditing && !eventData.name) { 
    return <LoadingSpinner text="Loading event details..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {isEditing ? 'Edit Event' : 'Add New Event'}
        </h1>
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
        <FormField
          label="Event Name"
          id="name"
          name="name"
          type="text"
          value={eventData.name || ''}
          onChange={handleChange}
          error={formErrors.name}
          required
          disabled={loading}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Date"
            id="date"
            name="date"
            type="date"
            value={eventData.date?.split('T')[0] || ''}
            onChange={handleChange}
            error={formErrors.date}
            required
            disabled={loading}
          />
          <FormField
            label="Location"
            id="location"
            name="location"
            type="text"
            value={eventData.location || ''}
            onChange={handleChange}
            error={formErrors.location}
            required
            disabled={loading}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Number of Lanes"
            id="lanesPerEvent"
            name="lanesPerEvent"
            type="select"
            options={laneOptions}
            value={eventData.lanesPerEvent?.toString() || '8'}
            onChange={handleChange}
            error={formErrors.lanesPerEvent as string}
            required
            disabled={loading}
          />
           <FormField
            label="Category System"
            id="categorySystem"
            name="categorySystem"
            type="select"
            options={categorySystemOptions}
            value={eventData.categorySystem || 'KU'}
            onChange={handleChange}
            error={formErrors.categorySystem as string}
            required
            disabled={loading}
          />
        </div>

        {/* Custom DOB Ranges for Letter System */}
        {eventData.categorySystem === 'LETTER' && (
          <div className="p-4 border border-gray-300 dark:border-gray-600 rounded-md mt-4 space-y-3">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">Custom DOB Ranges for Letter Categories (A-I)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Define Start DOB and End DOB (inclusive) for each letter category. At least one range must be defined.
            </p>
            {formErrors.letterAgeRanges && <p className="text-sm text-red-600 dark:text-red-400">{formErrors.letterAgeRanges}</p>}
            
            {letterCategories.map(letter => (
              <div key={letter} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 sm:gap-4">
                <label htmlFor={`letter_${letter}_startDate`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-1">
                  Category {letter}:
                </label>
                <FormField
                  label="" 
                  id={`letter_${letter}_startDate`}
                  name={`letter_${letter}_startDate`}
                  type="date" 
                  placeholder="Start DOB (YYYY-MM-DD)"
                  value={letterDOBRangesInput[letter]?.startDate || ''}
                  onChange={(e) => handleLetterDOBRangeChange(letter, 'startDate', e.target.value)}
                  disabled={loading}
                  containerClassName="mb-0 sm:col-span-1"
                  className="py-1.5"
                />
                <FormField
                  label="" 
                  id={`letter_${letter}_endDate`}
                  name={`letter_${letter}_endDate`}
                  type="date"
                  placeholder="End DOB (YYYY-MM-DD)"
                  value={letterDOBRangesInput[letter]?.endDate || ''}
                  onChange={(e) => handleLetterDOBRangeChange(letter, 'endDate', e.target.value)}
                  disabled={loading}
                  containerClassName="mb-0 sm:col-span-1"
                  className="py-1.5"
                />
              </div>
            ))}
          </div>
        )}

        <FormField
          label="Description (Optional)"
          id="description"
          name="description"
          type="textarea"
          value={eventData.description || ''}
          onChange={handleChange}
          disabled={loading}
        />
        <div className="flex items-center justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <Link 
            to="/events"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center"
          >
            {loading && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            {isEditing ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventFormPage;