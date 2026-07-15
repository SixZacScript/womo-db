export interface QueryGenerationRequest {
  prompt: string;
  collectionName: string;
  sampleFields: string[];
}

export interface QueryGenerationResponse {
  query: string;
  explanation: string;
}

// Chrome Built-in AI (Gemini Nano)
// Requires Chrome 127+ with AI features enabled
export async function generateMongoQuery(
  request: QueryGenerationRequest,
  _apiKey: string
): Promise<QueryGenerationResponse> {
  const systemPrompt = `You are a MongoDB query expert. Generate valid MongoDB query JSON based on user requests.

Collection: ${request.collectionName}
Available fields: ${request.sampleFields.join(", ")}

Rules:
- Return ONLY valid MongoDB query JSON (no code blocks, no markdown, no explanation)
- Use proper MongoDB operators ($eq, $gt, $lt, $gte, $lte, $in, $regex, $and, $or, etc.)
- Keep queries simple and efficient
- For text search, use $regex with case-insensitive flag

User request: ${request.prompt}

Return only the MongoDB query JSON:`;

  try {
    // Check if Chrome AI is available
    if (!('ai' in window) || !('languageModel' in (window as any).ai)) {
      throw new Error("Chrome Built-in AI not available. Please use Chrome 127+ and enable AI features at chrome://flags/#optimization-guide-on-device-model");
    }

    const ai = (window as any).ai;

    // Check availability
    const availability = await ai.languageModel.capabilities();
    if (availability.available === "no") {
      throw new Error("Chrome AI model not available. Please enable it in Chrome settings.");
    }

    // Create session
    const session = await ai.languageModel.create({
      systemPrompt,
      temperature: 0.3,
      topK: 3,
    });

    // Generate response
    const result = await session.prompt(request.prompt);

    // Cleanup
    session.destroy();

    // Extract JSON from response (remove markdown if present)
    let query = result.trim();

    // Remove markdown code blocks
    if (query.includes("```")) {
      const jsonMatch = query.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        query = jsonMatch[1].trim();
      }
    }

    return {
      query,
      explanation: `Generated query for: "${request.prompt}"`,
    };
  } catch (error) {
    throw new Error(`Failed to generate query: ${error}`);
  }
}
