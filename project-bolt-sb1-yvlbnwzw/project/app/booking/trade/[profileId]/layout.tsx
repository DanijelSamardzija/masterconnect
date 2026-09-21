import { ProtectedRoute } from '@/components/protected-route';

export default function TradeProfileLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
