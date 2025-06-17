import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/auth';
import { z } from 'zod';

// Validation schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = registerSchema.parse(body);
    
    const user = await register(email, password, name);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Registration failed' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', issues: error.issues },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message === 'User already exists') {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }
    
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}