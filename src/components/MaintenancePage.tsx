import React from 'react';
import { Card } from './ui';

interface MaintenancePageProps {
  message?: string;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ 
  message = 'Hệ thống đang bảo trì. Vui lòng thử lại sau.' 
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="max-w-md w-full text-center p-8 shadow-xl">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
            <svg 
              className="w-10 h-10 text-yellow-600 dark:text-yellow-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Đang Bảo Trì
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {message}
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span>Hệ thống sẽ hoạt động trở lại sớm</span>
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Thử Lại
          </button>
        </div>
      </Card>
    </div>
  );
}; 