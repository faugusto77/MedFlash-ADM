import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getGenAIClient() {
  if (!ai) {
    // Tenta pegar a chave do VITE_GEMINI_API_KEY (padrão Vite) ou do process.env (padrão AI Studio)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("A chave da API do Gemini não foi configurada. Por favor, adicione a variável de ambiente VITE_GEMINI_API_KEY.");
    }
    
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function generateFlashcardsFromText(topic: string, context: string) {
  const client = getGenAIClient();
  
  const prompt = `
    Você é um professor de medicina experiente.
    Crie flashcards de alta qualidade para estudantes de medicina se prepararem para provas de residência.
    Tópico: ${topic}
    Contexto: ${context}
    
    Crie perguntas e respostas claras, concisas e clinicamente relevantes.
    Use formatação HTML básica (<b>, <i>, <br>, <ul>, <li>) para destacar informações importantes.
  `;

  const response = await client.models.generateContent({
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
