import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircleIcon } from '../components/icons/PlusCircleIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { DeleteIcon } from '../components/icons/DeleteIcon';
import { UploadIcon } from '../components/icons/UploadIcon';
import { Swimmer, NewSwimmer, ImportFeedback, RowError } from '../types';
import { getSwimmers, deleteSwimmer as apiDeleteSwimmer, addSwimmer } from '../services/api';
import { parseSwimmerCsv, ParsedSwimmerRow } from '../utils/csvParser';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import ImportSwimmersModal from '../components/ImportSwimmersModal';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import { calculateAge } from '../utils/ageUtils'; // For displaying age based on current date

const SwimmersPage: React.FC = () => {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [swimmerToDelete, setSwimmerToDelete] = useState<Swimmer | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth(); // Get current user

  const fetchSwimmersData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSwimmers();
      setSwimmers(data);
    } catch (err) {
      setError('Failed to load swimmers. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwimmersData();
  }, []);

  const handleDeleteClick = (swimmer: Swimmer) => {
    setSwimmerToDelete(swimmer);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (swimmerToDelete) {
      try {
        await apiDeleteSwimmer(swimmerToDelete.id);
        setSwimmers(prevSwimmers => prevSwimmers.filter(s => s.id !== swimmerToDelete.id));
        setIsDeleteModalOpen(false);
        setSwimmerToDelete(null);
      } catch (err) {
        setError(`Failed to delete swimmer: ${swimmerToDelete.name}.`);
        console.error(err);
      }
    }
  };
  
  const getDisplayAge = (dob: string): number => {
    // Calculate age based on current date for display on this page
    const today = new Date().toISOString().split('T')[0];
    return calculateAge(dob, today);
  };

  const processFileContentForImport = async (
    fileContent: string,
    updateFeedback: (feedback: Partial<ImportFeedback>) => void
  ): Promise<void> => {
    // This requires the user (club) to have a clubName in their profile
    if (!currentUser?.clubName) {
      updateFeedback({ generalError: "Cannot import: Your account is not associated with a club name.", status: 'error' });
      return;
    }

    let parsedData: ParsedSwimmerRow[] = [];
    try {
      parsedData = parseSwimmerCsv(fileContent);
    } catch (parseError: any) {
      updateFeedback({ generalError: parseError.message, status: 'error', successCount:0, skippedCount:0, rowErrors:[] });
      return;
    }

    if (parsedData.length === 0) {
      updateFeedback({ generalError: "No data rows found in CSV or file is empty.", status: 'completed', successCount:0, skippedCount:0, rowErrors:[] });
      return;
    }

    let currentSuccessCount = 0;
    let currentRowErrors: RowError[] = [];
    updateFeedback({ status: 'processing', successCount: 0, skippedCount: 0, rowErrors: [], generalError: undefined });

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const originalRowNumber = i + 2; 
      const rowErrors: string[] = [];
      const name = row.Name?.trim();
      const dob = row.DOB?.trim();
      const genderInput = row.Gender?.trim();
      const gradeLevel = row.GradeLevel?.trim() || undefined; // Get gradeLevel

      if (!name) rowErrors.push('Name is missing.');
      if (!dob) {
          rowErrors.push('DOB is missing.');
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(new Date(dob).getTime())) {
          rowErrors.push('DOB format is invalid (must be YYYY-MM-DD).');
      }
      
      let validGender: NewSwimmer['gender'] | null = null;
      if (!genderInput) rowErrors.push('Gender is missing.');
      else { 
        const lowerGender = genderInput.toLowerCase();
        if (lowerGender === 'male' || lowerGender === 'laki-laki' || lowerGender === 'l') validGender = 'Male';
        else if (lowerGender === 'female' || lowerGender === 'perempuan' || lowerGender === 'p') validGender = 'Female';
        else if (lowerGender === 'other') validGender = 'Other';
        else rowErrors.push("Gender must be 'Male', 'Female', or 'Other'.");
      }
      
      // Club name from CSV is now ignored, we use the logged-in user's club name.

      if (rowErrors.length > 0) {
        currentRowErrors.push({ rowNumber: originalRowNumber, rowData: Object.values(row).join(','), errors: rowErrors });
      } else {
        try {
          const newSwimmerData: NewSwimmer = { 
            name: name!, 
            dob: dob!, 
            gender: validGender!, 
            gradeLevel: gradeLevel, 
          };
          await addSwimmer(newSwimmerData);
          currentSuccessCount++;
        } catch (addError: any) {
          currentRowErrors.push({ rowNumber: originalRowNumber, rowData: Object.values(row).join(','), errors: [`API Error: ${addError.message || 'Failed to add swimmer'}`] });
        }
      }
       updateFeedback({ successCount: currentSuccessCount, rowErrors: [...currentRowErrors], skippedCount: currentRowErrors.length });
    }
    updateFeedback({ successCount: currentSuccessCount, skippedCount: currentRowErrors.length, rowErrors: currentRowErrors, status: 'completed' });
    if (currentSuccessCount > 0) fetchSwimmersData();
  };

  const canManageSwimmers = currentUser?.role === 'user';
  
  const canManageSwimmerRecord = (swimmer: Swimmer): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    if (currentUser.role === 'user' && swimmer.clubUserId === currentUser.id) return true;
    return false;
  };

  if (loading && !isImportModalOpen) {
    return <LoadingSpinner text="Loading swimmers..." />;
  }
  if (error && swimmers.length === 0 && !isImportModalOpen) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">{error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center">
        <div className='mb-4 sm:mb-0'>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">My Club's Swimmers</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">View and manage your swimmer profiles.</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 self-start sm:self-auto">
            {canManageSwimmers && (
              <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center"
                  aria-label="Import Swimmers"
              >
                  <UploadIcon className="h-5 w-5 mr-2" />
                  Import Swimmers
              </button>
            )}
            {canManageSwimmers && (
                <Link
                    to="/swimmers/add"
                    className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out flex items-center"
                    aria-label="Add New Swimmer"
                >
                    <PlusCircleIcon className="h-5 w-5 mr-2" />
                    Add New Swimmer
                </Link>
            )}
        </div>
      </header>

      {error && <div className="mb-4 text-center py-2 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-700 rounded-md">{error}</div>}

      <section className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-6">Swimmer List</h2>
        {swimmers.length === 0 && !loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="mb-2 text-xl">No swimmers found.</p>
            {canManageSwimmers && <p>Click "Add New Swimmer" or "Import Swimmers" to register.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Age (Current)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gender</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Grade Level</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {swimmers.map(swimmer => (
                  <tr key={swimmer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{swimmer.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{getDisplayAge(swimmer.dob)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmer.gender}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmer.clubName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{swimmer.gradeLevel || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                      {canManageSwimmerRecord(swimmer) ? (
                        <>
                          <button
                            onClick={() => navigate(`/swimmers/edit/${swimmer.id}`)}
                            className="text-primary-dark hover:text-primary p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light"
                            aria-label={`Edit ${swimmer.name}`}
                            title="Edit Swimmer"
                          >
                            <EditIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(swimmer)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label={`Delete ${swimmer.name}`}
                            title="Delete Swimmer"
                          >
                            <DeleteIcon className="h-5 w-5" />
                          </button>
                        </>
                      ) : (
                        <span className='text-xs text-gray-400 italic'>No permission</span>
                      )}
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManageSwimmers && (
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to delete the swimmer "{swimmerToDelete?.name}"? This action cannot be undone. All associated results may also be affected or orphaned.
          </p>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md">Cancel</button>
            <button type="button" onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">Delete</button>
          </div>
        </Modal>
      )}

      {canManageSwimmers && (
        <ImportSwimmersModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          processFileContent={processFileContentForImport}
        />
      )}
    </div>
  );
};

export default SwimmersPage;
