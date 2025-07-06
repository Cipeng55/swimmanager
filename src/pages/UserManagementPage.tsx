import React, { useState, useEffect, useMemo } from 'react';
import { User, AdminNewUserPayload, Club, SelectOption, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers as apiGetAllUsers, createUser as apiCreateUser, getClubs } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState<Partial<AdminNewUserPayload>>({ username: '', password: '', role: 'user', clubId: '' });
  const [clubCreationMode, setClubCreationMode] = useState<'existing' | 'new'>('existing');
  const [newClubName, setNewClubName] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentUser } = useAuth();

  const fetchData = async () => {
    if (!currentUser || currentUser.role !== 'superadmin') {
      setError("Forbidden: You do not have permission to view this page.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [allUsers, allClubs] = await Promise.all([
        apiGetAllUsers(),
        getClubs()
      ]);
      setUsers(allUsers);
      setClubs(allClubs);
    } catch (err: any) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const roleOptions: SelectOption[] = [
    { value: 'user', label: 'User (Manages Swimmers/Results)' },
    { value: 'admin', label: 'Admin (Manages Events & Club Users)' },
  ];

  const clubOptions: SelectOption[] = useMemo(() => 
    clubs.map(c => ({ value: c.id, label: c.name })), 
    [clubs]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.role !== 'superadmin') return;
    setFormError(null);

    if (!newUser.username?.trim() || !newUser.password?.trim() || !newUser.role) {
        setFormError("Username, password, and role are required.");
        return;
    }

    let payload: AdminNewUserPayload = {
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
    };
    
    // Both admin and user roles require a club
    if (clubCreationMode === 'new') {
        if (!newClubName.trim()) {
            setFormError("New club name cannot be empty.");
            return;
        }
        payload.newClubName = newClubName.trim();
    } else {
        if (!newUser.clubId) {
            setFormError("A club must be selected for the new user.");
            return;
        }
        payload.clubId = newUser.clubId;
    }

    setIsSubmitting(true);
    try {
        await apiCreateUser(payload);
        
        setNewUser({ username: '', password: '', role: 'user', clubId: '' });
        setNewClubName('');
        setClubCreationMode('existing');
        fetchData(); 
    } catch (err: any) {
        setFormError(err.message || "Failed to create user. Username or Club Name might already exist.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (loading) return <LoadingSpinner text="Loading user data..." />;

  const title = "Account Management (Superadmin)";
  const description = "As a Superadmin, you can create new Clubs, Admins (Club Managers), and Users.";

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">{description}</p>
      </header>
      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
           <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Existing Accounts</h2>
           <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Club</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.clubName || 'N/A'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
           </div>
        </div>

        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
           <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Create New Account</h2>
           <form onSubmit={handleAddUser} className="space-y-4">
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <FormField label="Username" id="username" name="username" type="text" value={newUser.username || ''} onChange={handleInputChange} required disabled={isSubmitting} />
            <FormField label="Password" id="password" name="password" type="password" value={newUser.password || ''} onChange={handleInputChange} required disabled={isSubmitting}/>
            <FormField
                label="Role"
                id="role"
                name="role"
                type="select"
                value={newUser.role || 'user'}
                options={roleOptions}
                onChange={handleInputChange}
                required
                disabled={isSubmitting}
            />
            
            <div className="space-y-4 p-3 border rounded-md border-gray-300 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Club Assignment</p>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <input type="radio" id="existingClub" name="clubCreationMode" value="existing" checked={clubCreationMode === 'existing'} onChange={() => setClubCreationMode('existing')} className="focus:ring-primary h-4 w-4 text-primary border-gray-300"/>
                        <label htmlFor="existingClub" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Existing Club</label>
                    </div>
                    <div className="flex items-center">
                        <input type="radio" id="newClub" name="clubCreationMode" value="new" checked={clubCreationMode === 'new'} onChange={() => setClubCreationMode('new')} className="focus:ring-primary h-4 w-4 text-primary border-gray-300"/>
                        <label htmlFor="newClub" className="ml-2 text-sm text-gray-700 dark:text-gray-300">Create New</label>
                    </div>
                </div>
    
                {clubCreationMode === 'existing' ? (
                    <FormField
                        label=""
                        id="clubId"
                        name="clubId"
                        type="select"
                        options={clubOptions}
                        value={newUser.clubId || ''}
                        onChange={handleInputChange}
                        required
                        placeholder="Select an existing club..."
                        disabled={isSubmitting}
                        containerClassName="mb-0"
                    />
                ) : (
                    <FormField
                        label=""
                        id="newClubName"
                        name="newClubName"
                        type="text"
                        placeholder="Enter new club name..."
                        value={newClubName}
                        onChange={(e) => setNewClubName(e.target.value)}
                        required
                        disabled={isSubmitting}
                        containerClassName="mb-0"
                    />
                )}
            </div>
            
            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light disabled:opacity-50">
              {isSubmitting && <ButtonSpinnerIcon className="h-5 w-5 mr-2" />}
              {isSubmitting ? 'Adding...' : 'Create Account'}
            </button>
           </form>
        </div>
      </div>
    </div>
  );
};
export default UserManagementPage;