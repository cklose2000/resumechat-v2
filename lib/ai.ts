import OpenAI from 'openai';
import { Resume } from './db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SearchQuery {
  skills?: string[];
  experience?: string;
  location?: string;
  role?: string;
  salary?: { min?: number; max?: number };
}

export async function parseNaturalQuery(query: string): Promise<SearchQuery> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a resume search query parser. Extract structured information from natural language queries.
        Return a JSON object with: skills (array), experience (string), location (string), role (string), salary (object with min/max).
        Only include fields that are explicitly mentioned in the query.`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  return JSON.parse(completion.choices[0].message.content || '{}');
}

export async function searchResumes(
  query: string,
  resumes: Resume[],
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{ results: Resume[]; explanation: string }> {
  const systemPrompt = `You are an AI resume search assistant. You have access to ${resumes.length} resumes.
  
  For each resume, consider:
  - Name and contact information
  - Skills (technical and soft skills)
  - Work experience and career progression
  - Education background
  - Location preferences
  - Salary expectations
  
  Respond with:
  1. A list of matching candidates (include their ID, name, and why they match)
  2. A brief explanation of your search logic
  
  Format your response as JSON with 'results' (array of IDs) and 'explanation' (string).`;

  const resumeContext = resumes.map((r, index) => 
    `Resume ${index + 1} (ID: ${r.id}):\n` +
    `Name: ${r.name}\n` +
    `Email: ${r.email}\n` +
    `Location: ${r.location || 'Not specified'}\n` +
    `Skills: ${r.skills.join(', ')}\n` +
    `Experience: ${r.experience.map(e => `${e.position} at ${e.company}`).join('; ')}\n` +
    `Education: ${r.education.map(e => `${e.degree} in ${e.field}`).join('; ')}\n` +
    `Salary Expectation: ${r.salary_expectation ? `$${r.salary_expectation}` : 'Not specified'}`
  ).join('\n\n');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Available resumes:\n${resumeContext}` },
    ...conversationHistory,
    { role: 'user', content: query },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const response = JSON.parse(completion.choices[0].message.content || '{}');
  
  // Filter resumes based on AI results
  const matchedResumes = resumes.filter(r => 
    response.results?.includes(r.id)
  );

  return {
    results: matchedResumes,
    explanation: response.explanation || 'No explanation provided',
  };
}

export function createStreamingResponse(stream: AsyncIterable<any>) {
  const encoder = new TextEncoder();
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
}