
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { NewSwimmer, Swimmer, SelectOption, User } from '../types';
import { addSwimmer, getSwimmerById, updateSwimmer, getAllUsers } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';
import { useAuth } from '../contexts/AuthContext';

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
  const isAdminOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const [swimmerData, setSwimmerData] = useState<Partial<Swimmer>>({
    name: '',
    dob: '',
    gender: 'Other',
    clubName: currentUser?.clubName || '',
    clubUserId: currentUser?.role === 'user' ? currentUser.id : '',
    gradeLevel: '',
  });
  
  const [allClubs, setAllClubs] = useState<User[]>([]);
  const [clubOptions, setClubOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewSwimmer | 'clubUserId', string>>>({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (isAdminOrSuper) {
          const users = await getAllUsers();
          const clubs = users.filter(u => u.role === 'user');
          setAllClubs(clubs);
          setClubOptions(clubs.map(c => ({ value: c.id, label: c.clubName || c.username })));
        }

        if (isEditing && swimmerId) {
          const swimmer = await getSwimmerById(swimmerId);
          if (swimmer) {
            const canEdit = currentUser?.role === 'superadmin' || 
                            currentUser?.role === 'admin' ||
                            (currentUser?.role === 'user' && swimmer.clubUserId === currentUser.id);

            if (!canEdit) {
              setError('You are not authorized to edit this swimmer.');
              setIsUnauthorized(true);
              return;
            }

            const dobString = typeof swimmer.dob === 'string' ? swimmer.dob : '';
            setSwimmerData({ 
                ...swimmer, 
                dob: dobString.split('T')[0],
                gradeLevel: swimmer.gradeLevel || '',
            });
          } else {
            setError('Swimmer not found.');
          }
        } else if (currentUser?.role === 'user') {
          setSwimmerData(prev => ({ ...prev, clubName: currentUser.clubName || '', clubUserId: currentUser.id }));
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load required data.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [swimmerId, isEditing, currentUser, isAdminOrSuper]);

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewSwimmer | 'clubUserId', string>> = {};
    if (!swimmerData.name?.trim()) errors.name = 'Swimmer name is required.';
    if (!swimmerData.dob) errors.dob = 'Date of birth is required.';
    if (!swimmerData.gender) errors.gender = 'Gender is required.';
    if (isAdminOrSuper && !swimmerData.clubUserId) errors.clubUserId = 'Club selection is required for admins.';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleClubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedClubId = e.target.value;
    const selectedClub = allClubs.find(c => c.id === selectedClubId);
    setSwimmerData(prev => ({
        ...prev,
        clubUserId: selectedClubId,
        clubName: selectedClub?.clubName || ''
    }));
    if (formErrors.clubUserId) setFormErrors(prev => ({...prev, clubUserId: undefined}));
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
    if (isUnauthorized) { setError("Unauthorized to submit form."); return; }

    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        name: swimmerData.name!,
        dob: new Date(swimmerData.dob!).toISOString().split('T')[0], 
        gender: swimmerData.gender!,
        gradeLevel: swimmerData.gradeLevel?.trim() || undefined,
      };

      if (isAdminOrSuper) {
        payload.clubUserId = swimmerData.clubUserId;
      }

      if (isEditing && 'id' in swimmerData && swimmerData.id) {
        await updateSwimmer(swimmerData.id, payload);
      } else {
        await addSwimmer(payload);
      }
      navigate('/swimmers');
    } catch (err: any) {
      console.error(err);
      setError((isEditing ? 'Failed to update swimmer: ' : 'Failed to add swimmer: ') + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && !swimmerData.name) return <LoadingSpinner text="Loading swimmer details..." />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {isEditing ? 'Edit Swimmer Profile' : 'Register New Swimmer'}
        </h1>
        {isEditing && isUnauthorized && <p className="text-red-500">You do not have permission to edit this record.</p>}
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-6">
        <FormField label="Full Name" id="name" name="name" type="text" value={swimmerData.name || ''} onChange={handleChange} error={formErrors.name} required disabled={loading || isUnauthorized} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Date of Birth" id="dob" name="dob" type="date" value={(swimmerData.dob && typeof swimmerData.dob === 'string' ? swimmerData.dob : '').split('T')[0]} onChange={handleChange} error={formErrors.dob} required disabled={loading || isUnauthorized} />
            <FormField label="Gender" id="gender" name="gender" type="select" options={genderOptions} value={swimmerData.gender || 'Other'} onChange={handleChange} error={formErrors.gender} required disabled={loading || isUnauthorized} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isAdminOrSuper ? (
            <FormField label="Club Affiliation" id="clubUserId" name="clubUserId" type="select" options={clubOptions} value={swimmerData.clubUserId || ''} onChange={handleClubChange} error={formErrors.clubUserId} required disabled={loading || isUnauthorized} placeholder="Select a club..." />
          ) : (
            <FormField label="Club Affiliation" id="clubName" name="clubName" type="text" value={swimmerData.clubName || ''} readOnly disabled />
          )}
          <FormField label="Grade Level (School)" id="gradeLevel" name="gradeLevel" type="select" options={gradeLevelOptions} value={swimmerData.gradeLevel || ''} onChange={handleChange} error={formErrors.gradeLevel as string} disabled={loading || isUnauthorized} />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <Link to="/swimmers" className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md">Cancel</Link>
          <button type="submit" disabled={loading || isUnauthorized} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 flex items-center">
            {loading && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            {isEditing ? 'Save Changes' : 'Register Swimmer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SwimmerFormPage;
