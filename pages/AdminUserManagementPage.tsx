import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, NewUser, UserRole, SelectOption } from '../types';
import FormField from '../components/common/FormField';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ButtonSpinnerIcon } from '../components/icons/ButtonSpinnerIcon';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import * as authService from '../services/authService'; // Import authService directly

const roleOptions: SelectOption[] = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const AdminUserManagementPage: React.FC = () => {
  const { currentUser, getAllUsers, createUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // State for Change My Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newOwnPassword, setNewOwnPassword] = useState('');
  const [confirmNewOwnPassword, setConfirmNewOwnPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);


  const fetchUsers = async () => {
    if (!getAllUsers) {
      setError("User management function not available for your role.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [getAllUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUser) {
      setAddUserError("User creation function not available.");
      return;
    }
    if (!newUsername.trim() || !newPassword.trim()) {
      setAddUserError("Username and password are required.");
      return;
    }
    if (newPassword.trim().length < 3) {
      setAddUserError("Password must be at least 3 characters long.");
      return;
    }
    setIsAddingUser(true);
    setAddUserError(null);
    try {
      const newUserPayload: NewUser = { username: newUsername, password: newPassword, role: newRole };
      await createUser(newUserPayload);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setShowAddForm(false); // Hide form on success
      fetchUsers(); // Refresh user list
    } catch (err: any) {
      setAddUserError(err.message || "Failed to create user.");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);

    if (!currentPassword || !newOwnPassword || !confirmNewOwnPassword) {
      setChangePasswordError("All password fields are required.");
      return;
    }
    if (newOwnPassword !== confirmNewOwnPassword) {
      setChangePasswordError("New passwords do not match.");
      return;
    }
    if (newOwnPassword.length < 3) {
        setChangePasswordError("New password must be at least 3 characters long.");
        return;
    }
    if (!currentUser) {
      setChangePasswordError("Not logged in.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword(currentUser.id, currentPassword, newOwnPassword);
      setChangePasswordSuccess("Password changed successfully!");
      setCurrentPassword('');
      setNewOwnPassword('');
      setConfirmNewOwnPassword('');
      // Optionally, you might want to force a re-login or update context,
      // but for this simulation, the password is changed in the master list.
    } catch (err: any) {
      setChangePasswordError(err.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };


  if (loading && users.length === 0) {
    return <LoadingSpinner text="Loading users..." />;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  }
  
  if (!getAllUsers || !createUser) {
     return <div className="text-center py-10 text-red-500 dark:text-red-400">Access Denied. User management is for admins only.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">User Management</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
                Create and manage application users. (Simulated)
            </p>
        </div>
        {!showAddForm && (
            <button
                onClick={() => setShowAddForm(true)}
                className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center"
            >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                Add New User
            </button>
        )}
      </header>

      {/* Add New User Form Section */}
      {showAddForm && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Add New User</h2>
          {addUserError && <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 p-2 rounded-md">{addUserError}</p>}
          <form onSubmit={handleAddUser} className="space-y-4">
            <FormField
              label="Username"
              id="newUsername"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              disabled={isAddingUser}
            />
            <FormField
              label="Password (min. 3 characters)"
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isAddingUser}
            />
            <FormField
              label="Role"
              id="newRole"
              type="select"
              options={roleOptions}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              required
              disabled={isAddingUser}
            />
            <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => {setShowAddForm(false); setAddUserError(null);}} disabled={isAddingUser} className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md">Cancel</button>
                <button type="submit" disabled={isAddingUser} className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50 flex items-center">
                    {isAddingUser && <ButtonSpinnerIcon className="h-4 w-4 mr-1" />}
                    Create User
                </button>
            </div>
          </form>
        </section>
      )}

      {/* Change My Password Section */}
      {currentUser?.role === 'admin' && (
        <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Change My Password</h2>
          {changePasswordError && <p className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 p-2 rounded-md">{changePasswordError}</p>}
          {changePasswordSuccess && <p className="mb-3 text-sm text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 p-2 rounded-md">{changePasswordSuccess}</p>}
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
            <FormField
              label="Current Password"
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={isChangingPassword}
            />
            <FormField
              label="New Password (min. 3 characters)"
              id="newOwnPassword"
              type="password"
              value={newOwnPassword}
              onChange={(e) => setNewOwnPassword(e.target.value)}
              required
              disabled={isChangingPassword}
            />
            <FormField
              label="Confirm New Password"
              id="confirmNewOwnPassword"
              type="password"
              value={confirmNewOwnPassword}
              onChange={(e) => setConfirmNewOwnPassword(e.target.value)}
              required
              disabled={isChangingPassword}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-md disabled:opacity-50 flex items-center"
              >
                {isChangingPassword && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
                Change Password
              </button>
            </div>
          </form>
        </section>
      )}

      {/* User List Section */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">User List</h2>
        {users.length === 0 && !loading ? (
          <p className="text-gray-500 dark:text-gray-400">No users found (except possibly the current admin).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400 p-4 border border-dashed border-red-300 dark:border-red-700 rounded-md">
            <p className="font-bold text-red-600 dark:text-red-400">SECURITY & SIMULATION NOTE:</p>
            <p>This user management is part of a frontend simulation.</p>
            <p>Passwords shown in forms are not hashed. User data is stored in browser localStorage and is not secure.</p>
            <p>Full user management (edit, delete) is omitted for brevity.</p>
        </div>
    </div>
  );
};

export default AdminUserManagementPage;