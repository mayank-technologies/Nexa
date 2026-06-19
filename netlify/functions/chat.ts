/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

interface GroundingSource {
  title: string;
  uri: string;
}

// Helper to get Gemini Client lazily
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined. Please set it in Netlify Environment Variables.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust wrapper to handle transient 503, 429 errors, spike demands and provide live model fallback
async function generateContentWithRetry(params: {
  contents: any[];
  config?: any;
  initialModel?: string;
}): Promise<any> {
  const modelsToTry = [
    params.initialModel || "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    let attempts = 3; // Try up to 3 times for each model to handle spikes
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[Netlify Nexa Core] Requesting content generation via model ${model} (attempt ${attempt}/${attempts})...`);
        const ai = getGeminiClient();
        const result = await ai.models.generateContent({
          model: model,
          contents: params.contents,
          config: params.config,
        });
        return result;
      } catch (err: any) {
        lastError = err;
        const errorMessage = String(err?.message || err);
        const errorMessageLower = errorMessage.toLowerCase();
        
        // Comprehensive check for of any transient or rate-limited errors
        const isTransient = errorMessageLower.includes("503") || 
                            errorMessageLower.includes("429") ||
                            errorMessageLower.includes("500") ||
                            errorMessageLower.includes("demand") || 
                            errorMessageLower.includes("temporary") || 
                            errorMessageLower.includes("unavailable") ||
                            errorMessageLower.includes("overloaded") ||
                            errorMessageLower.includes("quota") ||
                            errorMessageLower.includes("rate limit") ||
                            errorMessageLower.includes("resource exhausted") ||
                            errorMessageLower.includes("timeout") ||
                            errorMessageLower.includes("econnreset") ||
                            errorMessageLower.includes("socket");

        console.warn(`[Netlify Nexa Core] Model ${model} errored on attempt ${attempt}:`, errorMessage);

        if (isTransient && attempt < attempts) {
          const delay = attempt * 1500; // 1500ms first delay, 3000ms second delay
          console.log(`[Netlify Nexa Core] Transient error detected. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // If it's a non-transient error or we've run out of attempts for this model, break and try the next model
        break;
      }
    }
  }

  throw lastError || new Error("Failed to generate content with all configured models.");
}

// Router to classify task automatically (Smart Task Router)
function routeTask(
  prompt: string,
  mode: string,
  hasImage: boolean
): "core" | "reasoning" | "vision" | "language" | "learning" {
  const lowercasePrompt = prompt.toLowerCase();

  // 1. Vision Engine routing
  if (hasImage || lowercasePrompt.includes("image") || lowercasePrompt.includes("picture") || lowercasePrompt.includes("screenshot") || lowercasePrompt.includes("ocr") || lowercasePrompt.includes("visual")) {
    return "vision";
  }

  // 2. Reasoning Engine routing (math, logic, equations, code)
  const mathRegex = /[\d+\-*/=√π▲λ∫∬]|[0-9]+[xXyYx]/;
  const codingKeywords = ["code", "typescript", "python", "javascript", "program", "function", "compile", "bug", "algorithm", "recursive"];
  const mathKeywords = ["solve", "calculate", "math", "calculus", "geometry", "equations", "algebra", "integral", "logic", "reasoning", "prove"];

  if (
    mathRegex.test(prompt) ||
    codingKeywords.some((kw) => lowercasePrompt.includes(kw)) ||
    mathKeywords.some((kw) => lowercasePrompt.includes(kw))
  ) {
    return "reasoning";
  }

  // 3. Language Engine routing (translate, grammar, detection)
  const langKeywords = ["translate", "translation", "pronounce", "pronunciation", "spelling", "grammar correction", "multilingual assist", "detect language", "how to say", "meaning of"];
  if (langKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "language";
  }

  // 4. Learning Engine routing (homework, tutor, study, explain like I'm 10)
  const learnKeywords = ["homework", "study", "exam", "quiz", "student", "explain to a", "class", "syllabus", "formula", "revision", "learn", "assignment"];
  if (mode === "study" || mode === "quiz" || learnKeywords.some((kw) => lowercasePrompt.includes(kw))) {
    return "learning";
  }

  // 5. Default to Nexa Core
  return "core";
}

// Netlify Function v2 Handler (Web Request/Response style)
export default async function handler(req: Request) {
  // CORS Response Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const {
      messages,
      mode = "general",
      explainLikeIm10 = false,
      writingStyle = "casual",
      quizTopic = "",
      quizDifficulty = "medium",
      personalizationContext = ""
    } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const activeMessage = messages[messages.length - 1];
    const userPrompt = activeMessage.content;
    const attachment = activeMessage.attachment;
    const hasImage = !!(attachment && attachment.type === "image");

    // Smart Route classification
    const engineId = routeTask(userPrompt, mode, hasImage);

    // Setup System Instructions and configs depending on engine and mode
    let systemInstruction = "You are Nexa Core - an intelligent, helpful, highly premium, trustworthy AI chatbot designed with ultimate professional craftsmanship. You express answers in beautiful markdown with rich structure. Do not output any loading bars, neon effects or system-internal trace lines. IMPORTANT: ONLY if the user explicitly asks about who created you, built you, made you, or who your founder is, should you respond that you were created by Mayank, the founder of Mayank Technologies. NEVER volunteer this information or mention Mayank Technologies or your creator unless directly and explicitly asked about it first. CRITICAL: Always respond/reply to the user in the EXACT same language, dialect, or conversational slang that the user used to write their message (e.g., if the user asks in Hindi, Hinglish, Gujarati, Haryanvi, Spanish, etc., you MUST reply in that exact same tongue and tone).";

    if (personalizationContext) {
      systemInstruction += `\nRemember this user persona/instructions: ${personalizationContext}`;
    }

    // Configure tools - enable Google Search grounding for real-time mode, Deep Research, or Fact Checker
    const useSearch = mode === "research" || mode === "factcheck" || userPrompt.toLowerCase().includes("search") || userPrompt.toLowerCase().includes("live") || userPrompt.toLowerCase().includes("news") || userPrompt.toLowerCase().includes("current");
    const tools = useSearch ? [{ googleSearch: {} }] : undefined;

    // Construct request parts (handling potential image/document attachments safely)
    let contents: any[] = [];
    
    // Map previous message history for context aware conversation
    messages.forEach((msg: any) => {
      const role = msg.role === "assistant" ? "model" : "user";
      const textContent = (msg.content || "").trim();

      if (role === "user" && msg.attachment && msg.attachment.dataUrl) {
        const splitData = msg.attachment.dataUrl.split(",");
        const base64Data = splitData[1] || splitData[0];
        
        let mimeType = "image/jpeg";
        const fileNameLower = (msg.attachment.name || "").toLowerCase();
        if (msg.attachment.type === "pdf" || fileNameLower.endsWith(".pdf")) {
          mimeType = "application/pdf";
        } else if (msg.attachment.type === "txt" || fileNameLower.endsWith(".txt")) {
          mimeType = "text/plain";
        } else if (msg.attachment.type === "image" || fileNameLower.endsWith(".png")) {
          mimeType = "image/png";
        } else if (fileNameLower.endsWith(".webp")) {
          mimeType = "image/webp";
        } else if (fileNameLower.endsWith(".gif")) {
          mimeType = "image/gif";
        }

        const parts: any[] = [
          { inlineData: { mimeType, data: base64Data } }
        ];

        if (textContent) {
          parts.push({ text: textContent });
        } else {
          parts.push({ text: mimeType.startsWith("image/") ? "Analyze this image." : "Analyze this document." });
        }

        contents.push({ role, parts });
      } else if (role === "user" && msg.attachment && msg.attachment.textPreview) {
        contents.push({
          role: "user",
          parts: [{ text: `[Document Attachment "${msg.attachment.name}":\n${msg.attachment.textPreview}]\n\n${textContent || "Please analyze or summarize this document context."}` }]
        });
      } else {
        // Standard text message
        if (textContent) {
          contents.push({ role, parts: [{ text: textContent }] });
        } else {
          contents.push({ role, parts: [{ text: "..." }] });
        }
      }
    });

    // Select speed-optimized Gemini model: gemini-3.1-flash-lite for instant chats
    const modelName = (mode === "research" || mode === "factcheck" || mode === "quiz")
      ? "gemini-3.5-flash"
      : "gemini-3.1-flash-lite";

    // ----------------------------------------------------
    // CASE A: QUIZ GENERATOR MODE (Structured JSON Output)
    // ----------------------------------------------------
    if (mode === "quiz" || userPrompt.toLowerCase().includes("generate quiz") || userPrompt.toLowerCase().includes("mcq")) {
      const topic = quizTopic || userPrompt || "General Knowledge";
      systemInstruction = `You are the Nexa Learning Engine’s MCQ & Quiz Generator. Generate a high quality 5-question multiple choice quiz about "${topic}" on difficulty level "${quizDifficulty}". Always provide exact explanations for the correct answer. You must output exactly matching the JSON schema.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctOptionIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["id", "question", "options", "correctOptionIndex", "explanation"]
            }
          }
        },
        required: ["topic", "difficulty", "questions"]
      };

      const result = await generateContentWithRetry({
        initialModel: modelName,
        contents: contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const quizData = JSON.parse(result.text || "{}");
      return new Response(JSON.stringify({
        content: `I've successfully generated a custom quiz on **${quizData.topic}** (${quizData.difficulty} level) for you! Use the interface to answer and test your knowledge.`,
        engineId: "learning",
        quiz: quizData
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // ----------------------------------------------------
    // CASE B: FACT CHECK MODE (Structured Fact Checks)
    // ----------------------------------------------------
    if (mode === "factcheck" || userPrompt.toLowerCase().includes("fact check") || userPrompt.toLowerCase().includes("verify")) {
      systemInstruction = "You are the Nexa Fact Check Engine, a highly meticulous information validator. Investigate the claim provided in the prompt. Grade it with Confidence, Reliability, and give a clear Verdict ('verified', 'misleading', 'unverified', or 'debunked'). Search the web to check validity. Do not generate fake URLs.";

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          contentMarkdown: { type: Type.STRING, description: "Detailed structural markdown report with sections: Context, Investigation, and Final verdict" },
          confidenceScore: { type: Type.INTEGER, description: "Percentage reflecting exact certainty of verdict 0-100" },
          reliabilityScore: { type: Type.INTEGER, description: "Percentage reflecting source credibility 0-100" },
          verdict: { type: Type.STRING, description: "'verified' | 'misleading' | 'unverified' | 'debunked'" },
          explanation: { type: Type.STRING, description: "One sentence executive explanation of the check" },
          sourcesChecked: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["contentMarkdown", "confidenceScore", "reliabilityScore", "verdict", "explanation", "sourcesChecked"]
      };

      const result = await generateContentWithRetry({
        initialModel: modelName,
        contents: contents,
        config: {
          systemInstruction,
          tools,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const factData = JSON.parse(result.text || "{}");
      const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: GroundingSource[] = [];
      if (grounding) {
        grounding.forEach((c: any) => {
          if (c.web) {
            sources.push({ title: c.web.title, uri: c.web.uri });
          }
        });
      }

      return new Response(JSON.stringify({
        content: factData.contentMarkdown,
        engineId: "core",
        sources: sources.length > 0 ? sources : factData.sourcesChecked.map((s: string) => ({ title: s, uri: "#" })),
        factCheck: {
          confidenceScore: factData.confidenceScore,
          reliabilityScore: factData.reliabilityScore,
          verdict: factData.verdict,
          explanation: factData.explanation,
          sourcesChecked: factData.sourcesChecked
        }
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // ----------------------------------------------------
    // CASE C: DEEP RESEARCH MODE (Comprehensive Reports)
    // ----------------------------------------------------
    if (mode === "research") {
      systemInstruction = `You are Nexa's premium Deep Research Engine. Conduct an exhaustive exploration on the user query. Do multi-source exploration, analyze historical insights, present structural findings. Search the web for current live references. Output EXACTLY structured JSON according to the schema provided. Organize each section cleanly without skipping parts.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          executiveSummary: { type: Type.STRING, description: "Brief high level TL;DR summary" },
          detailedFindings: { type: Type.STRING, description: "Extensive deep dive report with formatting and bullet points" },
          keyInsights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 to 5 core takeaway insights from the topic"
          }
        },
        required: ["executiveSummary", "detailedFindings", "keyInsights"]
      };

      const result = await generateContentWithRetry({
        initialModel: modelName,
        contents: contents,
        config: {
          systemInstruction,
          tools,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const reportData = JSON.parse(result.text || "{}");
      const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources: GroundingSource[] = [];
      if (grounding) {
        grounding.forEach((c: any) => {
          if (c.web) {
            sources.push({ title: c.web.title, uri: c.web.uri });
          }
        });
      }

      return new Response(JSON.stringify({
        content: `### Executive Summary\n${reportData.executiveSummary}\n\n### Detailed Findings\n${reportData.detailedFindings}`,
        engineId: "core",
        sources,
        researchReport: {
          executiveSummary: reportData.executiveSummary,
          detailedFindings: reportData.detailedFindings,
          keyInsights: reportData.keyInsights,
          references: sources
        }
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // ----------------------------------------------------
    // CASE D: STUDY MODE (Regular and Explain Like I'm 10)
    // ----------------------------------------------------
    if (mode === "study" || engineId === "learning") {
      systemInstruction = "You are Nexa Learning Engine - an educational assistant. Answer in highly structural blocks.";
      if (explainLikeIm10) {
        systemInstruction += " EXTREMELY IMPORTANT: Explain this topic under the strict constraint of 'Explain Like I'm 10' (ELI10). Use highly intuitive daily analogical references, simplified terms, and a nurturing tone suitable for a 10 year old kid.";
      } else {
        systemInstruction += " Provide rich study guides, outline key formulas, write explanatory notes, and offer exam preparation recommendations.";
      }
    }

    // ----------------------------------------------------
    // CASE E: REASONING ENGINE (Mathematical, programming, logic)
    // ----------------------------------------------------
    else if (engineId === "reasoning") {
      systemInstruction = "You are the Nexa Reasoning Engine. Break down calculations, logic schemas, code optimizations, and math proofs recursively. Always provide detailed step-by-step reasoning sequences. Wrap equations in standard LaTeX expressions or clear math block dividers.";
    }

    // ----------------------------------------------------
    // CASE F: VISION ENGINE (Multimodal image tasks)
    // ----------------------------------------------------
    else if (engineId === "vision") {
      systemInstruction = "You are the Nexa Vision Engine. Thoroughly analyze the image uploaded by the user. Perform exact mathematical/chemical diagram reasoning, run screenshot OCR extraction if text exists, tell details of homework pages, and write structural breakdown comments.";
    }

    // ----------------------------------------------------
    // CASE G: LANGUAGE ENGINE (Translation grammar correction)
    // ----------------------------------------------------
    else if (engineId === "language") {
      systemInstruction = "You are the Nexa Language Engine. Perfect grammar, offer fluent translations, correct phrasing, give vocabulary synonyms, and assist multilingual interaction across standard Indian regional or International languages.";
    }

    // ----------------------------------------------------
    // CASE H: WRITING ASSISTANT MODE
    // ----------------------------------------------------
    else if (mode === "writing") {
      systemInstruction = `You are Nexa's premium Creative Writing Assistant. Draft content precisely matched with the selected theme: "${writingStyle}". Ensure high cohesion, clean rhythm, outstanding paragraphs, and beautiful grammar. Style matches:
- 'formal': professional, corporate-ready, polite and meticulous.
- 'casual': conversational, lively, high empathy, human-focused.
- 'academic': rigorous, high validation, detailed context, passive-neutral.
- 'professional': outcome-driven, key-point bullets, highly actionable.`;
    }

    // Call standard generateContent
    if (systemInstruction) {
      systemInstruction += "\nAlways use suitable and warm emojis throughout your response to make it look highly expressive, welcoming, interactive, and beautifully designed. Place relevant emojis at key moments, headers, lists, and inside paragraphs where appropriate.";
      systemInstruction += "\nCRITICAL LANGUAGE DIRECTIVE: Always detect and respond in the EXACT language, dialect, or conversational slang that the user has used in their last message. If the user writes in English, reply in English. If the user writes in Hinglish (Hindi written in Latin script, e.g. 'nexa ab bhi hindi mai...', 'kaise ho', 'kya chalra hai', 'theek h'), you MUST write your entire response inside standard Hinglish (Latin alphabets) with similar colloquial slang. If they use pure Devnagari Hindi (हिन्दी), reply in pure Devnagari Hindi. Never auto-translate or respond in a different language/script combination than what the user used. Keep consistency with the user's chosen script and tongue.";
    }

    const result = await generateContentWithRetry({
      initialModel: modelName,
      contents: contents,
      config: {
        systemInstruction,
        tools,
      }
    });

    const responseText = result.text || "";
    const grounding = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: GroundingSource[] = [];
    if (grounding) {
      grounding.forEach((c: any) => {
        if (c.web) {
          sources.push({ title: c.web.title, uri: c.web.uri });
        }
      });
    }

    return new Response(JSON.stringify({
      content: responseText,
      engineId: engineId,
      sources: sources.length > 0 ? sources : undefined
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err: any) {
    console.error("Gemini API Error in Netlify Function:", err);
    return new Response(JSON.stringify({
      content: `### 🔴 System Alert\n\nNexa's secure core is active. The engine experienced a connectivity or configuration state issue.\n\n**Reason:** ${err.message || "Unknown gateway timeout"}\n\n*Please ensure your **GEMINI_API_KEY** is configured in your Netlify Environment Variables to unlock direct answers.*`,
      engineId: "core",
      sources: [{ title: "Configure Keys", uri: "#" }]
    }), {
      status: 200,
      headers: corsHeaders
    });
  }
}
