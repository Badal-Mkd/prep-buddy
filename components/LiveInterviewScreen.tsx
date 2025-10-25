
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { connectLive } from '../services/geminiService';
import { PrepSettings } from '../types';
import { LiveServerMessage, LiveSession } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

interface LiveInterviewScreenProps {
  settings: PrepSettings;
  onBack: () => void;
}

interface TranscriptEntry {
  speaker: 'You' | 'Interviewer';
  text: string;
}

const MicrophoneIcon = ({ listening }: { listening: boolean }) => (
  <svg className={`w-16 h-16 text-white transition-all duration-300 ${listening ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
  </svg>
);


const LiveInterviewScreen: React.FC<LiveInterviewScreenProps> = ({ settings, onBack }) => {
  const [isLive, setIsLive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState('Not Started');
  
  const sessionRef = useRef<LiveSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const stopInterview = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if(scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if(sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();

    setIsLive(false);
    setStatus('Interview Ended');
  }, []);

  const startInterview = useCallback(async () => {
    if (isLive) return;

    setStatus('Requesting microphone access...');
    setTranscript([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setStatus('Connecting to AI...');
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;


      const sessionPromise = connectLive(settings, {
        onOpen: () => {
          setStatus('Connected. Start speaking.');
          setIsLive(true);
          sourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
          scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then((session) => {
              if (session) {
                session.sendRealtimeInput({ media: pcmBlob });
              }
            });
          };

          sourceRef.current.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
        },
        onMessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
                const outputCtx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
            }

            // Handle transcriptions
            if (message.serverContent?.outputTranscription) {
                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.inputTranscription) {
                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
                const userText = currentInputTranscriptionRef.current.trim();
                const modelText = currentOutputTranscriptionRef.current.trim();
                setTranscript(prev => {
                    const newTranscript = [...prev];
                    if (userText) newTranscript.push({ speaker: 'You', text: userText });
                    if (modelText) newTranscript.push({ speaker: 'Interviewer', text: modelText });
                    return newTranscript;
                });
                currentInputTranscriptionRef.current = '';
                currentOutputTranscriptionRef.current = '';
            }
        },
        onError: (e: ErrorEvent) => {
          console.error('Live session error:', e);
          setStatus('An error occurred. Please try again.');
          stopInterview();
        },
        onClose: () => {
          setStatus('Connection closed.');
          stopInterview();
        },
      });
      sessionRef.current = await sessionPromise;

    } catch (error) {
      console.error('Failed to start interview:', error);
      setStatus('Could not access microphone. Please check permissions.');
    }
  }, [isLive, settings, stopInterview]);

  useEffect(() => {
    return () => {
      stopInterview();
    };
  }, [stopInterview]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 flex flex-col h-[85vh]">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">Live Interview</h1>
          <p className="text-gray-400 mt-1">{status}</p>
        </div>

        <div className="flex-grow bg-gray-900/50 rounded-lg p-4 overflow-y-auto border border-gray-700 mb-6 min-h-0">
          <div className="space-y-4">
            {transcript.map((entry, index) => (
              <div key={index} className={`flex ${entry.speaker === 'You' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xl px-4 py-2 rounded-xl ${entry.speaker === 'You' ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-white'}`}>
                  <p className="font-bold text-sm">{entry.speaker}</p>
                  <p>{entry.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center mb-6">
            <MicrophoneIcon listening={isLive}/>
        </div>

        <div className="flex justify-center items-center gap-4">
          <button onClick={onBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition">
            Back to Menu
          </button>
          {!isLive ? (
            <button onClick={startInterview} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition">
              Start Interview
            </button>
          ) : (
            <button onClick={stopInterview} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition">
              End Interview
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveInterviewScreen;
