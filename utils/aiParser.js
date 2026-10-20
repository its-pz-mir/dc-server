const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to retry API calls on 503/429 errors
async function callGeminiWithRetry(prompt, retries = 3, delayMs = 800) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      return response;
    } catch (error) {
      const errorMessage = String(error?.message || '');
      const isTemporaryError =
        error?.status === 503 ||
        error?.statusCode === 503 ||
        error?.status === 429 ||
        error?.statusCode === 429 ||
        errorMessage.includes('503') ||
        errorMessage.toLowerCase().includes('high demand') ||
        errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED');

      if (isTemporaryError && attempt < retries) {
        console.warn(`⚠️ Gemini 503 error on attempt ${attempt}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Wait slightly longer on the next retry
      } else {
        throw error; // Pass error up if retries are exhausted or it's a hard error
      }
    }
  }
}

async function parseAddressWithAI(rawQuery) {
  const prompt = `
    You are an expert real estate address validator and parser for Lahore, Punjab, Pakistan.
    Analyze this user input: "${rawQuery}"

    Rules:
    1. Check if the input contains any meaningful location, road, neighborhood, or area name in Lahore.
    2. If invalid (e.g. only house numbers like "h.no 2"), set "is_valid_location" to false.
    3. Correct spelling mistakes ("sanat nagar" -> "Sant Nagar", "eslampura" -> "Islampura").
    4. Extract ALL meaningful search keywords.
    5. Alwasy Remove the Lahore keyword from the search keywords.

    Return JSON ONLY:
    {
      "is_valid_location": true,
      "message": "",
      "corrected_address": "corrected text",
      "search_keywords": ["Sant Nagar", "Islampura"]
    }
  `;

  try {
    const response = await callGeminiWithRetry(prompt, 3, 600);
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Parsing Error after retries:", error.message);

    const errorMessage = String(error?.message || '');
    const isTemporaryError =
      error?.status === 503 ||
      error?.statusCode === 503 ||
      error?.status === 429 ||
      error?.statusCode === 429 ||
      errorMessage.includes('503') ||
      errorMessage.toLowerCase().includes('high demand') ||
      errorMessage.includes('429') ||
      errorMessage.includes('RESOURCE_EXHAUSTED');

    if (isTemporaryError) {
      error.isAiError = true;
      error.status = 503;
      throw error;
    }
    
    // Fallback to local regex cleaning if AI is completely unreachable
    return {
      is_valid_location: true,
      message: "",
      corrected_address: rawQuery,
      search_keywords: rawQuery.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
    };
  }
}

module.exports = { parseAddressWithAI };