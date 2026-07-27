import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';

export type GroupLevelConfig = { level: string; label: string };

export function useGroupLevelLabels() {
  const { data: configs = [], isLoading } = useQuery<GroupLevelConfig[]>({
    queryKey: ['group-levels'],
    queryFn: async () =>
      (await api.get<ApiResponse<GroupLevelConfig[]>>('/config/group-levels')).data.data,
  });

  const levelLabels = useMemo(
    () => Object.fromEntries(configs.map((cfg) => [cfg.level, cfg.label])),
    [configs],
  );

  const getLevelLabel = (level: string | undefined | null, fallback = '-') =>
    (level && levelLabels[level]) || level || fallback;

  return { configs, levelLabels, getLevelLabel, isLoading };
}
