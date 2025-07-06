
import React, { useState, useEffect } from 'react';
import Modal from './common/Modal';
import FormField from './common/FormField';
import { LaneSwimmerDetails, SelectOption } from '../types';
import { ButtonSpinnerIcon } from './icons/ButtonSpinnerIcon';

interface EditLaneResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  swimmerData: LaneSwimmerDetails | null;
  onSave: (resultId: number, finalTime?: string, remarks?: string) => Promise<void>;
}

const remarkOptions: SelectOption[] = [
  { value: '', label: 'No Remark / OK' },
  { value: 'DQ', label: 'DQ (Disqualified)' },
  { value: 'DNS', label: 'DNS (Did Not Start)' },
  { value: 'DNF', label: 'DNF (Did Not Finish)' },
  // Future: Add more specific DQ reasons if needed, e.g.:
  // { value: 'DQ-FS', label: 'DQ (False Start)' },
];

const EditLaneResultModal: React.FC<EditLaneResultModalProps> = ({
  isOpen,
  onClose,
  swimmerData,
  onSave,
}) => {
  const [finalTime, setFinalTime] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const nonRankingRemarks = ['DQ', 'DNS', 'DNF'];

  useEffect(() => {
    if (swimmerData) {
      const initialRemark = swimmerData.remarks || '';
      setRemarks(initialRemark);
      if (nonRankingRemarks.includes(initialRemark.toUpperCase())) {
        setFinalTime('');
      } else {
        setFinalTime(swimmerData.finalTimeStr || '');
      }
      setFormError(null);
    } else {
      setFinalTime('');
      setRemarks('');
    }
  }, [swimmerData]);

  const validateTimeFormat = (timeValue: string): boolean => {
    if (!timeValue) return true; // Allow empty
    return /^\d{2}:\d{2}\.\d{2}$/.test(timeValue);
  };

  const handleRemarkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRemark = e.target.value;
    setRemarks(newRemark);
    if (nonRankingRemarks.includes(newRemark.toUpperCase())) {
        setFinalTime(''); // Clear final time if DQ/DNS/DNF
        if (formError) setFormError(null); // Also clear time format error
    }
  };

  const handleSave = async () => {
    if (!swimmerData) return;

    if (finalTime && !validateTimeFormat(finalTime)) {
      setFormError('Final Time must be in MM:SS.ss format (e.g., 01:23.45).');
      return;
    }
    // If remark is DQ/DNS/DNF, finalTime state should already be empty.
    // Ensure it's explicitly treated as undefined if such remark is set.
    const effectiveFinalTime = nonRankingRemarks.includes(remarks.toUpperCase()) ? undefined : finalTime.trim() || undefined;

    setFormError(null);
    setIsSaving(true);
    try {
      await onSave(swimmerData.resultId, effectiveFinalTime, remarks.trim() || undefined);
    } catch (error) {
        // Error handling is managed by the parent (EventProgramPage)
    } finally {
        setIsSaving(false);
    }
  };
  
  const modalTitle = swimmerData ? `Edit Result: ${swimmerData.name}` : 'Edit Result';

  if (!isOpen || !swimmerData) return null;

  const isTimeInputDisabled = isSaving || nonRankingRemarks.includes(remarks.toUpperCase());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
            Lane: {swimmerData.lane} | Club: {swimmerData.club} | Seed: {swimmerData.seedTimeStr}
        </p>
        <FormField
          label="Keterangan (Remarks)"
          id="remarks"
          name="remarks"
          type="select"
          options={remarkOptions}
          value={remarks}
          onChange={handleRemarkChange}
          disabled={isSaving}
        />
        <FormField
          label="Final Time (MM:SS.ss)"
          id="finalTime"
          name="finalTime"
          type="text"
          placeholder={isTimeInputDisabled ? "N/A with current remark" : "e.g., 00:58.75 (Optional)"}
          value={finalTime}
          onChange={(e) => {
            setFinalTime(e.target.value);
            if (formError) setFormError(null);
          }}
          error={formError || undefined}
          maxLength={8}
          disabled={isTimeInputDisabled}
          className={isTimeInputDisabled ? "bg-gray-100 dark:bg-gray-600" : ""}
        />
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center"
          >
            {isSaving && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            Save Result
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditLaneResultModal;
