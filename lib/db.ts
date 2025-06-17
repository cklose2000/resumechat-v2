import { neon } from '@neondatabase/serverless';

// Export the sql template tag for edge-compatible queries
export const sql = neon(process.env.DATABASE_URL!);

// Type definitions for our database
export interface Resume {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  summary?: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  location?: string;
  salary_expectation?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Experience {
  company: string;
  position: string;
  start_date: string;
  end_date?: string;
  description: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  graduation_date: string;
}

export interface SearchLog {
  id: string;
  user_id: string;
  query: string;
  results_count: number;
  clicked_results: string[];
  timestamp: Date;
}

// Database queries
export async function getResumesForUser(userId: string): Promise<Resume[]> {
  return sql`
    SELECT r.* 
    FROM resumes r
    JOIN resume_permissions rp ON r.id = rp.resume_id
    WHERE rp.user_id = ${userId}
    ORDER BY r.created_at DESC
  `;
}

export async function getResumeById(id: string, userId: string): Promise<Resume | null> {
  const result = await sql`
    SELECT r.* 
    FROM resumes r
    JOIN resume_permissions rp ON r.id = rp.resume_id
    WHERE r.id = ${id} AND rp.user_id = ${userId}
  `;
  
  return result[0] as Resume || null;
}

export async function createResume(resume: Omit<Resume, 'id' | 'created_at' | 'updated_at'>): Promise<Resume> {
  const result = await sql`
    INSERT INTO resumes (user_id, name, email, phone, summary, skills, experience, education, location, salary_expectation)
    VALUES (${resume.user_id}, ${resume.name}, ${resume.email}, ${resume.phone}, ${resume.summary}, 
            ${JSON.stringify(resume.skills)}, ${JSON.stringify(resume.experience)}, 
            ${JSON.stringify(resume.education)}, ${resume.location}, ${resume.salary_expectation})
    RETURNING *
  `;
  
  return result[0] as Resume;
}

export async function logSearch(userId: string, query: string, resultsCount: number): Promise<void> {
  await sql`
    INSERT INTO search_logs (user_id, query, results_count)
    VALUES (${userId}, ${query}, ${resultsCount})
  `;
}

export async function getSearchAnalytics(days: number = 7) {
  return sql`
    SELECT 
      DATE_TRUNC('day', timestamp) as day,
      COUNT(*) as search_count,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(results_count) as avg_results
    FROM search_logs
    WHERE timestamp > NOW() - INTERVAL '${days} days'
    GROUP BY day
    ORDER BY day DESC
  `;
}

export async function getPopularSearches(limit: number = 10) {
  return sql`
    SELECT 
      query,
      COUNT(*) as count,
      AVG(results_count) as avg_results
    FROM search_logs
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY query
    ORDER BY count DESC
    LIMIT ${limit}
  `;
}

// Initialize database schema
export const initSchema = `
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT NOW()
  );

  -- Resumes table
  CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    summary TEXT,
    skills JSONB DEFAULT '[]',
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    location VARCHAR(255),
    salary_expectation INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  -- Resume permissions
  CREATE TABLE IF NOT EXISTS resume_permissions (
    resume_id UUID REFERENCES resumes(id),
    user_id UUID REFERENCES users(id),
    PRIMARY KEY (resume_id, user_id)
  );

  -- Search logs for analytics
  CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_results JSONB DEFAULT '[]',
    timestamp TIMESTAMP DEFAULT NOW()
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_resumes_skills ON resumes USING GIN (skills);
  CREATE INDEX IF NOT EXISTS idx_search_logs_timestamp ON search_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_search_logs_user ON search_logs(user_id);
`;