-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  content TEXT NOT NULL,
  parsed_data JSONB,
  file_path VARCHAR(500),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resume permissions (for sharing between users)
CREATE TABLE IF NOT EXISTS resume_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resume_id, user_id)
);

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  search_type VARCHAR(50) DEFAULT 'natural_language',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations (for maintaining search context)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255),
  context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Search logs (for analytics)
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  query TEXT NOT NULL,
  response TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Resume views (for tracking which resumes were viewed)
CREATE TABLE IF NOT EXISTS resume_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id UUID NOT NULL REFERENCES resumes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  search_log_id UUID REFERENCES search_logs(id),
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_resumes_created_by ON resumes(created_by);
CREATE INDEX idx_resumes_email ON resumes(email);
CREATE INDEX idx_resumes_content_gin ON resumes USING gin(to_tsvector('english', content));
CREATE INDEX idx_resume_permissions_user ON resume_permissions(user_id);
CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_conversation ON search_logs(conversation_id);
CREATE INDEX idx_resume_views_user ON resume_views(user_id);
CREATE INDEX idx_resume_views_resume ON resume_views(resume_id);

-- Row Level Security (RLS)
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for resumes
CREATE POLICY "Users can view their own resumes" ON resumes
  FOR SELECT USING (created_by = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can view shared resumes" ON resumes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM resume_permissions
      WHERE resume_permissions.resume_id = resumes.id
      AND resume_permissions.user_id = current_setting('app.current_user_id')::uuid
      AND resume_permissions.can_view = true
    )
  );

CREATE POLICY "Users can insert their own resumes" ON resumes
  FOR INSERT WITH CHECK (created_by = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can update their own resumes" ON resumes
  FOR UPDATE USING (created_by = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can update shared resumes with edit permission" ON resumes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM resume_permissions
      WHERE resume_permissions.resume_id = resumes.id
      AND resume_permissions.user_id = current_setting('app.current_user_id')::uuid
      AND resume_permissions.can_edit = true
    )
  );

-- RLS Policies for other tables
CREATE POLICY "Users can view their own data" ON search_history
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can view their own conversations" ON conversations
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can view their own search logs" ON search_logs
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY "Users can view their own resume views" ON resume_views
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'admin@resumechat.com',
  '$2a$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
  'Admin User',
  'admin'
) ON CONFLICT (email) DO NOTHING;