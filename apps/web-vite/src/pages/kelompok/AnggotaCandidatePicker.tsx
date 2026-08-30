import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { AnggotaCandidate } from '@/lib/types';

export function candidateOptionLabel(c: AnggotaCandidate) {
  const last = c.lastGroupName ? ` · pernah di ${c.lastGroupName}` : '';
  return `${c.name} (${c.email})${last}`;
}

export function useAnggotaCandidates(groupId?: string) {
  return useQuery<AnggotaCandidate[]>({
    queryKey: ['member-candidates', groupId],
    queryFn: async () =>
      (await api.get<ApiResponse<AnggotaCandidate[]>>(`/groups/${groupId}/member-candidates`)).data
        .data ?? [],
    enabled: !!groupId,
  });
}

type Props = {
  groupId?: string;
  value: string;
  onChange: (userId: string) => void;
};

export function AnggotaCandidatePicker({ groupId, value, onChange }: Props) {
  const { data: candidates = [], isLoading } = useAnggotaCandidates(groupId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat daftar anggota...</p>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="anggotaUserId">Pilih anggota</Label>
      <SearchableSelect
        id="anggotaUserId"
        value={value}
        onChange={onChange}
        options={candidates.map((c) => ({ value: c.id, label: candidateOptionLabel(c) }))}
        placeholder={candidates.length ? 'Pilih anggota...' : 'Tidak ada anggota yang bisa dipilih'}
        searchPlaceholder="Cari nama atau email..."
        emptyText="Anggota tidak ditemukan"
        disabled={candidates.length === 0}
      />
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Tidak ada anggota terdaftar yang belum punya kelompok aktif. Gunakan opsi undang anggota
          baru.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Daftar berisi akun dengan peran Anggota yang belum masuk kelompok aktif, termasuk yang
          pernah dihapus dari kelompok lama.
        </p>
      )}
    </div>
  );
}
