import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { 
  getResumesForUser, 
  logSearch, 
  createConversation,
  updateConversation,
  getConversation 
} from '@/lib/db';
import { searchResumes } from '@/lib/ai';
import { getCachedSearch, setCachedSearch } from '@/lib/cache';
import { z } from 'zod';

export const runtime = 'edge'; // Use Edge Runtime for better performance

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  conversationId: z.string().uuid().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { query, conversationId, conversationHistory = [] } = searchSchema.parse(body);
    
    // Check cache first
    const cached = await getCachedSearch(user.id, query);
    if (cached) {
      await logSearch({
        query,
        response: cached.explanation,
        conversation_id: conversationId,
        cache_hit: true,
        latency_ms: Date.now() - startTime,
      }, user.id);
      
      return NextResponse.json({
        results: cached.results,
        explanation: cached.explanation,
        cached: true,
        conversationId,
      });
    }
    
    // Get user's accessible resumes
    const resumes = await getResumesForUser(user.id);
    
    if (resumes.length === 0) {
      return NextResponse.json({
        results: [],
        explanation: 'No resumes available for search.',
        cached: false,
        conversationId,
      });
    }
    
    // Create or update conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const conversation = await createConversation(user.id, query);
      currentConversationId = conversation.id;
    } else {
      // Verify conversation belongs to user
      const conversation = await getConversation(currentConversationId, user.id);
      if (!conversation) {
        return NextResponse.json(
          { error: 'Invalid conversation' },
          { status: 403 }
        );
      }
    }
    
    // Perform AI search
    const { results, explanation } = await searchResumes(
      query,
      resumes,
      conversationHistory
    );
    
    // Update conversation context
    await updateConversation(
      currentConversationId,
      {
        context: {
          lastQuery: query,
          lastResults: results.map(r => ({ id: r.id, name: r.name })),
          history: [...conversationHistory, 
            { role: 'user', content: query },
            { role: 'assistant', content: explanation }
          ],
        },
      },
      user.id
    );
    
    // Log search for analytics
    const latency = Date.now() - startTime;
    await logSearch({
      query,
      response: explanation,
      conversation_id: currentConversationId,
      tokens_used: Math.ceil(explanation.length / 4), // Rough estimate
      latency_ms: latency,
      cache_hit: false,
    }, user.id);
    
    // Cache results
    await setCachedSearch(user.id, query, results, explanation);
    
    return NextResponse.json({
      results,
      explanation,
      cached: false,
      conversationId: currentConversationId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', issues: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}