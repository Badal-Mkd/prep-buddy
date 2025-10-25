import React, { useState } from 'react';
import { TECHNOLOGIES, DIFFICULTIES, INTERVIEW_MODES, TIME_LIMITS } from '../constants';
import { Difficulty, InterviewMode, PrepSettings } from '../types';

interface SetupScreenProps {
  onStart: (settings: PrepSettings) => void;
}

// FIX: Redefined `OptionButton` as a standard function to fix a TSX parsing error with generics.
// The previous arrow function syntax `<T>({...})` was ambiguous in a .tsx file.
// This also allowed for stricter type checking on props, removing the need for `any`.
function OptionButton<T>({ value, selectedValue, setSelectedValue, children }: { value: T; selectedValue: T; setSelectedValue: (value: T) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => setSelectedValue(value)}
      className={`px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-md ${
        selectedValue === value
          ? 'bg-indigo-600 text-white shadow-lg'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [technology, setTechnology] = useState(TECHNOLOGIES[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [mode, setMode] = useState<InterviewMode>(InterviewMode.MCQ);
  const [timeLimit, setTimeLimit] = useState<number>(TIME_LIMITS[2]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ technology, difficulty, mode, timeLimit });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Prep Buddy</h1>
          <p className="text-lg text-gray-400">Your AI-powered interview co-pilot</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="technology" className="block text-lg font-medium text-gray-300 mb-3">
              1. Select Technology
            </label>
            <select
              id="technology"
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            >
              {TECHNOLOGIES.map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-300 mb-3">2. Choose Difficulty</label>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((d) => (
                <OptionButton key={d} value={d} selectedValue={difficulty} setSelectedValue={setDifficulty}>
                  {d}
                </OptionButton>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-lg font-medium text-gray-300 mb-3">3. Select Time Limit (Minutes)</label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {TIME_LIMITS.map((t) => (
                <OptionButton key={t} value={t} selectedValue={timeLimit} setSelectedValue={setTimeLimit}>
                  {t} min
                </OptionButton>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-lg font-medium text-gray-300 mb-3">4. Select Mode</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {INTERVIEW_MODES.map((m) => (
                <OptionButton key={m} value={m} selectedValue={mode} setSelectedValue={setMode}>
                  {m}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 text-lg rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105 shadow-lg"
            >
              Start Prep
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
