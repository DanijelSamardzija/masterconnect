import { ProtectedRoute } from '@/components/protected-route';
import { AdminContent } from './_components/AdminContent';

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminContent />
    </ProtectedRoute>
  );
}
