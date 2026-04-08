'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { ProtectedRoute } from '@/components/protected-route';
import { ProfileView } from '@/components/profile-view';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';

export const revalidate = 0;

function ProfileContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  usePageTracking('profile');

  if (!profile || !user) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] min-h-screen pb-24">
      <ProfileView
        profile={profile}
        currentUserId={user.id}
        isOwnProfile={true}
        headerActions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/profile/edit')}
            className="gap-2 rounded-xl border-border hover:bg-accent transition-all duration-200"
          >
            <Edit className="h-4 w-4" />
            {t('profile.editProfile')}
          </Button>
        }
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
