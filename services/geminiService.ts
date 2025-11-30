
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const cvData = `
--- CANDIDATE CV: Shivashish Shukla ---
**Role:** Senior O&M Engineer – Solar Power Plants
**Objective:** Highly skilled O&M Engineer (Solar, CBM, Electrical). Strong in troubleshooting, SCADA, RCA.
**Experience:**
- **Senior O&M Engineer** (Nov-2023–Present): Electro Solaire Pvt. Ltd. (154 MW DC). SCADA, RCA, Thermography, MIS.
- **Associate Officer** (Sept-2022–Nov-2023): PowerSun India. Breakdown handling, JSA.
- **Engineer** (Nov-2021–Aug-2022): Shri Sai Electrical. SCADA, RCA.
- **Operation Engineer** (Oct-2020–Nov-2021): Shivo-Hum India. CBM well sites, gas production.
**Education:**
- M.Tech Electrical (Power System & Control) - 75.40%
- B.E. Electrical - 71.40%
**Skills:** Solar O&M, SCADA, RCA, SAP, IMS, Safety (JSA/HIRA), Predictive Maintenance.
**Personal:** Shivashish Shukla, DOB: 02-Jul-1996, Rewa (MP).
--- END CV ---
`;

// Helper to convert Float32Array to 16-bit PCM for Gemini
function floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

// Helper to encode ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export type LiveSessionCallbacks = {
    onInputTranscript: (text: string) => void;
    onOutputTranscript: (text: string) => void;
    onTurnComplete: () => void;
    onError: (error: string) => void;
    onClose: () => void;
};

export class LiveInterviewSession {
    private sessionPromise: Promise<any> | null = null;
    private currentSession: any = null;

    constructor(private callbacks: LiveSessionCallbacks) {}

    async connect() {
        try {
            this.sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO], // We must request AUDIO for Live API
                    inputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" }, // Enable input transcription
                    outputAudioTranscription: { model: "gemini-2.5-flash-native-audio-preview-09-2025" }, // Enable output transcription
                    systemInstruction: `
                    You are an expert AI Job Interview Co-Pilot assisting Shivashish Shukla.
                    
                    **YOUR GOAL:**
                    Listen to the interviewer's question and provide the BEST possible answer for Shivashish to say.
                    
                    **RULES:**
                    1. **Source of Truth:**
                       - For personal/experience questions, use the CV strictly.
                       - For technical questions (Solar, Electrical, SCADA), use your expert general knowledge.
                    2. **Style:**
                       - Be professional, concise, and confident.
                       - Answer directly. Do not start with "Here is an answer". Just give the answer.
                    3. **Behavior:**
                       - If you hear silence or background noise, DO NOT GENERATE TEXT. Wait for a clear question.
                       - If the user is just typing or mumbling, stay silent.
                    
                    ${cvData}
                    `,
                },
                callbacks: {
                    onopen: () => {
                        console.log("Gemini Live Session Connected");
                    },
                    onmessage: (message: LiveServerMessage) => {
                        // 1. Handle Input Transcription (Interviewer)
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            if (text) this.callbacks.onInputTranscript(text);
                        }

                        // 2. Handle Output Transcription (The Answer)
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            if (text) this.callbacks.onOutputTranscript(text);
                        }

                        // 3. Handle Turn Completion
                        if (message.serverContent?.turnComplete) {
                            this.callbacks.onTurnComplete();
                        }
                    },
                    onclose: () => {
                        console.log("Gemini Live Session Closed");
                        this.callbacks.onClose();
                    },
                    onerror: (e: any) => {
                        console.error("Gemini Live Session Error", e);
                        this.callbacks.onError(e.message || "Connection error");
                    }
                }
            });

            this.currentSession = await this.sessionPromise;
        } catch (error: any) {
            this.callbacks.onError(error.message);
        }
    }

    sendAudioChunk(float32Data: Float32Array) {
        if (!this.currentSession) return;

        const pcm16 = floatTo16BitPCM(float32Data);
        const base64Data = arrayBufferToBase64(pcm16.buffer);

        this.currentSession.sendRealtimeInput({
            media: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Data
            }
        });
    }

    disconnect() {
        if (this.currentSession) {
             // Close isn't explicitly exposed on the session object in all versions, 
             // but releasing the client ends it.
             this.currentSession = null;
        }
    }
}
