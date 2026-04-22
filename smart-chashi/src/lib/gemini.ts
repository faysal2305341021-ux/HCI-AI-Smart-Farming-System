import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const getBanglaAdvice = async (issue: string, context: string = "") => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a professional agronomist specializing in Bangladeshi agriculture. Always respond in fluent, easy-to-understand Bangla. Provide practical, sustainable farming advice.",
    },
    contents: `The farmer has the following agricultural question: "${issue}". ${context ? `Additional context: ${context}` : ""}`,
  });
  
  const response = await model;
  return response.text;
};

export const getDiagnosisAdvice = async (imageBase64: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a plant disease expert for Bangladeshi crops like Paddy, Jute, and Brinjal. Analyze the image and identify the disease. Explain the cause and provide a step-by-step treatment plan in Bangla.",
    },
    contents: {
      parts: [
        { text: "Diagnose this crop disease and provide treated advice in Bangla." },
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
      ]
    }
  });

  const response = await model;
  return response.text;
};
