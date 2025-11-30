
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getGeminiAnswerFromAudio } from './services/geminiService';
import { ScreenShareIcon, MicIcon, BrainIcon, InfoIcon } from './components/Icons';

type HistoryEntry = {
    id: number;
    question: string;
    answer: string;
    isThinking: boolean;
};

// Helper component for displaying status
const StatusIndicator: React.FC<{ icon: React.ReactNode; text: string; color: string; pulse?: boolean }> = ({ icon, text, color, pulse }) => (
  <div className={`flex items-center space-x-3 p-3 rounded-lg bg-slate-700/50`}>
    <div className={`${color} ${pulse ? 'animate-pulse' : ''}`}>{icon}</div>
    <span className="text-lg font-medium text-slate-300">{text}</span>
  </div>
);

// Helper component for the answer display with a typing effect
const AnswerDisplay: React.FC<{ answer: string; isThinking: boolean }> = ({ answer, isThinking }) => {
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  
  useEffect(() => {
    if (isThinking) {
      setDisplayedAnswer('');
      return;
    }

    if (answer === displayedAnswer) return;

    let i = 0;
    const interval = setInterval(() => {
      setDisplayedAnswer(answer.slice(0, i));
      i++;
      if (i > answer.length) {
        clearInterval(interval);
      }
    }, 15); 
    return () => clearInterval(interval);
  }, [answer, isThinking]);
  
  return (
    <div className="prose prose-invert prose-lg max-w-none text-slate-200">
      {isThinking ? '...' : displayedAnswer}
      {!isThinking && displayedAnswer.length > 0 && displayedAnswer.length === answer.length && <span className="inline-block w-1 h-6 bg-cyan-400 animate-ping ml-1"></span>}
    </div>
  );
};
const MemoizedAnswerDisplay = React.memo(AnswerDisplay);


// Main App Component
export default function App() {
  const [isSharing, setIsSharing] = useState(false);
  const [statusText, setStatusText] = useState("Session not started");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDataRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  
  const isThinkingRef = useRef(false);
  const isSharingRef = useRef(isSharing);

  useEffect(() => { 
      isThinkingRef.current = history.some(h => h.isThinking);
      isSharingRef.current = isSharing;
      historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isSharing]);

  const processCapturedAudio = useCallback(async () => {
    // Take a snapshot of the current audio chunks and then clear the main buffer
    const audioChunks = [...audioDataRef.current];
    audioDataRef.current = [];

    // Filter out very short audio bursts (less than 1s usually implies noise)
    if (audioChunks.length < 3) return; 

    let newEntryId = -1;
    const historyForContext = history
        .filter(entry => !entry.isThinking && entry.question && entry.answer && entry.question !== "..." && entry.question !== "Detecting question...")
        .map(({ question, answer }) => ({ question, answer }));


    setHistory(prev => {
        newEntryId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 0;
        return [...prev, { id: newEntryId, question: 'Detecting question...', answer: '', isThinking: true }];
    });

    setStatusText("Processing audio...");
    
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const audioBlob = new Blob(audioChunks, { type: mimeType });

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      try {
        const base64data = (reader.result as string).split(',')[1];
        const { question, answer } = await getGeminiAnswerFromAudio(base64data, mimeType, historyForContext);
        
        // If the API returns "..." it means it didn't hear a question. 
        // We remove the entry to keep the UI clean.
        if (question === "..." || question === "NO_AUDIO") {
             setHistory(prev => prev.filter(item => item.id !== newEntryId));
             setStatusText(isSharingRef.current ? "Listening for questions..." : "Session ended");
        } else {
             setHistory(prev => prev.map(item => item.id === newEntryId ? { ...item, question, answer, isThinking: false } : item));
             setStatusText(isSharingRef.current ? "Listening for questions..." : "Session ended");
        }

      } catch (err) {
        console.error("Error in processAudio/Gemini call:", err);
        // Remove the entry on error too
        setHistory(prev => prev.filter(item => item.id !== newEntryId));
      } 
    };
    reader.onerror = (err) => {
        console.error("FileReader error:", err);
        setHistory(prev => prev.filter(item => item.id !== newEntryId));
    }
  }, [history]); 

  const processAudioRef = useRef(processCapturedAudio);
  useEffect(() => {
    processAudioRef.current = processCapturedAudio;
  }, [processCapturedAudio]);


  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    audioContextRef.current = null;

    setIsSharing(false);
    setStatusText("Session ended. Start new session to clear log.");
    setError(null);
  }, []);

  const startSharing = useCallback(async () => {
    setHistory([]);
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setError("No audio track found. Please share your tab with 'Tab audio' enabled.");
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      setIsSharing(true);
      setStatusText("Listening for questions...");
      
      const audioStream = new MediaStream(audioTracks);

      const options = { mimeType: 'audio/webm;codecs=opus' };
      const recorder = new MediaRecorder(audioStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioDataRef.current.push(event.data);
      };

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 512;
      analyser.minDecibels = -50; // slightly reduced sensitivity
      analyser.smoothingTimeConstant = 0.8; // smoother analysis
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let isSpeaking = false;
      const SILENCE_DELAY = 2500; // INCREASED: Wait 2.5s of silence before processing (prevents cutting off mid-sentence)
      const SPEAKING_THRESHOLD = 30; // INCREASED: Higher threshold to ignore background hum

      const VOICE_FREQ_MIN = 300;
      const VOICE_FREQ_MAX = 3400;
      const sampleRate = audioContext.sampleRate;
      const minBinIndex = Math.ceil(VOICE_FREQ_MIN / (sampleRate / analyser.fftSize));
      const maxBinIndex = Math.floor(VOICE_FREQ_MAX / (sampleRate / analyser.fftSize));
      
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = () => {
        if (!isSharingRef.current) {
            scriptProcessor.disconnect();
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        
        const voiceBins = dataArray.slice(minBinIndex, maxBinIndex);
        const voiceSum = voiceBins.reduce((a, b) => a + b, 0);
        const voiceAvg = voiceSum / (maxBinIndex - minBinIndex);

        if (voiceAvg > SPEAKING_THRESHOLD) {
            if (!isSpeaking) {
                isSpeaking = true;
                // Recorder is already running
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else {
            if (isSpeaking) {
                if (!silenceTimerRef.current && !isThinkingRef.current) {
                    silenceTimerRef.current = window.setTimeout(() => {
                        isSpeaking = false;
                        processAudioRef.current();
                        silenceTimerRef.current = null;
                    }, SILENCE_DELAY);
                }
            }
        }
      };
      
      stream.getVideoTracks()[0].onended = () => {
          scriptProcessor.onaudioprocess = null;
          cleanup();
      };
      
      // Start recording immediately
      audioDataRef.current = [];
      recorder.start(100);

    } catch (err: any) {
      console.error("Error starting screen share:", err);
      if (err.name === 'NotAllowedError') {
        setError("Permission to share screen was denied.");
      } else {
        setError("Could not start screen sharing.");
      }
      cleanup();
    }
  }, [cleanup]);


  return (
    <div className="bg-slate-900 text-white min-h-screen lg:h-screen lg:overflow-y-hidden font-sans flex flex-col">
      <header className="p-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-center text-cyan-400">
          Live Interview Co-Pilot
        </h1>
      </header>

      <main className="flex-grow p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start lg:min-h-0">
        <div className="flex flex-col space-y-6 bg-slate-800 p-6 rounded-xl shadow-lg h-full">
          {!isSharing && history.length === 0 ? (
             <div className="flex flex-col items-center space-y-6">
                <button
                    onClick={startSharing}
                    className="flex items-center space-x-3 px-8 py-4 bg-cyan-500 text-slate-900 font-bold rounded-full text-xl hover:bg-cyan-400 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                    <ScreenShareIcon className="h-8 w-8" />
                    <span>Start Session</span>
                </button>
                 <div className="flex items-start space-x-3 p-4 rounded-lg bg-blue-900/50 border border-blue-700 text-blue-200">
                    <InfoIcon className="h-10 w-10 flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="font-bold text-lg">How it works:</h3>
                        <p className="text-sm">1. Click "Start Session" and share your meeting tab.</p>
                        <p className="text-sm">2. **Crucially**, enable the "Share tab audio" option.</p>
                        <p className="text-sm">3. The AI will wait for a 3-second silence before answering.</p>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 text-center">
                <h2 className="text-2xl font-semibold text-slate-200">{isSharing ? "Session Active" : "Session Ended"}</h2>
                <p className="text-slate-400">{isSharing ? "Listening for questions..." : "Review the log below or start a new session."}</p>
                 {!isSharing && history.length > 0 && (
                     <button
                        onClick={startSharing}
                        className="flex items-center space-x-3 px-6 py-3 mt-4 bg-cyan-600 text-slate-900 font-bold rounded-full text-lg hover:bg-cyan-500 transition-all duration-300 transform hover:scale-105 shadow-md"
                    >
                        <ScreenShareIcon className="h-6 w-6" />
                        <span>Start New Session</span>
                    </button>
                 )}
            </div>
          )}

          <div className="space-y-4">
            <StatusIndicator icon={<MicIcon className="h-6 w-6" />} text={statusText} color={isSharing ? "text-green-400" : "text-slate-400"} />
            <StatusIndicator icon={<BrainIcon className="h-6 w-6" />} text={isThinkingRef.current ? "Generating Answer..." : "Standing By"} color={isThinkingRef.current ? "text-purple-400" : "text-slate-400"} pulse={isThinkingRef.current} />
          </div>

          {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-lg mt-auto">{error}</div>}
        </div>

        <div className="bg-slate-800 p-6 rounded-xl shadow-lg h-full min-h-[400px] flex flex-col">
          <h2 className="text-3xl font-bold mb-4 text-cyan-400 border-b-2 border-cyan-500/30 pb-2">Co-Pilot Log</h2>
          <div className="flex-grow overflow-y-auto pr-2 space-y-6">
            {history.length === 0 && (
                <div className="flex items-center justify-center h-full text-slate-500">
                    <p>Generated answers will appear here...</p>
                </div>
            )}
            {history.map((entry) => (
                <div key={entry.id}>
                    {entry.question && !entry.isThinking && entry.question !== "..." && (
                        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg">
                            <h3 className="text-lg font-semibold text-slate-400 mb-1">Detected Question:</h3>
                            <p className="text-slate-300 italic">"{entry.question}"</p>
                        </div>
                    )}
                    <div className="mt-2 text-xl leading-relaxed">
                        <MemoizedAnswerDisplay answer={entry.answer} isThinking={entry.isThinking} />
                    </div>
                </div>
            ))}
             <div ref={historyEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}
