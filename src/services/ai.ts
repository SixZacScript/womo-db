export interface QueryGenerationRequest {
  prompt: string;
  collectionName: string;
  sampleFields: string[];
}

export interface QueryGenerationResponse {
  query: string;
  explanation: string;
}

// LM Studio Local API
const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";

export async function generateMongoQuery(
  request: QueryGenerationRequest,
  apiKey: string
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
    const response = await fetch(LM_STUDIO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${error}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || "{}";

    // Extract JSON from response (remove markdown if present)
    let query = generatedText.trim();

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
