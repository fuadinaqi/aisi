
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useActiveRole } from '@/components/layout/RoleGuard';
import { useAuthStore } from '@/store/authStore';

export type PointLogItem = {
  id: string;
  points: number;
  description: string;
  createdAt: string;
};

type PointsMeData = {
  totalPoints: number;
  logs: PointLogItem[];
  eligible: boolean;
};

export function useMyPoints(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const role = useActiveRole();
  const updateTotalPoints = useAuthStore((s) => s.updateTotalPoints);
  const showPoints = role === 'PEMBINA' || role === 'ANGGOTA';

  const query = useQuery<PointsMeData>({
    queryKey: ['points-me', role],
    queryFn: async () => (await api.get<ApiResponse<PointsMeData>>('/points/me')).data.data,
    enabled: enabled && showPoints && !!user,
  });

  useEffect(() => {
    if (query.data?.totalPoints !== undefined) {
      updateTotalPoints(query.data.totalPoints);
    }
  }, [query.data?.totalPoints, updateTotalPoints]);

  return {
    ...query,
    totalPoints: query.data?.totalPoints ?? user?.totalPoints ?? 0,
    logs: query.data?.logs ?? [],
    showPoints,
  };
}
