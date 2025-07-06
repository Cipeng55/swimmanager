
import React from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import EventFormPage from './pages/EventFormPage';
import SwimmersPage from './pages/SwimmersPage';
import SwimmerFormPage from './pages/SwimmerFormPage';
import ResultsPage from './pages/ResultsPage';
import ResultFormPage from './pages/ResultFormPage';
import EventProgramPage from './pages/EventProgramPage';
import EventResultsBookPage from './pages/EventResultsBookPage';
import LoginPage from './pages/LoginPage'; 
import UserManagementPage from './pages/UserManagementPage'; 
import PrivateRoute from './components/common/PrivateRoute'; 
import { useAuth } from './contexts/AuthContext'; 
import PrintableEventProgram from './components/printable/PrintableEventProgram';
import PrintableResultsBook from './components/printable/PrintableResultsBook';
import ClubStartingListPage from './pages/ClubStartingListPage'; 
import PrintableClubStartingList from './components/printable/PrintableClubStartingList';

// Layout component for pages that share the main Navbar and Footer
const MainAppLayout: React.FC = () => {
  const location = useLocation();
  // Print pages have their own minimal layout and don't need Navbar/Footer
  const isPrintPage = location.pathname.endsWith('/print');

  if (isPrintPage) {
    // Render print components without any surrounding layout chrome
    return <Outlet />;
  }

  // Regular pages get the full layout
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      <Navbar />
      <main className="flex-grow container mx-auto px-2 sm:px-4 py-8">
        <Outlet />
      </main>
      <footer className="bg-gray-200 dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-center p-4 border-t dark:border-gray-700">
        © {new Date().getFullYear()} Online Swim Manager
      </footer>
    </div>
  );
};


const App: React.FC = () => {
  const { currentUser } = useAuth(); 

  return (
    <Routes>
      {/* Standalone routes that don't use the main app layout */}
      <Route path="/login" element={<LoginPage />} />

      {/* All other routes are nested under MainAppLayout to get the common navbar/footer */}
      <Route element={<MainAppLayout />}>
        <Route 
          path="/" 
          element={currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} 
        />

        {/* Print Routes - they use the layout component, which handles their special case */}
        <Route path="/events/:eventId/program/print" element={<PrintableEventProgram />} />
        <Route path="/events/:eventId/results-book/print" element={<PrintableResultsBook />} />
        <Route path="/events/:eventId/club-starting-list/print" element={<PrintableClubStartingList />} />

        {/* Protected Routes - Accessible by all roles */}
        <Route element={<PrivateRoute allowedRoles={['superadmin', 'admin', 'user']} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:eventId/program" element={<EventProgramPage />} /> 
          <Route path="/events/:eventId/results-book" element={<EventResultsBookPage />} /> 
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/club-starting-list" element={<ClubStartingListPage />} /> 
        </Route>
        
        {/* User (Club) Only Routes for Swimmers and Results */}
        <Route element={<PrivateRoute allowedRoles={['user']} />}>
          <Route path="/swimmers" element={<SwimmersPage />} />
          <Route path="/swimmers/add" element={<SwimmerFormPage />} /> 
          <Route path="/swimmers/edit/:swimmerId" element={<SwimmerFormPage />} />
          <Route path="/results/add" element={<ResultFormPage />} />
          <Route path="/results/edit/:resultId" element={<ResultFormPage />} />
        </Route>

        {/* Admin (Event Organizer) Only Routes */}
        <Route element={<PrivateRoute allowedRoles={['admin']} />}>
          <Route path="/events/add" element={<EventFormPage />} />
          <Route path="/events/edit/:eventId" element={<EventFormPage />} />
        </Route>

        {/* Super Admin Only Routes */}
        <Route element={<PrivateRoute allowedRoles={['superadmin']} />}>
          <Route path="/users/manage" element={<UserManagementPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
      </Route>
    </Routes>
  );
};

export default App;
