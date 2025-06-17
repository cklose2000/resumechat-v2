# ResumeChat v2

AI-powered conversational resume search system built with Next.js 14, TypeScript, and PostgreSQL.

## 🚀 One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcklose2000%2Fresumechat-v2&env=DATABASE_URL,JWT_SECRET,OPENAI_API_KEY,KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Required%20environment%20variables%20for%20ResumeChat&project-name=resumechat&repository-name=resumechat-v2)

## 📋 Prerequisites

1. **PostgreSQL Database** - Get one free at [Neon](https://neon.tech)
2. **OpenAI API Key** - From [OpenAI Platform](https://platform.openai.com)
3. **Vercel KV** - For caching (created automatically during Vercel deployment)

## 🔧 Environment Variables

Create a `.env.local` file with:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Authentication
JWT_SECRET=your-secret-key-min-32-chars

# OpenAI
OPENAI_API_KEY=sk-...

# Vercel KV (for caching)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

## 🛠️ Local Development

1. **Clone and install:**
```bash
git clone https://github.com/cklose2000/resumechat-v2
cd resumechat-v2
npm install
```

2. **Set up database:**
```bash
npm run db:setup
```

3. **Start development server:**
```bash
npm run dev
```

4. **Access the app:**
- Frontend: http://localhost:3000
- API Health: http://localhost:3000/api/health

## 📚 API Endpoints

### Authentication
- `POST /api/auth` - Login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user
- `DELETE /api/auth` - Logout

### Resume Management
- `GET /api/resumes` - List all resumes
- `POST /api/resumes` - Create new resume
- `GET /api/resumes/[id]` - Get specific resume
- `PUT /api/resumes/[id]` - Update resume
- `DELETE /api/resumes/[id]` - Delete resume

### Search
- `POST /api/search` - Natural language resume search

### Analytics
- `GET /api/analytics` - Search analytics dashboard data

## 🏗️ Architecture

- **Frontend**: Next.js 14 App Router with TypeScript
- **Backend**: Next.js API Routes (Edge Runtime)
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Auth**: JWT with secure httpOnly cookies
- **AI**: OpenAI GPT-4 for natural language search
- **Cache**: Vercel KV for response caching

## 🔒 Security Features

- Row-Level Security (RLS) for data isolation
- Secure password hashing with bcrypt
- JWT authentication with httpOnly cookies
- Input validation with Zod
- SQL injection protection with parameterized queries

## 📈 Features

- 🔍 Natural language resume search
- 💬 Conversational search with context
- 🎯 Smart candidate matching
- 📊 Analytics and search insights
- ⚡ Sub-200ms response times with caching
- 🔒 Multi-tenant access control

## 🚀 Deployment

### Vercel (Recommended)

1. Click the "Deploy with Vercel" button above
2. Fill in environment variables
3. Deploy!

### Manual Deployment

1. Fork this repository
2. Connect to Vercel
3. Add environment variables
4. Deploy

## 📝 Database Setup

Run the migration to set up your database schema:

```bash
npm run db:migrate
```

This creates:
- Users table with role-based access
- Resumes table with full-text search
- Search history and analytics tables
- Row-Level Security policies

## 🧪 Default Credentials

After running migrations, you can login with:
- Email: `admin@resumechat.com`
- Password: `admin123`

**Important**: Change this password immediately in production!

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details.