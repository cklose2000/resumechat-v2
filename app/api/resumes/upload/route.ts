import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createResume } from '@/lib/db';
import { parseResume, validateParsedResume } from '@/lib/llm-whisperer';
import { z } from 'zod';

export const runtime = 'edge';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: PDF, DOCX, TXT' },
        { status: 400 }
      );
    }
    
    // Parse resume using LLM Whisperer
    const parsedResume = await parseResume(file);
    
    // Validate parsed data
    const errors = validateParsedResume(parsedResume);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Failed to parse resume', details: errors },
        { status: 400 }
      );
    }
    
    // Create resume in database
    const resume = await createResume({
      user_id: user.id,
      name: parsedResume.name,
      email: parsedResume.email,
      phone: parsedResume.phone,
      summary: parsedResume.summary,
      skills: parsedResume.skills,
      experience: parsedResume.experience,
      education: parsedResume.education,
      location: parsedResume.location,
      salary_expectation: undefined, // Would need to parse this
    });
    
    return NextResponse.json({
      success: true,
      resume,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload resume' },
      { status: 500 }
    );
  }
}