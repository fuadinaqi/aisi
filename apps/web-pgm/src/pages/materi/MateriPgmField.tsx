import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Label } from '@/components/ui/label';
import type { SchoolItem } from '@/lib/types';

export const MATERI_VIEW_ROLES = ['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA'];

export function materiPgmLabel(schoolId?: string | null, schoolName?: string | null) {
  if (!schoolId) return 'Semua PGM';
  return schoolName?.trim() || 'PGM';
}

export function canEditMateri(role: string, schoolId?: string | null) {
  if (role === 'SUPERADMIN' || role === 'ADMIN') return true;
  return role === 'PJ_SEKOLAH' && !!schoolId;
}

export function MateriPgmField({
  role,
  value,
  onChange,
}: {
  role: string;
  value: string;
  onChange: (schoolId: string) => void;
}) {
  const isAdmin = role === 'SUPERADMIN' || role === 'ADMIN';
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools', 'materi-form'],
    queryFn: async () => (await api.get<ApiResponse<SchoolItem[]>>('/schools')).data.data ?? [],
  });

  useEffect(() => {
    if (!isAdmin && schools.length === 1 && value !== schools[0].id) {
      onChange(schools[0].id);
    }
  }, [isAdmin, onChange, schools, value]);

  if (!isAdmin && (isLoading || schools.length <= 1)) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="materi-pgm">PGM</Label>
      <select
        id="materi-pgm"
        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={!isAdmin}
      >
        {isAdmin ? <option value="">Semua PGM</option> : <option value="">Pilih PGM</option>}
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
    </div>
  );
}
