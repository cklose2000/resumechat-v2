import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getResumesForUser, createResume } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'edge';

// GET /api/resumes - Get all resumes for authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const resumes = await getResumesForUser(user.id);
    
    return NextResponse.json({ resumes });
  } catch (error) {
    console.error('Get resumes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    );
  }
}

// POST /api/resumes - Create a new resume
const createResumeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  content: z.string(),
  parsed_data: z.any().optional(),
  file_path: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const resumeData = createResumeSchema.parse(body);
    
    const resume = await createResume(
      {
        ...resumeData,
        created_by: user.id,
      },
      user.id
    );
    
    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', issues: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Create resume error:', error);
    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 }
    );
  }
}