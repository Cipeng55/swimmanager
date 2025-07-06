
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import LoadingSpinner from './LoadingSpinner';

interface PrivateRouteProps {
  allowedRoles?: UserRole[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ allowedRoles }) => {
  const { currentUser, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return <LoadingSpinner text="Authenticating..." />;
  }

  if (!currentUser) {
    // Not logged in, redirect to login page
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Logged in, but role not allowed for this route
    // You could redirect to an "Unauthorized" page or back to dashboard
    return <Navigate to="/dashboard" state={{ unauthorized: true }} replace />;
  }

  return <Outlet />; // User is authenticated and authorized
};

export default PrivateRoute;