
export enum InterviewMode {
  MCQ = 'MCQ',
  QA = 'Question & Answer',
  BOTH = 'Both',
  LIVE = 'Live HR Interview'
}

export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export interface PrepSettings {
  technology: string;
  difficulty: Difficulty;
  mode: InterviewMode;
  timeLimit: number;
}

export interface MCQOption {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  question: string;
  type: 'mcq' | 'qa';
  options?: MCQOption[];
  answer: string;
}

export interface AnsweredQuestion {
  question: Question;
  userAnswer: string | MCQOption;
  isCorrect: boolean;
  isPartiallyCorrect?: boolean;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  }
}