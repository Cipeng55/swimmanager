import React, { useState, useEffect } from 'react';
import { User, NewUser, AdminNewUserPayload, Club, SelectOption, UserRole } from '../types';
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
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentUser } = useAuth();

  const fetchData = async () => {
    if (!currentUser) {
      setError("You must be logged in to manage users.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const allUsers = await apiGetAllUsers();
      setUsers(allUsers);
      if (currentUser.role === 'superadmin') {
        const allClubs = await getClubs();
        setClubs(allClubs);
        // Default selection to the first club if available
        if (allClubs.length > 0) {
          setNewUser(prev => ({ ...prev, clubId: allClubs[0].id }));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (currentUser.role === 'superadmin' && !newUser.clubId) {
      setFormError("Please select a club.");
      return;
    }

    if (!newUser.username?.trim() || !newUser.password?.trim()) {
        setFormError("Username and password are required.");
        return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
        let payload: NewUser | AdminNewUserPayload;

        if (currentUser.role === 'superadmin') {
            payload = { 
                username: newUser.username!, 
                password: newUser.password!, 
                role: newUser.role as UserRole,
                clubId: newUser.clubId!
            };
        } else { // Admin role
            payload = { 
                username: newUser.username!, 
                password: newUser.password!,
                role: 'user' // Admins can only create users
            };
        }
        
        await apiCreateUser(payload);
        setNewUser({ username: '', password: '', role: 'user', clubId: clubs.length > 0 ? clubs[0].id : '' });
        fetchData(); // Refresh user list
    } catch (err: any) {
        setFormError(err.message || "Failed to create user. Username might already exist.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const clubOptions: SelectOption[] = clubs.map(c => ({ value: c.id, label: c.name }));

  if (loading) return <LoadingSpinner text="Loading user data..." />;

  const title = currentUser?.role === 'superadmin' ? "System User Management" : "Club User Management";
  const description = currentUser?.role === 'superadmin' ? "Create and manage Admins and Users for all clubs." : "Create and manage User accounts for your club.";

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">{description}</p>
      </header>
      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
           <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Existing Users</h2>
           <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Role</th>
                        {currentUser?.role === 'superadmin' && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Club</th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
                            {currentUser?.role === 'superadmin' && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.clubName || 'N/A'}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
           </div>
        </div>

        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
           <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Add New User</h2>
           <form onSubmit={handleAddUser} className="space-y-4">
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <FormField label="Username" id="username" name="username" type="text" value={newUser.username || ''} onChange={handleInputChange} required />
            <FormField label="Password" id="password" name="password" type="password" value={newUser.password || ''} onChange={handleInputChange} required />
            
            {currentUser?.role === 'superadmin' && (
                <>
                    <FormField label="Role" id="role" name="role" type="select" options={[{value: 'user', label: 'User'}, {value: 'admin', label: 'Admin'}]} value={newUser.role || 'user'} onChange={handleInputChange} required />
                    <FormField
                      label="Club"
                      id="clubId"
                      name="clubId"
                      type="select"
                      options={clubOptions}
                      value={newUser.clubId || ''}
                      onChange={handleInputChange}
                      required
                      placeholder="Select a club"
                    />
                </>
            )}
            
            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light disabled:opacity-50">
              {isSubmitting && <ButtonSpinnerIcon className="h-5 w-5 mr-2" />}
              {isSubmitting ? 'Adding...' : 'Add User'}
            </button>
           </form>
        </div>
      </div>
    </div>
  );
};
export default UserManagementPage;