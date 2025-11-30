
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LiveInterviewSession } from './services/geminiService';
import { ScreenShareIcon, MicIcon, BrainIcon, InfoIcon, StopIcon } from './components/Icons';

type HistoryEntry = {
    id: number;
    question: string;
    answer: string;
    isComplete: boolean;
};

// Helper component for displaying status
const StatusIndicator: React.FC<{ icon: React.ReactNode; text: string; color: string; pulse?: boolean }> = ({ icon, text, color, pulse }) => (
  <div className={`flex items-center space-x-3 p-3 rounded-lg bg-slate-700/50`}>
    <div className={`${color} ${pulse ? 'animate-pulse' : ''}`}>{icon}</div>
    <span className="text-lg font-medium text-slate-300">{text}</span>
  </div>
);

// Volume Meter Component
const VolumeMeter: React.FC<{ volume: number }> = ({ volume }) => {
    // Volume is 0 to 1 (normalized roughly)
    const widthPercentage = Math.min(100, Math.max(0, volume * 500)); 
    
    return (
        <div className="w-full bg-slate-700 rounded-full h-2.5 mt-2 overflow-hidden">
            <div 
                className={`h-2.5 rounded-full transition-all duration-75 ${widthPercentage > 5 ? 'bg-green-500' : 'bg-slate-600'}`} 
                style={{ width: `${widthPercentage}%` }}
            ></div>
        </div>
    );
};

export default function App() {
  const [isSharing, setIsSharing] = useState(false);
  const [statusText, setStatusText] = useState("Session not started");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0);
  
  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<LiveInterviewSession | null>(null);
  
  // Refs for current turn state (to avoid excessive React renders)
  const currentEntryIdRef = useRef<number | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const cleanup = useCallback(() => {
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    audioContextRef.current = null;

    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }

    if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
    }

    setIsSharing(false);
    setStatusText("Session ended.");
    currentEntryIdRef.current = null;
    setCurrentVolume(0);
  }, []);

  const handleInputTranscript = useCallback((text: string) => {
    setHistory(prev => {
        const id = currentEntryIdRef.current;
        if (id === null) {
            // New turn starting
            const newId = Date.now();
            currentEntryIdRef.current = newId;
            return [...prev, { id: newId, question: text, answer: '', isComplete: false }];
        } else {
            // Update existing turn
            return prev.map(entry => entry.id === id ? { ...entry, question: entry.question + text } : entry);
        }
    });
  }, []);

  const handleOutputTranscript = useCallback((text: string) => {
    setHistory(prev => {
        const id = currentEntryIdRef.current;
        if (id === null) return prev; // Should not happen if input came first, but strictly safer
        return prev.map(entry => entry.id === id ? { ...entry, answer: entry.answer + text } : entry);
    });
  }, []);

  const handleTurnComplete = useCallback(() => {
     setHistory(prev => {
         const id = currentEntryIdRef.current;
         if (id !== null) {
             return prev.map(entry => entry.id === id ? { ...entry, isComplete: true } : entry);
         }
         return prev;
     });
     currentEntryIdRef.current = null; // Ready for next question
  }, []);

  const startSharing = useCallback(async () => {
    setHistory([]);
    setError(null);
    setStatusText("Initializing...");

    try {
        // 1. Initialize Gemini Live Session
        const session = new LiveInterviewSession({
            onInputTranscript: handleInputTranscript,
            onOutputTranscript: handleOutputTranscript,
            onTurnComplete: handleTurnComplete,
            onError: (err) => setError(`Gemini Error: ${err}`),
            onClose: () => {
                if (isSharing) cleanup();
            }
        });
        await session.connect();
        liveSessionRef.current = session;

        // 2. Start Screen Share
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true, // Crucial
        });

        // Check for audio track
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            setError("No audio detected! Please share a Tab and check 'Share tab audio'.");
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        streamRef.current = stream;
        
        // Handle stream stop (user clicks "Stop Sharing" in browser UI)
        stream.getVideoTracks()[0].onended = () => {
            cleanup();
        };

        // 3. Audio Pipeline Setup
        // We use 16kHz context because Gemini Live prefers 16kHz PCM
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        // ScriptProcessor is deprecated but reliable for simple raw PCM access in this context
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (!liveSessionRef.current) return;
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate Volume for UI
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            // Throttle state update slightly to avoid performance hit
            if (Math.random() > 0.8) setCurrentVolume(rms);

            liveSessionRef.current.sendAudioChunk(inputData);
        };

        setIsSharing(true);
        setStatusText("Live & Listening...");

    } catch (err: any) {
        console.error("Start Error:", err);
        setError(err.message || "Failed to start session.");
        cleanup();
    }
  }, [cleanup, handleInputTranscript, handleOutputTranscript, handleTurnComplete]);

  return (
    <div className="bg-slate-900 text-white min-h-screen lg:h-screen lg:overflow-y-hidden font-sans flex flex-col">
      <header className="p-4 border-b border-slate-700 bg-slate-900/90 backdrop-blur-sm z-10">
        <h1 className="text-2xl font-bold text-center text-cyan-400 tracking-wide">
          Live Interview Co-Pilot <span className="text-xs text-cyan-600 bg-cyan-900/30 px-2 py-1 rounded ml-2">V2.1 SMART WAIT</span>
        </h1>
      </header>

      <main className="flex-grow p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start lg:min-h-0">
        {/* Controls Panel */}
        <div className="flex flex-col space-y-6 bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700 h-full">
          {!isSharing ? (
             <div className="flex flex-col items-center justify-center flex-grow space-y-8">
                <div className="bg-slate-900/50 p-6 rounded-full">
                    <BrainIcon className="h-20 w-20 text-cyan-500 animate-pulse" />
                </div>
                <button
                    onClick={startSharing}
                    className="flex items-center space-x-4 px-10 py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-full text-xl hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-cyan-500/20"
                >
                    <ScreenShareIcon className="h-8 w-8" />
                    <span>Start Live Session</span>
                </button>
                 <div className="flex items-start space-x-3 p-5 rounded-lg bg-blue-900/30 border border-blue-700/50 text-blue-200 max-w-md">
                    <InfoIcon className="h-6 w-6 flex-shrink-0 mt-1 text-blue-400" />
                    <div className="space-y-2">
                        <h3 className="font-bold text-blue-300">Instructions:</h3>
                        <p className="text-sm">1. Click Start and share the <strong>Interviewer's Tab</strong>.</p>
                        <p className="text-sm">2. Check <strong>"Share tab audio"</strong> (Critical).</p>
                        <p className="text-sm">3. The AI waits for a <strong>3-second pause</strong> before answering.</p>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
                <div className="flex flex-col items-center space-y-6 mb-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                        <h2 className="relative text-3xl font-bold text-white tracking-tight">Session Active</h2>
                    </div>
                    <button
                        onClick={cleanup}
                        className="flex items-center space-x-2 px-6 py-2 bg-red-600/20 text-red-400 border border-red-600/50 font-semibold rounded-lg hover:bg-red-600 hover:text-white transition-all"
                    >
                        <StopIcon className="h-5 w-5" />
                        <span>Stop Session</span>
                    </button>
                </div>

                <div className="space-y-4">
                    <StatusIndicator 
                        icon={<MicIcon className="h-6 w-6" />} 
                        text={statusText} 
                        color={currentVolume > 0.01 ? "text-green-400" : "text-yellow-500"} 
                        pulse={currentVolume > 0.01} 
                    />
                    
                    {/* Visualizer */}
                    <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Audio Level</span>
                            {currentVolume > 0.01 ? <span>Detecting Speech...</span> : <span>Waiting for 3s Pause...</span>}
                        </div>
                        <VolumeMeter volume={currentVolume} />
                    </div>

                     <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-center">
                        <p className="text-slate-400 text-sm">Mode</p>
                        <p className="text-cyan-400 font-mono font-bold">Gemini 2.5 Live (Smart Wait)</p>
                     </div>
                </div>

                {error && (
                    <div className="mt-auto p-4 bg-red-900/80 border border-red-700 text-white rounded-lg animate-fade-in">
                        <strong>Error:</strong> {error}
                    </div>
                )}
            </div>
          )}
        </div>

        {/* Live Transcript Log */}
        <div className="bg-slate-800 p-0 rounded-xl shadow-xl border border-slate-700 h-full min-h-[500px] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/90 backdrop-blur z-10 flex justify-between items-center">
             <h2 className="text-xl font-bold text-cyan-400 flex items-center">
                <div className="w-2 h-2 rounded-full bg-cyan-500 mr-2 animate-ping"></div>
                Live Transcript
             </h2>
             <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Real-time</span>
          </div>
          
          <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-900/30">
            {history.length === 0 && isSharing && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-pulse">
                    <p>Listening for audio...</p>
                </div>
            )}
            {history.length === 0 && !isSharing && (
                <div className="flex items-center justify-center h-full text-slate-600">
                    <p>Transcript will appear here</p>
                </div>
            )}
            
            {history.map((entry) => (
                <div key={entry.id} className="animate-fade-in-up">
                    {/* Interviewer Question */}
                    <div className="flex justify-end mb-2">
                         <div className="max-w-[85%] bg-slate-700 rounded-2xl rounded-tr-none px-5 py-3 border border-slate-600">
                            <p className="text-xs text-slate-400 mb-1 font-bold uppercase tracking-wide">Interviewer</p>
                            <p className="text-slate-200 text-lg leading-relaxed">{entry.question}</p>
                         </div>
                    </div>

                    {/* AI Answer */}
                    <div className="flex justify-start mb-6">
                        <div className="max-w-[90%] bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl rounded-tl-none px-6 py-4 border border-cyan-800/30 shadow-lg">
                            <div className="flex items-center space-x-2 mb-2">
                                <BrainIcon className="h-4 w-4 text-cyan-400" />
                                <p className="text-xs text-cyan-400 font-bold uppercase tracking-wide">Suggestion</p>
                            </div>
                            <div className="prose prose-invert prose-lg max-w-none">
                                <p className="text-slate-100 leading-relaxed font-medium">
                                    {entry.answer}
                                    {!entry.isComplete && <span className="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse"/>}
                                </p>
                            </div>
                        </div>
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
