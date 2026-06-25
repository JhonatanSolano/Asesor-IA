
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
    <form onSubmit={handleSubmit} className="flex min-w-0 items-center gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={isLoading ? "El tutor está pensando..." : "Escribe tu pregunta, tema o instrucción..."}
        disabled={isLoading}
        className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-3 text-sm transition duration-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 sm:text-base"
        aria-label="Chat input"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500 text-white transition duration-200 hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-400 sm:h-12 sm:w-12"
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
