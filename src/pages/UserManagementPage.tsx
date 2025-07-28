import React, { useState, useEffect, useMemo } from 'react';
import { User, NewUserPayload, SelectOption } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAllUsers as apiGetAllUsers, createUser as apiCreateUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import FormField from '../components/common/FormField';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { KeyIcon } from '../components/icons/KeyIcon';
import { PowerIcon } from '../components/icons/PowerIcon';
import Modal from '../components/common/Modal';
import { DeleteIcon } from '../components/icons/DeleteIcon';

const roleOptions: SelectOption[] = [
    { value: 'user', label: 'User (Club)' },
    { value: 'admin', label: 'Admin (Event Organizer)' },
];

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToUpdateStatus, setUserToUpdateStatus] = useState<User | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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
      await apiUpdateUser(userId, { password: newPassword });
      setSuccessMessage(`Password for ${userToReset?.username} updated successfully.`);
      handleCloseResetModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      throw err; // Re-throw to be caught by the modal
    }
  };

  const handleOpenConfirmStatusModal = (user: User) => {
    setUserToUpdateStatus(user);
    setIsConfirmModalOpen(true);
  };

  const handleCloseConfirmStatusModal = () => {
    setUserToUpdateStatus(null);
    setIsConfirmModalOpen(false);
  };

  const handleConfirmStatusChange = async () => {
    if (!userToUpdateStatus) return;
    const newStatus = (userToUpdateStatus.status ?? 'active') === 'active' ? 'inactive' : 'active';
    try {
      await apiUpdateUser(userToUpdateStatus.id, { status: newStatus });
      setSuccessMessage(`Account for ${userToUpdateStatus.username} has been ${newStatus}.`);
      fetchData(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    } finally {
      handleCloseConfirmStatusModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleOpenDeleteModal = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setUserToDelete(null);
    setIsDeleteModalOpen(false);
  };
  
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await apiDeleteUser(userToDelete.id);
      setSuccessMessage(`Account '${userToDelete.username}' and all associated data deleted.`);
      fetchData(); // Refresh list from server
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      handleCloseDeleteModal();
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };
  
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.clubName && user.clubName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [users, searchQuery]);

  if (currentUser?.role !== 'superadmin' && currentUser?.role !== 'admin') {
    return <div className="text-center py-10 text-red-500">Access Denied. This page is for Administrators only.</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">Account Management</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {isSuperAdmin ? "Create, search, and manage all user and admin accounts." : "Create new club accounts and view accounts you manage."}
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2 sm:mb-0">Existing Accounts</h2>
                    <input
                        type="text"
                        placeholder="Search by username or club..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    />
                </div>
                {loading ? <LoadingSpinner text="Loading users..." /> : (
                    filteredUsers.length === 0 ? <p className="text-gray-500 dark:text-gray-400">No user accounts found matching your criteria.</p> :
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Username</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club Name</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.map(user => {
                                const status = user.status ?? 'active';
                                const isInactive = status === 'inactive';
                                return (
                                <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isInactive ? 'opacity-60' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.clubName || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>
                                        {status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center space-x-2">
                                    {canManageUser(user) ? (
                                        <>
                                        <button
                                            onClick={() => handleOpenResetModal(user)}
                                            className="text-primary-dark hover:text-primary p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label={`Reset password for ${user.username}`}
                                            title="Reset Password"
                                            disabled={isInactive}
                                        >
                                            <KeyIcon className="h-5 w-5" />
                                        </button>
                                        {isSuperAdmin && (
                                            <button
                                                onClick={() => handleOpenConfirmStatusModal(user)}
                                                className={`${status === 'active' ? 'text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300' : 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300'} p-1 rounded-md focus:outline-none focus:ring-2`}
                                                title={status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                aria-label={status === 'active' ? `Deactivate ${user.username}` : `Activate ${user.username}`}
                                            >
                                                <PowerIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleOpenDeleteModal(user)}
                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                            title="Delete Account"
                                            aria-label={`Delete account for ${user.username}`}
                                        >
                                            <DeleteIcon className="h-5 w-5" />
                                        </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">N/A</span>
                                    )}
                                    </td>
                                </tr>
                                )
                            })}
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
      {userToUpdateStatus && (
        <Modal isOpen={isConfirmModalOpen} onClose={handleCloseConfirmStatusModal} title="Confirm Status Change">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to {(userToUpdateStatus.status ?? 'active') === 'active' ? 'deactivate' : 'activate'} the account for "{userToUpdateStatus.username}"?
            {(userToUpdateStatus.status ?? 'active') === 'active' ? ' This will prevent them from logging in.' : ' This will allow them to log in again.'}
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCloseConfirmStatusModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmStatusChange}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md ${(userToUpdateStatus.status ?? 'active') === 'active' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
      {userToDelete && (
        <Modal isOpen={isDeleteModalOpen} onClose={handleCloseDeleteModal} title="Confirm Account Deletion">
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Are you sure you want to permanently delete the account for <strong className="dark:text-white">{userToDelete.username}</strong>?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900 p-2 rounded-md">
            This action cannot be undone. All associated data (swimmers, results, etc.) will be permanently removed.
          </p>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={handleCloseDeleteModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Yes, Delete Account
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default UserManagementPage;