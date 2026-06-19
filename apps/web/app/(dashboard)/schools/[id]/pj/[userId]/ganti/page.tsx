'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api, type ApiResponse } from '@/lib/api';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { PjSekolahForm } from '../../PjSekolahForm';
import type { SchoolDetail } from '@/lib/types';

export default function GantiPjItemPage() {
  const { id, userId } = useParams<{ id: string; userId: string }>();

  const { data: school, isLoading } = useQuery<SchoolDetail>({
    queryKey: ['school', id],
    queryFn: async () => (await api.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)).data.data,
    enabled: !!id,
  });

  const pj = school?.pjUsers.find((p) => p.id === userId);

  if (isLoading) {
    return <LoadingSkeleton className="mx-auto mt-8 h-64 max-w-lg rounded-2xl" />;
  }

  if (!pj) return null;

  return <PjSekolahForm replace replaceUserId={pj.id} replaceUserName={pj.name} />;
}
