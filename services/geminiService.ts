
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const cvData = `

--- CANDIDATE CV: Shivashish Shukla ---

**Role:** Senior O&M Engineer – Solar Power Plants

**Objective:**
A highly skilled O&M Engineer with extensive experience in the operation and maintenance of Solar power plants, CBM well sites, and electrical systems. Strong in troubleshooting, preventive, predictive, and reactive maintenance strategies. Seeking a challenging role in a forward-thinking organization focused on operational excellence. :contentReference[oaicite:0]{index=0}

**Contact Details:**
- **Mobile:** +91-9826252004, +91-9479200351 :contentReference[oaicite:1]{index=1}
- **Email:** shivashishshukla01@gmail.com :contentReference[oaicite:2]{index=2}
- **Permanent Address:** Gram Post-Atraila-15, Vaya Katra, District-Rewa, Madhya Pradesh :contentReference[oaicite:3]{index=3}

---

**Work Experience:**

- **Senior O&M Engineer** (Nov-2023 – Present)
  - Electro Solaire Pvt. Ltd. | 154 MW DC / 100 MW AC, GIPCL (Block-D), Raghanesda, Gujarat
  - SCADA‐based monitoring, RCA implementation, thermography & I-V curve diagnostics, MIS reporting, safety & IMS compliance. :contentReference[oaicite:4]{index=4}

- **Associate Officer – O&M** (Sept-2022 – Nov-2023)
  - PowerSun India Pvt. Ltd. | GIPCL (Block-B), Raghanesda
  - Breakdown handling, preventive checks, spare management, JSA analysis, hazard assessment. :contentReference[oaicite:5]{index=5}

- **Engineer – O&M** (Nov-2021 – Aug-2022)
  - Shri Sai Electrical | GIPCL (Block-B), Raghanesda
  - SCADA monitoring, RCA reporting, thermography, coordination with GIPCL officials. :contentReference[oaicite:6]{index=6}

- **Operation Engineer** (Oct-2020 – Nov-2021)
  - Shivo-Hum India Pvt. Ltd. | Reliance CBM E&P
  - Well integrity, gas production optimization, pump flushing, pressure surveys, control system troubleshooting. :contentReference[oaicite:7]{index=7}

---

**Education:**
- M.Tech in Electrical Engineering (Power System & Control)
  - Vishwavidyalaya Engineering College, Ambikapur | 75.40% (2020)
- B.E. in Electrical Engineering
  - Vishwavidyalaya Engineering College, Lakhanpur | 71.40% (2018)
- Diploma in Electrical Engineering
  - Government Polytechnic Korea | 68.02% (2014)
- 10th | CGBSE Raipur | 72.67% (2011) :contentReference[oaicite:8]{index=8}

---

**Publications:**
- Development of Tensor Product-Based Dynamic Phasor Estimation Algorithm – IJERA, Aug 2020
- Potential of Phasor Estimation Algorithm Using Tensor Product – IJERA, July 2020 :contentReference[oaicite:9]{index=9}

---

**Key Skills:**
- Solar O&M • SCADA Monitoring • MIS Reporting • RCA & Zero-Breakdown Method
- Predictive / Preventive Maintenance
- Safety: JSA | HIRA | IMS Documentation
- Strong problem-solving • Team leadership • SOP awareness :contentReference[oaicite:10]{index=10}

**Software Skills:**
- MS Excel • MS Word • MS PowerPoint :contentReference[oaicite:11]{index=11}

---

**Personal Information:**
- **Name:** Shivashish Shukla
- **D.O.B:** 02-Jul-1996
- **Father’s Name:** Shri Bhoopendra Narayan Shukla
- **Religion:** Hindu
- **Nationality:** Indian
- **Marital Status:** Unmarried
- **Languages:** Hindi, English :contentReference[oaicite:12]{index=12}

---

**Declaration:**
I certify that the above information is true and correct to the best of my knowledge. :contentReference[oaicite:13]{index=13}

(Signature)
Shivashish Shukla
`;

type HistoryItem = {
    question: string;
    answer: string;
};

export const getGeminiAnswerFromAudio = async (audioBase64: string, mimeType: string, history: HistoryItem[]): Promise<{ question: string; answer: string; }> => {
  if (!audioBase64) {
    return { question: "...", answer: "..." };
  }

  const historyContext = history.length > 0 ? `
--- CONVERSATION HISTORY ---
Use this history ONLY for context. Do not repeat previous questions.
${history.map(entry => `Interviewer: ${entry.question}\nYou: ${entry.answer}`).join('\n')}
--- END CONVERSATION HISTORY ---
` : '';

  const promptInstruction = `
  **CRITICAL INSTRUCTION: TRANSCRIPTION & VALIDATION FIRST**
  You are an AI assistant helping a candidate (Shivashish Shukla) in a live interview.
  
  **STEP 1: AUDIO ANALYSIS (MOST IMPORTANT)**
  1. Listen to the provided audio carefully.
  2. **Is there a clear question or command directed at the candidate?**
     - If the audio is silence, background noise, typing sounds, or someone mumbling: **RETURN "NO_AUDIO"**.
     - If the audio is just a statement (e.g., "Okay", "Right", "Next"): **RETURN "NO_AUDIO"**.
     - **DO NOT HALLUCINATE:** Do not invent a question if you don't hear one clearly. It is better to return nothing than to answer a fake question.

  **STEP 2: ANSWER GENERATION (Only if Step 1 is valid)**
  If a clear question is detected, generate an answer acting as **Shivashish Shukla** (Senior O&M Engineer).
  
  **Source of Knowledge:**
  - **Personal/Experience Qs:** STRICTLY use the provided CV below.
  - **Technical/Engineering Qs:** Use your expert general knowledge (Solar, Electrical, SCADA, O&M) to provide a high-quality, detailed technical answer.

  ${cvData}
  --- END CV ---

  ${historyContext}

  **OUTPUT FORMAT:**
  Return ONLY valid JSON.
  If invalid audio: { "question": "NO_AUDIO", "answer": "..." }
  If valid question: { "question": "Transcribed question exactly as heard", "answer": "Your professional, concise, spoken-style answer." }
`;

  try {
    const audioPart = {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    };

    const textPart = {
      text: promptInstruction,
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [textPart, audioPart] },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
            },
            required: ["question", "answer"],
        },
      },
    });
    
    // Safely handle potentially undefined text
    let jsonString = response.text ? response.text.trim() : "";
    
    // Clean up markdown code blocks if present
    if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.substring(3, jsonString.length - 3).trim();
    }

    if (!jsonString) {
        throw new Error("Received empty response from AI");
    }

    const jsonResponse = JSON.parse(jsonString);
    
    // Filter out invalid or hallucinated responses based on the strict prompt instructions
    if (jsonResponse.question === "NO_AUDIO" || jsonResponse.question === "..." || !jsonResponse.question) {
        return { question: "...", answer: "..." };
    }

    return {
        question: jsonResponse.question,
        answer: jsonResponse.answer || "Sorry, I couldn't generate an answer.",
    };
  } catch (error) {
    console.error("Error processing Gemini response:", error);
    return {
        question: "...",
        answer: "...",
    };
  }
};
