import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface))]" aria-busy="true" aria-label="Memuat" />
    );
  }

  return <Navigate to={accessToken ? '/dashboard' : '/login'} replace />;
}
