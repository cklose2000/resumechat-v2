import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getResumesForUser, logSearch } from '@/lib/db';
import { searchResumes } from '@/lib/ai';
import { getCachedSearch, setCachedSearch } from '@/lib/cache';
import { z } from 'zod';

export const runtime = 'edge'; // Use Edge Runtime for better performance

const searchSchema = z.object({
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
    const { query, conversationHistory = [] } = searchSchema.parse(body);
    
    // Check cache first
    const cached = await getCachedSearch(user.id, query);
    if (cached) {
      return NextResponse.json({
        results: cached.results,
        explanation: cached.explanation,
        cached: true,
      });
    }
    
    // Get user's accessible resumes
    const resumes = await getResumesForUser(user.id);
    
    if (resumes.length === 0) {
      return NextResponse.json({
        results: [],
        explanation: 'No resumes available for search.',
        cached: false,
      });
    }
    
    // Perform AI search
    const { results, explanation } = await searchResumes(
      query,
      resumes,
      conversationHistory
    );
    
    // Log search for analytics
    await logSearch(user.id, query, results.length);
    
    // Cache results
    await setCachedSearch(user.id, query, results, explanation);
    
    return NextResponse.json({
      results,
      explanation,
      cached: false,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}