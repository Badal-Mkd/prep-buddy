import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { Difficulty, InterviewMode, PrepSettings, Question, MCQOption, AnsweredQuestion } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateQuestions(settings: PrepSettings): Promise<{ questions: any[], sources: any[] }> {
  const { technology, difficulty, mode, timeLimit } = settings;

  let questionTypes = '';
  if (mode === InterviewMode.MCQ) questionTypes = 'multiple-choice questions';
  else if (mode === InterviewMode.QA) questionTypes = 'open-ended questions and answers';
  else questionTypes = 'a mix of multiple-choice and open-ended questions';

  let numQuestions: number;
  switch (timeLimit) {
    case 1: numQuestions = 7; break;
    case 3: numQuestions = 15; break;
    case 5: numQuestions = 30; break;
    case 10: numQuestions = 40; break;
    case 15: numQuestions = 50; break;
    case 20: numQuestions = 60; break;
    default: numQuestions = 15; // A sensible default
  }

  const prompt = `
    You are an expert technical interviewer. Generate ${numQuestions} interview questions for a ${difficulty} level ${technology} position.
    The questions should be ${questionTypes}.

    Respond ONLY with a valid JSON array of objects in the following format. Do not include any other text, markdown formatting, or explanations.

    The JSON format must be:
    [
      {
        "question": "The question text.",
        "type": "mcq" | "qa",
        "options": [ // Only for 'mcq' type, otherwise null
          { "text": "Option A", "isCorrect": false },
          { "text": "Option B", "isCorrect": true },
          { "text": "Option C", "isCorrect": false },
          { "text": "Option D", "isCorrect": false }
        ],
        "answer": "For 'qa' type, the detailed answer. For 'mcq' type, the text of the correct option."
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    
    let jsonString = response.text.trim();
    const startIndex = jsonString.indexOf('[');
    const endIndex = jsonString.lastIndexOf(']');
    if (startIndex !== -1 && endIndex !== -1) {
      jsonString = jsonString.substring(startIndex, endIndex + 1);
    } else {
        throw new Error("Could not find a valid JSON array in the response.");
    }

    const questions = JSON.parse(jsonString);
    return { questions, sources };

  } catch (error) {
    console.error("Error generating questions:", error);
    throw new Error("Failed to generate questions. The response from the model might not be valid JSON.");
  }
}

export async function evaluateAnswer(question: string, correctAnswer: string, userAnswer: string): Promise<string> {
  const prompt = `
    As an expert technical interviewer, evaluate the user's answer to the following interview question.
    The goal is to provide constructive feedback.

    Question: "${question}"

    Ideal Answer: "${correctAnswer}"

    User's Answer: "${userAnswer}"

    Evaluation criteria:
    1. Correctness: Is the user's answer technically correct?
    2. Completeness: Does the answer cover all key aspects?
    3. Clarity: Is the answer well-explained and easy to understand?

    Based on these criteria, provide a brief evaluation in one or two sentences. Start your evaluation with "Correct.", "Partially Correct.", or "Incorrect.".
    For example: "Correct. Your answer accurately explains the concept and provides a good example." or "Partially Correct. You've identified the main point, but missed explaining the performance implications." or "Incorrect. The answer confuses concept A with concept B."

    Respond ONLY with the evaluation text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return "Sorry, I couldn't evaluate your answer at the moment.";
  }
}

export async function generateAnswerExplanation(answeredQuestion: AnsweredQuestion): Promise<string> {
  const { question, userAnswer, isCorrect } = answeredQuestion;
  const userAnswerText = typeof userAnswer === 'string' ? userAnswer : userAnswer.text;

  let prompt: string;

  if (isCorrect) {
    prompt = `
      An interview candidate was asked the following question:
      Question: "${question.question}"

      They correctly answered: "${userAnswerText}"

      The ideal answer is: "${question.answer}"

      Please provide a simple, best, and clear explanation for why their answer is correct.
      Keep it concise and easy to understand for someone learning this topic.

      Respond ONLY with the explanation.
    `;
  } else {
    prompt = `
      An interview candidate was asked the following question:
      Question: "${question.question}"

      They incorrectly answered: "${userAnswerText}"

      The correct answer is: "${question.answer}"

      Please provide the correct answer along with a simple, best, and clear explanation of the concept.
      Focus on helping the user understand why the correct answer is right.

      Respond ONLY with the explanation.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating explanation:", error);
    return "Sorry, I couldn't generate an explanation at this moment.";
  }
}

export async function generateFeedback(technology: string, incorrectQuestions: Question[]): Promise<string> {
  if (incorrectQuestions.length === 0) {
    return "Great job! No incorrect answers to review.";
  }

  const questionsList = incorrectQuestions.map(q => `- Question: ${q.question}\n  - Correct Answer: ${q.answer}`).join('\n');

  const prompt = `
    As an expert technical interviewer and coach, analyze the user's performance on a ${technology} interview quiz.
    The user answered the following questions incorrectly:
    ${questionsList}

    Based on these mistakes, provide a few simple, actionable tips on which specific topics or concepts the user should focus on to improve.
    Frame your feedback in a positive and encouraging tone.
    Organize the tips as a short, easy-to-read bulleted list (using '*' for bullets). Limit it to 2-4 key points.

    Respond ONLY with the feedback text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating feedback:", error);
    return "Sorry, I couldn't generate feedback at this moment.";
  }
}


export function connectLive(
  settings: PrepSettings,
  callbacks: {
    onOpen: () => void;
    onMessage: (message: LiveServerMessage) => void;
    onError: (e: ErrorEvent) => void;
    onClose: (e: CloseEvent) => void;
  }
): Promise<LiveSession> {
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: callbacks.onOpen,
      onmessage: callbacks.onMessage,
      onerror: callbacks.onError,
      onclose: callbacks.onClose,
    },
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      systemInstruction: `You are an experienced HR interviewer conducting a behavioral and technical interview for a ${settings.difficulty} level ${settings.technology} role. Ask a mix of questions. Keep your responses concise, friendly, and conversational. Start by introducing yourself and then ask the first question.`,
    },
  });
}