
import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import FormField from './common/FormField';
import { ButtonSpinnerIcon } from './icons/ButtonSpinnerIcon';
import { User } from '../types';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (userId: string, newPassword: string) => Promise<void>;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, user, onSave }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  if (!user) return null;

  const handleSave = async () => {
    setError(null);
    if (!password) {
      setError('New password cannot be empty.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(user.id, password);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Reset Password for ${user.username}`}>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900 rounded-md">{error}</div>}
        <FormField
          label="New Password"
          id="newPassword"
          name="newPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isSaving}
        />
        <FormField
          label="Confirm New Password"
          id="confirmNewPassword"
          name="confirmNewPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={isSaving}
        />
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md flex items-center disabled:opacity-50"
          >
            {isSaving && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            Save Password
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ResetPasswordModal;
