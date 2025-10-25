import React, { useState } from 'react';
import { DIFFICULTIES, TECHNOLOGIES, TIME_LIMITS } from './constants';
import LiveInterviewScreen from './components/LiveInterviewScreen';
import PrepScreen from './components/PrepScreen';
import SetupScreen from './components/SetupScreen';
import { InterviewMode, PrepSettings } from './types';


const App: React.FC = () => {
  type Screen = 'setup' | 'prep' | 'live';
  const [currentScreen, setCurrentScreen] = useState<Screen>('setup');
  const [settings, setSettings] = useState<PrepSettings>({
    technology: TECHNOLOGIES[0],
    difficulty: DIFFICULTIES[0],
    mode: InterviewMode.MCQ,
    timeLimit: TIME_LIMITS[2], // Default to 5 minutes
  });

  const handleStart = (selectedSettings: PrepSettings) => {
    setSettings(selectedSettings);
    if (selectedSettings.mode === InterviewMode.LIVE) {
      setCurrentScreen('live');
    } else {
      setCurrentScreen('prep');
    }
  };

  const handleBackToMenu = () => {
    setCurrentScreen('setup');
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'setup':
        return <SetupScreen onStart={handleStart} />;
      case 'prep':
        return <PrepScreen settings={settings} onBack={handleBackToMenu} />;
      case 'live':
        return <LiveInterviewScreen settings={settings} onBack={handleBackToMenu} />;
      default:
        return <SetupScreen onStart={handleStart} />;
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      {renderScreen()}
    </div>
  );
};

export default App;