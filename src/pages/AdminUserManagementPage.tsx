
import React, { useState, useEffect } from 'react';
import { User, NewUser } from '../types';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';

const AdminUserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState<NewUser>({ username: '', password: '', role: 'user' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { getAllUsers, createUser } = useAuth();

  const fetchUsers = async () => {
    if (!getAllUsers) {
      setError("You are not authorized to manage users.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [getAllUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUser) {
        setFormError("Function not available.");
        return;
    }
    if (!newUser.username.trim() || !newUser.password?.trim()) {
        setFormError("Username and password are required.");
        return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
        await createUser(newUser);
        setNewUser({ username: '', password: '', role: 'user' }); // Reset form
        fetchUsers(); // Refresh user list
    } catch (err: any) {
        setFormError(err.message || "Failed to create user. Username might already exist.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading user data..." />;

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">User Management</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">Create and manage user accounts.</p>
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
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map(user => (
                        <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
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
            <FormField
                label="Username"
                id="username"
                name="username"
                type="text"
                value={newUser.username}
                onChange={handleInputChange}
                required
            />
            <FormField
                label="Password"
                id="password"
                name="password"
                type="password"
                value={newUser.password || ''}
                onChange={handleInputChange}
                required
            />
            <FormField
                label="Role"
                id="role"
                name="role"
                type="select"
                options={[{value: 'user', label: 'User'}, {value: 'admin', label: 'Admin'}]}
                value={newUser.role}
                onChange={handleInputChange}
                required
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light disabled:opacity-50"
            >
              {isSubmitting && <ButtonSpinnerIcon className="h-5 w-5 mr-2" />}
              {isSubmitting ? 'Adding...' : 'Add User'}
            </button>
           </form>
        </div>
      </div>
    </div>
  );
};
export default AdminUserManagementPage;
