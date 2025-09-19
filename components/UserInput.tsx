
import React, { useState } from 'react';

interface UserInputProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

const UserInput: React.FC<UserInputProps> = ({ onSubmit, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSubmit(inputValue);
      setInputValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={isLoading ? "El Pana está pensando..." : "Escribe tu respuesta aquí..."}
        disabled={isLoading}
        className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 transition duration-200"
        aria-label="Chat input"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="bg-green-500 text-white rounded-full p-3 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center"
        aria-label="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  );
};

export default UserInput;