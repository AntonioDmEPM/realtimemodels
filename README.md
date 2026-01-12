# EPAM AI/Run.Transform SandBox

Enterprise-grade AI conversation platform enabling both real-time voice conversations and text chat interactions with advanced AI models.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-blue)

## 🎯 Overview

A sophisticated sandbox environment for testing and experimenting with:
- **Voice Mode**: OpenAI's Realtime API (GPT-4o) with WebRTC
- **Chat Mode**: Google Gemini 2.5 and GPT-5 models

### Key Features

- ✅ Real-time voice conversations using WebRTC
- ✅ Text-based chat with multiple AI models
- ✅ Knowledge base integration with semantic search
- ✅ Web search with multiple providers (SearchAPI, SerpAPI)
- ✅ Real-time sentiment analysis and adaptive tone control
- ✅ Content validation system
- ✅ Comprehensive analytics and token tracking
- ✅ Session save/load functionality
- ✅ Production-ready error handling
- ✅ Automated testing with Vitest
- ✅ CI/CD pipeline with GitHub Actions

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Supabase account
- OpenAI API key (for Realtime API)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd realtimemodels
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
```

4. **Run development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173`

## 🏗️ Architecture

### Project Structure

```
/
├── src/
│   ├── components/          # React components (82 components)
│   │   ├── ui/             # shadcn/ui components (48)
│   │   └── views/          # Main view components (5)
│   ├── pages/              # Route pages (6 pages)
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── integrations/       # External service integrations
│   └── test/               # Test utilities and setup
├── supabase/
│   ├── functions/          # Edge Functions (8 functions)
│   └── migrations/         # Database schemas
└── .github/
    └── workflows/          # CI/CD pipelines
```

### Technology Stack

**Frontend:** React 18.3 + TypeScript + Vite + shadcn/ui + Tailwind CSS

**Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Vector Search)

**AI:** OpenAI Realtime API, Google Gemini 2.5, GPT-5, WebRTC

**Testing:** Vitest + React Testing Library + GitHub Actions

## 📝 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking

# Testing
npm run test             # Run tests in watch mode
npm run test:ui          # Run tests with UI
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage
```

### Testing

```bash
npm run test           # Watch mode
npm run test:coverage  # With coverage report
```

## 🔐 Environment Variables

Required environment variables (see `.env.example`):

```env
VITE_SUPABASE_PROJECT_ID     # Supabase project ID
VITE_SUPABASE_PUBLISHABLE_KEY # Supabase anon/public key
VITE_SUPABASE_URL            # Supabase project URL
```

**⚠️ IMPORTANT**: Never commit the `.env` file to version control!

## 🚀 Deployment

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🧪 CI/CD Pipeline

Automated checks run on every push and pull request:

1. **Lint** - ESLint checks
2. **Type Check** - TypeScript compilation
3. **Test** - Unit and integration tests
4. **Build** - Production build verification

See `.github/workflows/ci.yml` for details.

## 🐛 Troubleshooting

### Common Issues

**Build fails with type errors:**
```bash
npx tsc --noEmit
npm run lint -- --fix
```

**Tests failing:**
```bash
npm run test -- --clearCache
```

**WebRTC connection fails:**
- Check Supabase Edge Function logs
- Verify OpenAI API key configuration
- Ensure microphone permissions granted

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new functionality
5. Ensure all tests pass
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Backend powered by [Supabase](https://supabase.com/)
- AI models by [OpenAI](https://openai.com/) and [Google](https://ai.google.dev/)

---

**Built with ❤️ by the EPAM AI Team**
