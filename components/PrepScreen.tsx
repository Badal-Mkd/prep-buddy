
import React, { useState, useEffect, useCallback } from 'react';
import { generateQuestions, evaluateAnswer, generateFeedback, generateAnswerExplanation } from '../services/geminiService';
import { PrepSettings, Question, GroundingSource, MCQOption, AnsweredQuestion } from '../types';

interface PrepScreenProps {
  settings: PrepSettings;
  onBack: () => void;
}

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col justify-center items-center h-full">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-500"></div>
    <p className="mt-4 text-gray-400">Generating your personalized questions...</p>
  </div>
);

const QuestionReview: React.FC<{ answeredQuestion: AnsweredQuestion }> = ({ answeredQuestion }) => {
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

    const handleGetExplanation = async () => {
        if (explanation) { // Toggle visibility
            setExplanation(null);
            return;
        }
        setIsLoadingExplanation(true);
        try {
            const result = await generateAnswerExplanation(answeredQuestion);
            setExplanation(result);
        } catch (e) {
            setExplanation("Could not fetch explanation.");
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    const userAnswerText = typeof answeredQuestion.userAnswer === 'string'
        ? answeredQuestion.userAnswer
        : answeredQuestion.userAnswer.text;

    const correctnessClass = answeredQuestion.isCorrect ? 'border-green-600' : 'border-red-600';
    
    return (
        <div className={`bg-gray-800/50 p-4 rounded-lg border ${correctnessClass}`}>
            <p className="font-semibold text-white mb-2">{answeredQuestion.question.question}</p>
            <p className="text-sm text-gray-400">
                <span className="font-bold">Your answer: </span>{userAnswerText}
            </p>
            {!answeredQuestion.isCorrect && (
                <p className="text-sm text-green-400 mt-1">
                    <span className="font-bold">Correct answer: </span>{answeredQuestion.question.answer}
                </p>
            )}
            <button
                onClick={handleGetExplanation}
                disabled={isLoadingExplanation}
                className="text-indigo-400 hover:text-indigo-300 text-sm mt-3 disabled:text-gray-500"
            >
                {isLoadingExplanation ? 'Loading...' : explanation ? 'Hide Explanation' : 'Show AI Explanation'}
            </button>
            {explanation && (
                <div className="mt-3 pt-3 border-t border-gray-700 text-gray-300 text-sm whitespace-pre-wrap">
                    {explanation}
                </div>
            )}
        </div>
    );
};


const PrepScreen: React.FC<PrepScreenProps> = ({ settings, onBack }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<MCQOption | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(settings.timeLimit * 60);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { questions: fetchedQuestions, sources: fetchedSources } = await generateQuestions(settings);
      setQuestions(shuffleArray(fetchedQuestions));
      setSources(fetchedSources);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [settings]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);
  
  useEffect(() => {
    if (loading || sessionFinished) return;
    if (timeLeft <= 0) {
        setSessionFinished(true);
        return;
    }
    const timerId = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, loading, sessionFinished]);

  useEffect(() => {
    const getFeedback = async () => {
      if (sessionFinished && answeredQuestions.length > 0) {
        const incorrectQuestions = answeredQuestions
          .filter(aq => !aq.isCorrect)
          .map(aq => aq.question);

        if (incorrectQuestions.length > 0) {
          setIsGeneratingFeedback(true);
          try {
            const feedbackText = await generateFeedback(settings.technology, incorrectQuestions);
            setFeedback(feedbackText);
          } catch (e) {
            setFeedback("Could not generate feedback at this time.");
          } finally {
            setIsGeneratingFeedback(false);
          }
        }
      }
    };
    getFeedback();
  }, [sessionFinished, answeredQuestions, settings.technology]);

  const handleOptionSelect = (option: MCQOption) => {
    if (showAnswer) return;

    const currentQuestion = questions[currentIndex];
    setSelectedOption(option);
    setShowAnswer(true);

    const isCorrect = option.isCorrect;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setAnsweredQuestions(prev => [
      ...prev,
      {
        question: currentQuestion,
        userAnswer: option,
        isCorrect: isCorrect,
      }
    ]);
  };

  const handleAnswerSubmit = async () => {
    const currentQuestion = questions[currentIndex];
    if (!userAnswer || !currentQuestion) return;

    setIsEvaluating(true);
    setEvaluationResult(null);
    try {
        const result = await evaluateAnswer(currentQuestion.question, currentQuestion.answer, userAnswer);
        setEvaluationResult(result);
        const isCorrect = result.startsWith('Correct');
        const isPartiallyCorrect = result.startsWith('Partially Correct');

        if (isCorrect) {
            setScore(prev => prev + 1);
        }

        setAnsweredQuestions(prev => [
            ...prev,
            {
                question: currentQuestion,
                userAnswer: userAnswer,
                isCorrect: isCorrect,
                isPartiallyCorrect: isPartiallyCorrect,
            }
        ]);
        setShowAnswer(true);
    } catch (e) {
        console.error("Evaluation error:", e);
        setEvaluationResult("Sorry, an error occurred while evaluating your answer.");
    } finally {
        setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setShowAnswer(false);
      setUserAnswer('');
      setEvaluationResult(null);
    } else {
        setSessionFinished(true);
    }
  };
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl text-red-500 mb-4">An Error Occurred</h2>
        <p className="text-gray-400 mb-6 max-w-md">{error}</p>
        <button onClick={onBack} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">
          Back to Menu
        </button>
      </div>
    );
  }
  
  if (sessionFinished) {
    const totalQuestionsAnswered = answeredQuestions.length;
    const percentage = totalQuestionsAnswered > 0 ? Math.round((score / totalQuestionsAnswered) * 100) : 0;
    
    return (
        <div className="min-h-screen bg-gray-900 p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-700">
                <h2 className="text-3xl font-bold text-center text-white mb-2">Session Finished!</h2>
                <p className="text-center text-gray-400 mb-6">Here's your performance summary.</p>

                <div className="text-center bg-gray-900/50 p-6 rounded-xl mb-8">
                    <p className="text-lg text-gray-300">Your Score</p>
                    <p className="text-6xl font-bold text-indigo-400 my-2">{percentage}%</p>
                    <p className="text-gray-400">{score} out of {totalQuestionsAnswered} questions correct</p>
                </div>

                <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-4">AI Feedback & Tips</h3>
                    <div className="bg-gray-900/50 p-4 rounded-lg text-gray-300 whitespace-pre-wrap">
                        {isGeneratingFeedback ? 'Generating feedback...' : feedback || "No incorrect answers to provide feedback on. Great job!"}
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Review Your Answers</h3>
                    <div className="space-y-4">
                        {answeredQuestions.map((aq, index) => (
                            <QuestionReview key={index} answeredQuestion={aq} />
                        ))}
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <button onClick={onBack} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-transform duration-200 transform hover:scale-105">
                        Back to Menu
                    </button>
                </div>
            </div>
        </div>
    );
  }
  
  const currentQuestion = questions[currentIndex];
  
  if (!currentQuestion) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <p className="text-gray-400 mb-4">No questions were generated. This might be due to a strict model safety filter.</p>
        <button onClick={onBack} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">
          Back to Menu
        </button>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-400">Question {currentIndex + 1} of {questions.length}</p>
          <div className="bg-indigo-500 text-white text-lg font-bold px-4 py-2 rounded-lg">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-6">
          <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}></div>
        </div>

        <h2 className="text-2xl font-semibold mb-6 text-white">{currentQuestion.question}</h2>

        {currentQuestion.type === 'mcq' ? (
          <div className="space-y-3">
            {currentQuestion.options?.map((option, index) => {
              const isSelected = selectedOption?.text === option.text;
              let buttonClass = 'bg-gray-700 hover:bg-gray-600';
              if (showAnswer) {
                if (option.isCorrect) {
                  buttonClass = 'bg-green-600';
                } else if (isSelected && !option.isCorrect) {
                  buttonClass = 'bg-red-600';
                } else {
                   buttonClass = 'bg-gray-700 opacity-50';
                }
              } else if (isSelected) {
                buttonClass = 'bg-indigo-600';
              }
              return (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  disabled={showAnswer}
                  className={`w-full text-left p-4 rounded-lg transition-all duration-200 text-white ${buttonClass}`}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4">
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer here..."
              disabled={showAnswer}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 h-32 focus:ring-2 focus:ring-indigo-500 transition disabled:opacity-70"
            />
            {!showAnswer && (
              <button
                onClick={handleAnswerSubmit}
                disabled={isEvaluating || !userAnswer}
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 text-lg rounded-lg transition-transform duration-200 ease-in-out transform hover:scale-105 shadow-lg disabled:bg-gray-500 disabled:scale-100"
              >
                {isEvaluating ? 'Evaluating...' : 'Submit Answer'}
              </button>
            )}
            {evaluationResult && (
              <p className="mt-3 text-sm text-gray-300 whitespace-pre-wrap p-3 bg-gray-900/50 rounded-md">{evaluationResult}</p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between items-center">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition">
            &larr; Back to Menu
          </button>

          {showAnswer && (
            <button
              onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-transform duration-200 transform hover:scale-105"
            >
              {currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrepScreen;
