
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 rounded-full animate-pulse bg-green-500"></div>
        <div className="w-4 h-4 rounded-full animate-pulse bg-green-500" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-4 h-4 rounded-full animate-pulse bg-green-500" style={{ animationDelay: '0.4s' }}></div>
        <span className="text-gray-500 ml-2">El Pana está pensando...</span>
      </div>
    </div>
  );
};

export default Spinner;
