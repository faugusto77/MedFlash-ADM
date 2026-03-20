import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateFlashcardsFromText(topic: string, context: string) {
  const prompt = `
    Você é um professor de medicina experiente.
    Crie flashcards de alta qualidade para estudantes de medicina se prepararem para provas de residência.
    Tópico: ${topic}
    Contexto: ${context}
    
    Crie perguntas e respostas claras, concisas e clinicamente relevantes.
    Use formatação HTML básica (<b>, <i>, <br>, <ul>, <li>) para destacar informações importantes.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: {
              type: Type.STRING,
              description: "A pergunta do flashcard, formatada em HTML.",
            },
            back: {
              type: Type.STRING,
              description: "A resposta do flashcard, formatada em HTML.",
            },
          },
          required: ["front", "back"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to generate flashcards");
  
  return JSON.parse(text);
}
