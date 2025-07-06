
import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardSummaryItemData } from '../../types';

interface SummaryCardProps {
  item: DashboardSummaryItemData;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ item }) => {
  return (
    <Link 
      to={item.linkTo} 
      className="block p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      <div className="flex items-center space-x-4 mb-3">
        <div className="p-3 bg-primary-light rounded-full">
          {item.icon}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {item.title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {item.value}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {item.description}
      </p>
    </Link>
  );
};

export default SummaryCard;