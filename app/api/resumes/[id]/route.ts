import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getResumeById, updateResume, deleteResume, logResumeView } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'edge';

// GET /api/resumes/[id] - Get a specific resume
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const resume = await getResumeById(params.id, user.id);
    
    if (!resume) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }
    
    // Log the view if coming from a search
    const searchLogId = request.nextUrl.searchParams.get('searchLogId');
    if (searchLogId) {
      await logResumeView(params.id, searchLogId, user.id);
    }
    
    return NextResponse.json({ resume });
  } catch (error) {
    console.error('Get resume error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resume' },
      { status: 500 }
    );
  }
}

// PUT /api/resumes/[id] - Update a resume
const updateResumeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  content: z.string().optional(),
  parsed_data: z.any().optional(),
  file_path: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const updates = updateResumeSchema.parse(body);
    
    const resume = await updateResume(params.id, updates, user.id);
    
    if (!resume) {
      return NextResponse.json(
        { error: 'Resume not found or no permission to update' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ resume });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', issues: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Update resume error:', error);
    return NextResponse.json(
      { error: 'Failed to update resume' },
      { status: 500 }
    );
  }
}

// DELETE /api/resumes/[id] - Delete a resume
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const success = await deleteResume(params.id, user.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Resume not found or no permission to delete' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete resume error:', error);
    return NextResponse.json(
      { error: 'Failed to delete resume' },
      { status: 500 }
    );
  }
}