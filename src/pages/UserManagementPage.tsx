import React, { useState, useEffect } from 'react';
import { User, NewUserPayload, SelectOption } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers as apiGetAllUsers, createUser as apiCreateUser } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';

const roleOptions: SelectOption[] = [
    { value: 'user', label: 'User (Club)' },
    { value: 'admin', label: 'Admin (Event Organizer)' },
];

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState<Partial<NewUserPayload>>({ username: '', password: '', role: 'user', clubName: '' });
  
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentUser } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await apiGetAllUsers();
      // superadmin is not in the database, so won't be in the list
      setUsers(allUsers);
    } catch(err: any) {
        setError(err.message || 'Failed to fetch users.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUser(prev => ({...prev, [name]: value}));
    if (formError) setFormError(null);
  };
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!newUser.username || !newUser.password || !newUser.role) {
        setFormError("Username, password, and role are required.");
        return;
    }
    if (newUser.role === 'user' && (!newUser.clubName || !newUser.clubName.trim())) {
        setFormError("Club Name is required for 'user' role.");
        return;
    }

    setIsSubmitting(true);
    try {
        const payload: NewUserPayload = {
            username: newUser.username,
            password: newUser.password,
            role: newUser.role,
            ...(newUser.role === 'user' && { clubName: newUser.clubName }),
        };
        await apiCreateUser(payload);
        setNewUser({ username: '', password: '', role: 'user', clubName: '' }); // Reset form
        fetchData(); // Refresh list
    } catch (err: any) {
        setFormError(err.message || "Failed to create user.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (currentUser?.role !== 'superadmin') {
    return <div className="text-center py-10 text-red-500">Access Denied. This page is for Superadmins only.</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">User Account Management</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">Create and view user accounts.</p>
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create User Form */}
        <div className="lg:col-span-1">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Create New Account</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
               {formError && <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900 rounded-md">{formError}</div>}
               <FormField label="Username" id="username" name="username" type="text" value={newUser.username || ''} onChange={handleNewUserChange} required disabled={isSubmitting} />
               <FormField label="Password" id="password" name="password" type="password" value={newUser.password || ''} onChange={handleNewUserChange} required disabled={isSubmitting} />
               <FormField label="Role" id="role" name="role" type="select" options={roleOptions} value={newUser.role || 'user'} onChange={handleNewUserChange} required disabled={isSubmitting} />
               {newUser.role === 'user' && (
                 <FormField label="Club Name" id="clubName" name="clubName" type="text" value={newUser.clubName || ''} onChange={handleNewUserChange} required disabled={isSubmitting} />
               )}
               <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light disabled:opacity-50">
                {isSubmitting && <ButtonSpinnerIcon className="h-5 w-5 mr-2" />}
                {isSubmitting ? 'Creating...' : 'Create Account'}
               </button>
            </form>
          </section>
        </div>

        {/* User List */}
        <div className="lg:col-span-2">
            <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Existing Accounts</h2>
                {loading ? <LoadingSpinner text="Loading users..." /> : (
                    users.length === 0 ? <p className="text-gray-500">No user accounts found.</p> :
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Username</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club Name</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.clubName || 'N/A'}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
      </div>
    </div>
  );
};

export default UserManagementPage;