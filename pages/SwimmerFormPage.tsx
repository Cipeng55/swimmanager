
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { NewSwimmer, Swimmer, SelectOption } from '../types';
import { addSwimmer, getSwimmerById, updateSwimmer } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const genderOptions: SelectOption[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const gradeLevelOptions: SelectOption[] = [
  { value: '', label: 'Select Grade (Optional)' },
  { value: 'Belum Sekolah / PAUD', label: 'Belum Sekolah / PAUD' },
  { value: 'TK A', label: 'TK A' },
  { value: 'TK B', label: 'TK B' },
  { value: 'SD Kelas 1', label: 'SD Kelas 1' },
  { value: 'SD Kelas 2', label: 'SD Kelas 2' },
  { value: 'SD Kelas 3', label: 'SD Kelas 3' },
  { value: 'SD Kelas 4', label: 'SD Kelas 4' },
  { value: 'SD Kelas 5', label: 'SD Kelas 5' },
  { value: 'SD Kelas 6', label: 'SD Kelas 6' },
  { value: 'SMP Kelas VII', label: 'SMP Kelas VII' },
  { value: 'SMP Kelas VIII', label: 'SMP Kelas VIII' },
  { value: 'SMP Kelas IX', label: 'SMP Kelas IX' },
  { value: 'SMA Kelas X', label: 'SMA Kelas X' },
  { value: 'SMA Kelas XI', label: 'SMA Kelas XI' },
  { value: 'SMA Kelas XII', label: 'SMA Kelas XII' },
  { value: 'Lulus / Mahasiswa / Umum', label: 'Lulus / Mahasiswa / Umum' },
];


const SwimmerFormPage: React.FC = () => {
  const { swimmerId } = useParams<{ swimmerId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(swimmerId);
  const { currentUser } = useAuth(); 

  const [swimmerData, setSwimmerData] = useState<Partial<NewSwimmer | Swimmer>>({
    name: '',
    dob: '',
    gender: 'Other', 
    club: '',
    gradeLevel: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewSwimmer, string>>>({});

  // Role-based access control for edit mode
  if (isEditing && currentUser?.role !== 'admin') {
    return <Navigate to="/swimmers" replace state={{ unauthorizedAccess: true }} />;
  }

  useEffect(() => {
    if (isEditing && swimmerId && currentUser?.role === 'admin') { 
      setLoading(true);
      getSwimmerById(parseInt(swimmerId))
        .then(swimmer => {
          if (swimmer) {
            const dobString = typeof swimmer.dob === 'string' ? swimmer.dob : '';
            const formattedSwimmer = { 
                ...swimmer, 
                dob: dobString.split('T')[0],
                gradeLevel: swimmer.gradeLevel || '',
            };
            setSwimmerData(formattedSwimmer);
          } else {
            setError('Swimmer not found.');
          }
        })
        .catch(err => {
          console.error(err);
          setError('Failed to load swimmer data.');
        })
        .finally(() => setLoading(false));
    }
  }, [swimmerId, isEditing, currentUser]);

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewSwimmer, string>> = {};
    if (!swimmerData.name?.trim()) errors.name = 'Swimmer name is required.';
    if (!swimmerData.dob) errors.dob = 'Date of birth is required.';
    else { /* existing DOB validation could be added here if needed */ }
    if (!swimmerData.gender) errors.gender = 'Gender is required.';
    if (!swimmerData.club?.trim()) errors.club = 'Club name is required.';
    // gradeLevel is optional, so no validation here unless rules change
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSwimmerData(prev => ({ ...prev, [name]: value }));
     if (formErrors[name as keyof NewSwimmer]) {
      setFormErrors(prev => ({...prev, [name]: undefined}));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isEditing && currentUser?.role !== 'admin') {
        setError("Unauthorized to edit swimmer.");
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: NewSwimmer = {
        name: swimmerData.name!,
        dob: new Date(swimmerData.dob!).toISOString().split('T')[0], 
        gender: swimmerData.gender!,
        club: swimmerData.club!,
        gradeLevel: swimmerData.gradeLevel?.trim() || undefined, // Send undefined if empty
      };

      if (isEditing && 'id' in swimmerData && swimmerData.id) {
        // When updating, explicitly pass gradeLevel, even if undefined, to allow clearing it.
        await updateSwimmer(swimmerData.id, { 
            ...payload, 
            gradeLevel: swimmerData.gradeLevel ? swimmerData.gradeLevel.trim() : undefined 
        });
      } else {
        await addSwimmer(payload);
      }
      navigate('/swimmers');
    } catch (err) {
      console.error(err);
      setError(isEditing ? 'Failed to update swimmer.' : 'Failed to add swimmer.');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && isEditing && !swimmerData.name && currentUser?.role === 'admin') {
    return <LoadingSpinner text="Loading swimmer details..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {isEditing ? 'Edit Swimmer Profile (Admin)' : 'Register New Swimmer'}
        </h1>
        {isEditing && currentUser?.role !== 'admin' && <p className="text-red-500">You are not authorized to edit swimmers.</p>}
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
        <FormField
          label="Full Name"
          id="name"
          name="name"
          type="text"
          value={swimmerData.name || ''}
          onChange={handleChange}
          error={formErrors.name}
          required
          disabled={loading}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
            label="Date of Birth"
            id="dob"
            name="dob"
            type="date"
            value={(swimmerData.dob && typeof swimmerData.dob === 'string' ? swimmerData.dob : '').split('T')[0]}
            onChange={handleChange}
            error={formErrors.dob}
            required
            disabled={loading}
            />
            <FormField
            label="Gender"
            id="gender"
            name="gender"
            type="select"
            options={genderOptions}
            value={swimmerData.gender || 'Other'}
            onChange={handleChange}
            error={formErrors.gender}
            required
            disabled={loading}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
            label="Club Affiliation"
            id="club"
            name="club"
            type="text"
            value={swimmerData.club || ''}
            onChange={handleChange}
            error={formErrors.club}
            required
            disabled={loading}
            />
            <FormField
            label="Grade Level (School)"
            id="gradeLevel"
            name="gradeLevel"
            type="select"
            options={gradeLevelOptions}
            value={swimmerData.gradeLevel || ''}
            onChange={handleChange}
            error={formErrors.gradeLevel} 
            disabled={loading}
            />
        </div>
        <div className="flex items-center justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <Link 
            to="/swimmers"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || (isEditing && currentUser?.role !== 'admin')}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center"
          >
            {loading && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            {isEditing ? 'Save Changes' : 'Register Swimmer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SwimmerFormPage;
