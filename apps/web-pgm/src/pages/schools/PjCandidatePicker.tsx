import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getPrimaryRole, getRoleLabel } from '@/lib/utils';
import type { PjCandidate } from '@/lib/types';

export function candidateOptionLabel(c: PjCandidate) {
  const role = getRoleLabel(getPrimaryRole(c.roles || []));
  const pjNames = (c.pjSchools || []).map((s) => s.name).filter(Boolean);
  const pjHint = pjNames.length ? ` · pengurus di ${pjNames.join(', ')}` : '';
  return `${c.name} (${c.email}) · ${role}${pjHint}`;
}

export function usePjCandidates(schoolId?: string) {
  return useQuery<PjCandidate[]>({
    queryKey: ['pj-candidates', schoolId ?? 'new'],
    queryFn: async () => {
      const path = schoolId ? `/schools/${schoolId}/pj-candidates` : '/schools/pj-candidates';
      return (await api.get<ApiResponse<PjCandidate[]>>(path)).data.data ?? [];
    },
  });
}

type Props = {
  schoolId?: string;
  value: string;
  onChange: (userId: string) => void;
  targetSchoolName?: string;
};

export function PjCandidatePicker({ schoolId, value, onChange, targetSchoolName }: Props) {
  const { data: candidates = [], isLoading } = usePjCandidates(schoolId);
  const selected = candidates.find((c) => c.id === value);
  const otherPjSchools = (selected?.pjSchools || []).filter((s) => s.id !== schoolId);
  const destination = targetSchoolName || 'PGM ini';

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat daftar user...</p>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="pjUserId">Pilih user</Label>
      <SearchableSelect
        id="pjUserId"
        value={value}
        onChange={onChange}
        options={candidates.map((c) => ({ value: c.id, label: candidateOptionLabel(c) }))}
        placeholder={candidates.length ? 'Pilih user...' : 'Tidak ada calon pengurus'}
        searchPlaceholder="Cari nama atau email..."
        emptyText="User tidak ditemukan"
        disabled={candidates.length === 0}
      />
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada user dengan peran Pembina ke atas. Gunakan opsi buat akun baru.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Daftar berisi user dengan peran Pembina, Pengurus PGM, Admin, atau Super Admin. Peran pengurus
          PGM akan ditambahkan otomatis. Jika user terikat PGM lain, tautan itu dilepas agar
          ia hanya jadi pengurus di PGM ini.
        </p>
      )}
      {selected && otherPjSchools.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {selected.name} saat ini pengurus di {otherPjSchools.map((s) => s.name).join(', ')}. Jika
          dipilih, ia akan pindah menjadi pengurus {destination}. PGM lama harus tetap punya pengurus lain.
        </div>
      )}
    </div>
  );
}
