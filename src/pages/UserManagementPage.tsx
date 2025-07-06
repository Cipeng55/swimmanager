import React, { useState, useEffect, useMemo } from 'react';
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

  const roleOptions: SelectOption[] = useMemo(() => {
    if (currentUser?.role === 'superadmin') {
      return [
        { value: 'user', label: 'User' },
        { value: 'admin', label: 'Admin' },
      ];
    }
    return [{ value: 'user', label: 'User' }];
  }, [currentUser]);

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
    if (!currentUser) return;

    if (!newUser.username?.trim() || !newUser.password?.trim()) {
        setFormError("Username and password are required.");
        return;
    }
    if (currentUser.role === 'superadmin' && newUser.role === 'admin' && !newUser.clubId) {
        setFormError("A club must be assigned to create an Admin user.");
        return;
    }


    setIsSubmitting(true);
    setFormError(null);
    try {
        const payload: AdminNewUserPayload = {
            username: newUser.username!,
            password: newUser.password!,
            role: newUser.role! as UserRole,
            clubId: newUser.clubId!,
        };
        
        await apiCreateUser(payload);
        
        setNewUser({ username: '', password: '', role: 'user', clubId: '' });
        fetchData(); 
    } catch (err: any) {
        setFormError(err.message || "Failed to create user. Username might already exist.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.clubName || 'Unassigned'}</td>
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
                disabled={isSubmitting || currentUser?.role === 'admin'}
            />
            {currentUser?.role === 'superadmin' && newUser.role === 'admin' && (
                <FormField
                    label="Assign to Club"
                    id="clubId"
                    name="clubId"
                    type="select"
                    options={clubOptions}
                    value={newUser.clubId || ''}
                    onChange={handleInputChange}
                    required
                    placeholder="Select a club..."
                    disabled={isSubmitting}
                />
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