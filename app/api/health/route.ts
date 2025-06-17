import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  try {
    // Test database connectivity
    const result = await sql`SELECT 1 as connected`;
    const dbHealthy = result.length > 0 && result[0].connected === 1;
    
    // Check environment variables
    const envCheck = {
      database: !!process.env.DATABASE_URL,
      jwt: !!process.env.JWT_SECRET,
      openai: !!process.env.OPENAI_API_KEY,
      kv: !!process.env.KV_REST_API_URL,
    };
    
    const allEnvPresent = Object.values(envCheck).every(v => v === true);
    const healthy = dbHealthy && allEnvPresent;
    
    return NextResponse.json(
      {
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy,
          environment: envCheck,
        },
        version: '2.0.0',
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}