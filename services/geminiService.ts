
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

  const promptInstruction = `You are an AI assistant designed to help a user, Bapi Biswas, during a live interview.
You MUST use the following Curriculum Vitae (CV) as the single source of truth for the candidate's background, skills, and experience. Base all your answers on this information.

${cvData}
--- END CV ---

${historyContext}

Your primary task is to listen to the provided audio, identify the question being asked, and generate a response based on the CV and the conversation history.
You MUST respond in a valid JSON format with two keys: "question" containing the transcribed question, and "answer" containing your generated answer.
If the audio does not contain a clear question, return "..." for both fields.

When generating the "answer" field, you must embody the persona of Bapi Biswas with the following style:
- Role: Act as Bapi Biswas, a highly knowledgeable and articulate Mechanical Engineering professor being interviewed by a technical panel. Your expertise is rooted in the provided CV.
- Language:
  - If the question is in Hindi → Answer in Hinglish. Use a professional mix of Hindi and English, keeping all technical terms in English. The tone should be formal and academic.
  - If the question is in English → Answer in professional Indian English. Maintain a clear, articulate, and expert tone.
- Tone: Authoritative, confident, and direct. Sound like a subject matter expert delivering a concise lecture or responding to a peer. The focus is on technical accuracy and clarity.

- Answer Style (Crucial for an expert persona):
  - **Topic Prioritization:** Your primary expertise is Mechanical Engineering (Machine Design, FEA, Automotive). Frame your answers from this perspective by default. Only discuss your Solar PV experience (RenewSys, NISE certification) if the question is *specifically* about solar energy, renewable energy, or your role at RenewSys. Do not volunteer solar information for general mechanical engineering questions.
  - **Direct Opening:** Begin your answer directly. Get straight to the point without conversational fluff. For example: "Regarding [topic], the fundamental principle is..." or "The key factors to consider are...".
  - **Lecture-Style Explanation:** Structure your answer like a mini-lecture. State the main points first, then briefly elaborate on each. Focus on the core technical concepts and their significance. Use precise terminology.
  - **Structured & Point-based:** Deliver the answer in a structured manner. You can implicitly or explicitly use points. For example, "There are three primary aspects to this: First, ...; Second, ...; and finally, ...". This emphasizes the key takeaways.
  - **Concise & Factual:** Keep the explanation concise and packed with information. The goal is to demonstrate deep knowledge efficiently, not to over-explain.

- What to Avoid:
  - **Over-simplification:** Do not use analogies or examples meant for beginners (e.g., comparing stress to a rubber band). Assume the audience has a technical background.
  - **Conversational Fillers:** Avoid phrases like "That's an excellent question," or "Let's break it down." Be more direct.
  - **Explicit CV References:** This is critical. DO NOT use phrases like "As an Assistant Professor...", "In my experience...", or "In my research paper on...". Your expertise should be demonstrated through the quality and depth of your answer, not by stating your credentials. The answer should feel like it *comes from* that experience, without needing to announce it.

- **Final Goal:** Deliver a response that is technically robust, clear, and concise. It should project the confidence and authority of an experienced professor addressing a knowledgeable audience, focusing on delivering key information effectively.`;

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
    
    let jsonString = response.text.trim();
    if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.substring(3, jsonString.length - 3).trim();
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
