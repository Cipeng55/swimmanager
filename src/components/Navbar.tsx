import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SwimmingIcon } from './icons/SwimmingIcon';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, logout, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
    `block py-2 pr-4 pl-3 duration-150 rounded md:rounded-none ${
      isActive
        ? 'text-white bg-primary md:bg-transparent md:text-primary-dark dark:md:text-primary'
        : 'text-gray-700 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-primary-dark dark:text-gray-300 md:dark:hover:text-primary dark:hover:bg-gray-700 dark:hover:text-white'
    } md:p-0 dark:border-gray-700`;

  const buttonClass = "w-full text-left md:w-auto px-3 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-primary-dark dark:hover:text-primary";

  return (
    <nav className="bg-white border-gray-200 px-2 sm:px-4 py-2.5 shadow-md dark:bg-gray-800">
      <div className="container flex flex-wrap justify-between items-center mx-auto">
        <NavLink to="/" className="flex items-center">
          <SwimmingIcon className="h-8 w-8 mr-3 text-primary" />
          <div className="flex flex-col">
            <span className="self-center text-xl font-semibold whitespace-nowrap text-gray-800 dark:text-white">
              Swim Manager
            </span>
             {currentUser && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{currentUser.clubName}</span>
             )}
          </div>
        </NavLink>
        <button
          onClick={() => setIsOpen(!isOpen)}
          type="button"
          className="inline-flex items-center p-2 ml-3 text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          aria-controls="mobile-menu"
          aria-expanded={isOpen}
        >
          <span className="sr-only">Open main menu</span>
          {/* Hamburger Icon */}
          <svg className={`w-6 h-6 ${isOpen ? 'hidden' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path></svg>
          {/* Close Icon */}
          <svg className={`w-6 h-6 ${isOpen ? '' : 'hidden'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
        </button>
        <div
          className={`${isOpen ? 'block' : 'hidden'} w-full md:block md:w-auto`}
          id="mobile-menu"
        >
          <ul className="flex flex-col mt-4 md:flex-row md:items-center md:space-x-2 md:mt-0 md:text-sm md:font-medium">
            {!isLoadingAuth && currentUser && (
              <>
                <li><NavLink to="/dashboard" className={navLinkClass} onClick={()=>setIsOpen(false)} end>Dashboard</NavLink></li>
                <li><NavLink to="/events" className={navLinkClass} onClick={()=>setIsOpen(false)}>Events</NavLink></li>
                <li><NavLink to="/swimmers" className={navLinkClass} onClick={()=>setIsOpen(false)}>Swimmers</NavLink></li>
                <li><NavLink to="/results" className={navLinkClass} onClick={()=>setIsOpen(false)}>Results</NavLink></li>
                <li><NavLink to="/club-starting-list" className={navLinkClass} onClick={()=>setIsOpen(false)}>Club Starting List</NavLink></li> 
                {(currentUser.role === 'superadmin' || currentUser.role === 'admin') && (
                  <li><NavLink to="/users/manage" className={navLinkClass} onClick={()=>setIsOpen(false)}>Manage Accounts</NavLink></li>
                )}
              </>
            )}
            {!isLoadingAuth && (
                 currentUser ? (
                    <li>
                        <button onClick={() => { handleLogout(); setIsOpen(false); }} className={buttonClass}>
                        Logout ({currentUser.username})
                        </button>
                    </li>
                    ) : (
                    <div className="flex items-center space-x-2">
                        <li>
                            <NavLink to="/login" className={navLinkClass} onClick={()=>setIsOpen(false)}>Login</NavLink>
                        </li>
                    </div>
                    )
            )}
            {isLoadingAuth && <li><span className="block py-2 px-3 text-gray-400">Loading...</span></li>}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;