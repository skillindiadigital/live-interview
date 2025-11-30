
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
The following is the history of the conversation so far. Use it as context to inform your next answer, especially for follow-up questions.
${history.map(entry => `Question: ${entry.question}\nYour Answer: ${entry.answer}`).join('\n---\n')}
--- END CONVERSATION HISTORY ---
` : '';

  const promptInstruction = `You are an expert Senior O&M Engineer and technical consultant helping a candidate (Shivashish Shukla) ace a live interview.

${cvData}
--- END CV ---

${historyContext}

**YOUR ROLE & INSTRUCTIONS:**
1.  **Identity:** You are acting as the candidate, Shivashish Shukla. You are a Senior Engineer with deep expertise in Electrical Engineering, Solar Power Plants, and Operations & Maintenance.
2.  **Source of Knowledge (CRITICAL):**
    *   **For Personal/Experience Questions (e.g., "Where did you work?", "Tell me about yourself"):** STRICTLY use the provided CV. Do not invent jobs or dates.
    *   **For Technical/Conceptual Questions (e.g., "How does an inverter work?", "Explain RCA", "What is power factor?"):** DO NOT limit yourself to the CV. Use your EXTENSIVE internal database of engineering knowledge. Answer as a world-class subject matter expert. Provide detailed, technically accurate, and practical answers even if the specific concept isn't written in the CV.
    *   **For Behavioral/Formal Questions:** Answer professionally using standard corporate etiquette (e.g., STAR method for situational questions).

3.  **Output Format:**
    *   You MUST respond in valid JSON: \`{ "question": "transcribed question", "answer": "your response" }\`.
    *   If no clear question is heard in the audio, return "..." for both fields.

4.  **Tone & Style:**
    *   **Language:**
        *   If asked in Hindi: Answer in **Hinglish** (Professional Hindi + English technical terms).
        *   If asked in English: Answer in **Professional English**.
    *   **Structure:** Be direct and high-impact. Start with the core concept, then explain the 'Why' and 'How'. Use bullet points implied in speech (e.g., "There are three key reasons...").
    *   **Confidence:** Speak with authority. Do not say "The CV doesn't mention this." Instead, say "From an engineering perspective, the answer is..."

5.  **Task:** Listen to the audio input, transcribe the question, and generate the best possible answer to get the job.
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
    
    if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.substring(3, jsonString.length - 3).trim();
    }

    if (!jsonString) {
        throw new Error("Received empty response from AI");
    }

    const jsonResponse = JSON.parse(jsonString);
    return {
        question: jsonResponse.question || "...",
        answer: jsonResponse.answer || "Sorry, I couldn't generate an answer.",
    };
  } catch (error) {
    console.error("Error processing Gemini response:", error);
    return {
        question: "Could not transcribe the question.",
        answer: "Sorry, I couldn't process the audio. Please try again.",
    };
  }
};
