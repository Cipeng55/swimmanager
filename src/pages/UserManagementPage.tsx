
import React, { useState, useEffect } from 'react';
import { User, NewUserPayload, SelectOption } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers as apiGetAllUsers, createUser as apiCreateUser, updateUserPassword as apiUpdateUserPassword } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { KeyIcon } from '../components/icons/KeyIcon';

const roleOptions: SelectOption[] = [
    { value: 'user', label: 'User (Club)' },
    { value: 'admin', label: 'Admin (Event Organizer)' },
];

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'superadmin';
  
  const [newUser, setNewUser] = useState<Partial<NewUserPayload>>({
    username: '', 
    password: '', 
    role: 'user', 
    clubName: '' 
  });
  
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);


  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const allUsers = await apiGetAllUsers();
      setUsers(allUsers);
    } catch(err: any) {
        setError(err.message || 'Failed to fetch users.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) {
      setNewUser(prev => ({ ...prev, role: 'user' }));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUser(prev => {
        const updated = {...prev, [name]: value};
        if (isSuperAdmin && name === 'role' && value === 'admin') {
            updated.clubName = '';
        }
        return updated;
    });
    if (formError) setFormError(null);
  };
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    
    if (!newUser.username || !newUser.password || !newUser.role) {
        setFormError("Username, password, and role are required.");
        return;
    }
     if (newUser.password.length < 6) {
        setFormError('Password must be at least 6 characters long.');
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
        setNewUser({ username: '', password: '', role: isSuperAdmin ? 'user' : 'user', clubName: '' });
        setSuccessMessage(`Account for ${payload.username} created successfully!`);
        setTimeout(() => setSuccessMessage(null), 5000);
        fetchData(); 
    } catch (err: any) {
        setFormError(err.message || "Failed to create user.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const canManageUser = (targetUser: User): boolean => {
    if (!currentUser) return false;
    if (isSuperAdmin && targetUser.role !== 'superadmin') return true;
    if (currentUser.role === 'admin' && targetUser.role === 'user' && targetUser.createdByAdminId === currentUser.id) return true;
    return false;
  };
  
  const handleOpenResetModal = (user: User) => {
    setUserToReset(user);
    setIsResetModalOpen(true);
    setSuccessMessage(null);
  };

  const handleCloseResetModal = () => {
    setUserToReset(null);
    setIsResetModalOpen(false);
  };

  const handleSavePassword = async (userId: string, newPassword: string) => {
    try {
      await apiUpdateUserPassword(userId, newPassword);
      setSuccessMessage(`Password for ${userToReset?.username} updated successfully.`);
      handleCloseResetModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      throw err; // Re-throw to be caught by the modal
    }
  };


  if (currentUser?.role !== 'superadmin' && currentUser?.role !== 'admin') {
    return <div className="text-center py-10 text-red-500">Access Denied. This page is for Administrators only.</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Account Management</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {isSuperAdmin ? "Create and view all user and admin accounts." : "Create new club accounts and view accounts you manage."}
          </p>
      </header>

      {error && <div className="mb-4 p-3 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}
      {successMessage && <div className="mb-4 p-3 text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-800 rounded-md">{successMessage}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
              {isSuperAdmin ? 'Create New Account' : 'Create New Club Account'}
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
               {formError && <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900 rounded-md">{formError}</div>}
               <FormField label="Username" id="username" name="username" type="text" value={newUser.username || ''} onChange={handleNewUserChange} required disabled={isSubmitting} />
               <FormField label="Password (min. 6 characters)" id="password" name="password" type="password" value={newUser.password || ''} onChange={handleNewUserChange} required disabled={isSubmitting} />
               {isSuperAdmin && (
                 <FormField label="Role" id="role" name="role" type="select" options={roleOptions} value={newUser.role || 'user'} onChange={handleNewUserChange} required disabled={isSubmitting} />
               )}
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.clubName || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  {canManageUser(user) ? (
                                    <button
                                      onClick={() => handleOpenResetModal(user)}
                                      className="text-primary-dark hover:text-primary p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                                      aria-label={`Reset password for ${user.username}`}
                                      title="Reset Password"
                                    >
                                      <KeyIcon className="h-5 w-5" />
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">N/A</span>
                                  )}
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
      </div>
      <ResetPasswordModal 
        isOpen={isResetModalOpen}
        onClose={handleCloseResetModal}
        user={userToReset}
        onSave={handleSavePassword}
      />
    </div>
  );
};

export default UserManagementPage;
