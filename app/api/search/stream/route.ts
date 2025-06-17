import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getResumesForUser } from '@/lib/db';
import { createStreamingResponse } from '@/lib/ai';
import OpenAI from 'openai';
import { z } from 'zod';

export const runtime = 'edge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const streamSearchSchema = z.object({
  query: z.string().min(1).max(500),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { query, conversationHistory = [] } = streamSearchSchema.parse(body);
    
    // Get user's accessible resumes
    const resumes = await getResumesForUser(user.id);
    
    if (resumes.length === 0) {
      return NextResponse.json({
        error: 'No resumes available for search.',
      });
    }
    
    // Prepare context
    const resumeContext = resumes.map((r, index) => 
      `Resume ${index + 1} (ID: ${r.id}):\n` +
      `Name: ${r.name}\n` +
      `Skills: ${r.skills.join(', ')}\n` +
      `Experience: ${r.experience.map(e => `${e.position} at ${e.company}`).join('; ')}`
    ).join('\n\n');
    
    // Create streaming completion
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a helpful resume search assistant. You have access to these resumes:\n\n${resumeContext}\n\nProvide helpful, conversational responses about the candidates.`,
        },
        ...conversationHistory,
        { role: 'user', content: query },
      ],
      stream: true,
      temperature: 0.7,
    });
    
    return createStreamingResponse(stream);
  } catch (error) {
    console.error('Stream search error:', error);
    return NextResponse.json(
      { error: 'Stream search failed' },
      { status: 500 }
    );
  }
}