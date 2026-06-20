'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { isPointEligibleRole } from '@/lib/utils';

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
  const updateTotalPoints = useAuthStore((s) => s.updateTotalPoints);
  const showPoints = user ? isPointEligibleRole(user.roles) : false;

  const query = useQuery<PointsMeData>({
    queryKey: ['points-me'],
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
