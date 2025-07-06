
import React, { useState, useCallback, useRef } from 'react';
import Modal from './common/Modal';
import { ImportFeedback, RowError } from '../types';
import { ButtonSpinnerIcon } from './icons/ButtonSpinnerIcon';
import { useAuth } from '../contexts/AuthContext';

interface ImportSwimmersModalProps {
  isOpen: boolean;
  onClose: () => void;
  processFileContent: (
    fileContent: string,
    updateFeedback: (feedback: Partial<ImportFeedback>) => void
  ) => Promise<void>;
}

const ImportSwimmersModal: React.FC<ImportSwimmersModalProps> = ({
  isOpen,
  onClose,
  processFileContent,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<ImportFeedback>({
    successCount: 0,
    skippedCount: 0,
    rowErrors: [],
    status: 'idle',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();
  const isAdminOrSuper = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setFeedback({ successCount: 0, skippedCount: 0, rowErrors: [], status: 'idle' });
    } else {
      setSelectedFile(null);
    }
  };

  const resetModalState = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setFeedback({ successCount: 0, skippedCount: 0, rowErrors: [], status: 'idle' });
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleModalClose = () => {
    resetModalState();
    onClose();
  };

  const updateInternalFeedback = useCallback((update: Partial<ImportFeedback>) => {
    setFeedback(prev => {
        const updatedRowErrors = update.rowErrors !== undefined ? update.rowErrors : prev.rowErrors;
        const updatedSkippedCount = update.skippedCount !== undefined ? update.skippedCount : (prev.skippedCount || 0);
        const updatedSuccessCount = update.successCount !== undefined ? update.successCount : (prev.successCount || 0);

        return {
            ...prev,
            ...update,
            successCount: updatedSuccessCount,
            rowErrors: updatedRowErrors,
            skippedCount: updatedSkippedCount,
        };
    });
  }, []);

  const handleImport = async () => {
    if (!selectedFile) {
      updateInternalFeedback({ generalError: 'Please select a CSV file to import.', status: 'error' });
      return;
    }

    setIsProcessing(true);
    setFeedback({ 
      successCount: 0,
      skippedCount: 0,
      rowErrors: [],
      status: 'processing',
      generalError: undefined,
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        await processFileContent(text, updateInternalFeedback);
      } catch (err: any) {
        updateInternalFeedback({
          generalError: `An unexpected error occurred: ${err.message}`,
          status: 'error',
          successCount: 0, 
          skippedCount: 0,
          rowErrors: [],
        });
      } finally {
        setIsProcessing(false);
        setFeedback(prev => ({ ...prev, status: prev.status === 'processing' ? 'completed' : prev.status }));
      }
    };
    reader.onerror = () => {
      setIsProcessing(false);
      updateInternalFeedback({ generalError: 'Failed to read the file.', status: 'error', successCount: 0, skippedCount: 0, rowErrors: [] });
    };
    reader.readAsText(selectedFile);
  };

  const csvInstructions = `Name,DOB,Gender,${isAdminOrSuper ? 'Club,' : ''}GradeLevel
- Name: Full name of the swimmer (Text)
- DOB: Date of Birth in YYYY-MM-DD format (e.g., 2005-12-31)
- Gender: Must be one of 'Male', 'Female', or 'Other'
${isAdminOrSuper ? "- Club: Name of the swimmer's club (REQUIRED for your role)" : ''}
- GradeLevel (Optional): Swimmer's school grade (e.g., "SD Kelas 1")

Example:
Name,DOB,Gender,Club,GradeLevel
John Doe,2008-03-15,Male,Dolphins SC,SD Kelas 6
Jane Smith,2009-07-22,Female,Sharks Club,SD Kelas 5

Important:
- Required headers (case-insensitive): Name, DOB, Gender${isAdminOrSuper ? ', Club' : ''}.
- The 'Club' column is ${isAdminOrSuper ? 'REQUIRED for your role.' : 'IGNORED for your role (your club is used automatically).'}
- File must be UTF-8 encoded.`;

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Import Swimmers from CSV">
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md">
          <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">CSV Format Instructions:</h4>
          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 p-2 rounded-sm overflow-x-auto">
            {csvInstructions}
          </pre>
        </div>

        <div>
          <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Select CSV File
          </label>
          <input
            type="file"
            id="csvFile"
            name="csvFile"
            accept=".csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="mt-1 block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-light file:text-primary-dark hover:file:bg-primary-light/80 dark:file:bg-primary-dark dark:file:text-primary-light"
            disabled={isProcessing}
          />
        </div>

        {feedback.status !== 'idle' && (
          <div className={`p-3 rounded-md ${feedback.status === 'error' || feedback.generalError || (feedback.rowErrors && feedback.rowErrors.length > 0) ? 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700' : feedback.status === 'completed' && feedback.successCount > 0 && (!feedback.rowErrors || feedback.rowErrors.length === 0) && !feedback.generalError ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700' : 'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700'}`}>
            <h4 className="font-semibold mb-1">Import Status: {feedback.status.toUpperCase()}</h4>
            {feedback.generalError && <p className="text-sm text-red-700 dark:text-red-300">Error: {feedback.generalError}</p>}
            <p className="text-sm">Successfully Imported: {feedback.successCount || 0}</p>
            <p className="text-sm">Skipped (Rows with Errors): {feedback.skippedCount || 0}</p> 
            
            {feedback.rowErrors && feedback.rowErrors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Error Details (max 10 shown):</p>
                <ul className="list-disc list-inside text-xs max-h-32 overflow-y-auto">
                  {feedback.rowErrors.slice(0, 10).map((err: RowError, index: number) => (
                    <li key={index}>
                      Row {err.rowNumber}: "{err.rowData ? err.rowData.substring(0,50) : 'N/A' }..." - {err.errors.join(', ')}
                    </li>
                  ))}
                </ul>
                {feedback.rowErrors.length > 10 && <p className="text-xs">...and {feedback.rowErrors.length - 10} more errors.</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={handleModalClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light dark:focus:ring-offset-gray-800 disabled:opacity-50"
          >
            {feedback.status === 'completed' || feedback.status === 'error' ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isProcessing || !selectedFile || feedback.status === 'completed'}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800 disabled:opacity-50 flex items-center"
          >
            {isProcessing && <ButtonSpinnerIcon className="h-4 w-4 mr-2" />}
            {isProcessing ? 'Processing...' : 'Import Swimmers'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ImportSwimmersModal;
