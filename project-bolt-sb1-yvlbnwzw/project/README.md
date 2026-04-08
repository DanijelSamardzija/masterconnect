<<<<<<< HEAD
# MasterConnect

**Global marketplace connecting customers, service providers, and job seekers worldwide.**

MasterConnect (masterconnect.io) is a comprehensive three-sided marketplace platform that facilitates connections between:
- **Customers/Employers** who need services or want to hire
- **Service Providers (Pros)** who offer project-based services
- **Job Seekers** who are looking for employment opportunities

## Key Features

### Multi-Language Support
- **English** and **Serbian (Српски)** languages built-in
- Easy language switching with persistent preference
- Fully translated interface and navigation
- Ready for additional language expansion

### Three User Modes

#### 1. Customer/Employer Mode
- Post project-based jobs (one-time services)
- Post employment opportunities (long-term positions)
- Browse and search for service providers
- Browse and find job seekers
- Communicate via built-in messaging
- Leave reviews and ratings

#### 2. Service Provider (Pro) Mode
- Create professional profile with skills and portfolio
- Browse and apply to project-based jobs
- Receive job requests from customers
- Build reputation through customer reviews
- Showcase expertise across multiple categories

#### 3. Job Seeker Mode
- Create profile highlighting skills and experience
- Browse employment opportunities
- Connect with potential employers
- Get discovered by employers looking for talent

### Core Functionality

- **Flexible Role System**: Users can have multiple roles and switch between them seamlessly
- **Advanced Search & Filters**: Find the right match by category, location, skills, and job type
- **Real-time Messaging**: Built-in chat system for all user types to communicate
- **Review & Rating System**: Build trust through transparent feedback
- **Job Type Differentiation**:
  - Project Work: One-time jobs for service providers
  - Employment: Long-term positions for job seekers
- **Social Features**: Posts, comments, reactions, and community engagement
- **Notifications**: Stay updated on messages, job applications, and reviews

## Tech Stack

### Frontend
- **Next.js 13** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Lucide Icons** - Icon library

### Backend & Database
- **Next.js API Routes** - Serverless API
- **Supabase** - PostgreSQL database with real-time capabilities
- **Supabase Auth** - Authentication system
- **Row Level Security (RLS)** - Database-level security

### Features & Tools
- **Real-time Updates** - Supabase Realtime for live messaging
- **Email/Password Auth** - Secure user authentication
- **Multi-language (i18n)** - English & Serbian support
- **Responsive Design** - Mobile-first approach

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd masterconnect
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Copy the example env file:
```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You can find these values in your Supabase project settings under **Project Settings > API**.

### Database Setup

The database includes the following tables with full RLS policies:
- `profiles` - User profiles with multi-role support
- `pro_profiles` - Extended profiles for service providers
- `jobs` - Job postings (project work & employment)
- `threads` - Message threads
- `messages` - Real-time messaging
- `reviews` - Ratings and reviews
- `posts` - Community posts
- `comments` - Post comments
- `reactions` - Post and comment reactions
- `notifications` - User notifications
- `blocks` - User blocking
- `reports` - Content reporting

All migrations are in the `supabase/migrations/` directory.

### Running the Application

Development mode:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

Build for production:
```bash
npm run build
npm start
```

## Project Structure

```
/app
  /dashboard          - User dashboard (multi-role)
  /jobs
    /[id]            - Job details page
    /new             - Post new job
    page.tsx         - Browse jobs
  /login             - Authentication
  /messages
    /[threadId]      - Message thread
    page.tsx         - Messages list
  /posts
    /[postId]        - Post details
    page.tsx         - Community posts
  /profile
    /edit            - Edit profile
    page.tsx         - View profile
  /pros
    /[id]            - Professional profile
    page.tsx         - Browse professionals
  /settings          - User settings
  layout.tsx         - Root layout with providers

/components
  /ui                - shadcn/ui components
  navigation.tsx     - Main navigation
  language-switcher.tsx - Language selection

/lib
  /contexts
    auth-context.tsx      - Authentication
    language-context.tsx  - Multi-language support
  /translations
    en.ts                 - English translations
    sr.ts                 - Serbian translations
  /supabase
    client.ts             - Supabase configuration
  constants.ts            - App constants
  utils.ts                - Utility functions
```

## User Experience Flow

### Registration
1. User signs up with email/password
2. Selects initial role(s): Customer, Pro, or Job Seeker
3. Completes profile based on selected role(s)
4. Can add additional roles later from settings

### Customer Journey
1. Browse service providers or job seekers
2. Post a job (project work or employment opportunity)
3. Receive applications/messages
4. Communicate via built-in messaging
5. Complete job and leave review

### Service Provider Journey
1. Complete professional profile
2. Browse project-based jobs
3. Apply to relevant opportunities
4. Communicate with customers
5. Build reputation through reviews

### Job Seeker Journey
1. Create profile with skills and experience
2. Browse employment opportunities
3. Apply to positions
4. Connect with employers
5. Get hired

## Multi-Language Implementation

The application uses a custom language context system:

```typescript
// Using translations in components
import { useLanguage } from '@/lib/contexts/language-context';

function MyComponent() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div>
      <h1>{t('site.name')}</h1>
      <p>{t('home.hero.title')}</p>
    </div>
  );
}
```

Adding new languages:
1. Create translation file in `/lib/translations/`
2. Add language option in `language-switcher.tsx`
3. Update `language-context.tsx` to support new language code

## Security Features

- **Row Level Security (RLS)** on all database tables
- **Multi-role permissions** based on active role
- **Authentication required** for protected actions
- **Message privacy** - only thread participants can view
- **Content moderation** - reporting and blocking system
- **Secure profile data** - phone numbers hidden until contact
- **Email verification** - optional for enhanced security

## Key Components

### Navigation
- Dynamic based on user role
- Unread message counter
- Language switcher
- Role switcher (for multi-role users)
- Responsive mobile menu

### Messaging System
- Real-time message delivery
- Thread-based conversations
- File attachments support
- Read receipts
- Typing indicators

### Review System
- 5-star rating system
- Written reviews
- Verified reviews from completed jobs
- Average rating calculation
- Review moderation

## Future Enhancements

- Video calls integration
- Advanced payment processing
- Escrow system for projects
- Mobile apps (iOS & Android)
- Advanced analytics dashboard
- AI-powered job matching
- Multi-currency support
- Additional languages
- Verification badges
- Skills testing & certification

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**MasterConnect** - Connecting talent with opportunity worldwide 🌍
=======
# masterconnect
Platforma za majstore i poslove
>>>>>>> cb7d0a423e757fae28a223aef4ec8e0c662b5ef8
