'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUSES = ['HADIR', 'IZIN', 'SAKIT', 'TIDAK_HADIR'] as const;
const statusColors: Record<string, string> = {
  HADIR: 'bg-green-100 text-green-700 border-green-300',
  IZIN: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  SAKIT: 'bg-blue-100 text-blue-700 border-blue-300',
  TIDAK_HADIR: 'bg-red-100 text-red-700 border-red-300',
};

export default function IsiEvaluasiPage() {
  const router = useRouter();
  const [groupId, setGroupId] = useState('');
  const [weekDate, setWeekDate] = useState('');
  const [notes, setNotes] = useState('');
  const [attendances, setAttendances] = useState<{ userId: string; name: string; status: string; note?: string }[]>([]);
  const [evalId, setEvalId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.get<ApiResponse>('/groups')).data.data,
  });

  useEffect(() => {
    if (groups?.length && !groupId) setGroupId(groups[0].id);
    const monday = new Date();
    const day = monday.getDay();
    monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
    setWeekDate(monday.toISOString().split('T')[0]);
  }, [groups, groupId]);

  useEffect(() => {
    if (!groupId) return;
    api.get<ApiResponse>(`/groups/${groupId}`).then((res) => {
      setAttendances(res.data.data.members.map((m: { user: { id: string; name: string } }) => ({
        userId: m.user.id, name: m.user.name, status: 'HADIR',
      })));
    });
  }, [groupId]);

  const loadExisting = async () => {
    if (!groupId || !weekDate) return;
    try {
      const res = await api.get<ApiResponse>(`/evaluations?groupId=${groupId}&weekDate=${weekDate}`);
      if (res.data.data?.[0]) {
        const ev = res.data.data[0];
        setEvalId(ev.id);
        setNotes(ev.notes || '');
        setAttendances(ev.attendances.map((a: { userId: string; status: string; note?: string; user: { name: string } }) => ({
          userId: a.userId, name: a.user.name, status: a.status, note: a.note,
        })));
      }
    } catch { /* no existing */ }
  };

  useEffect(() => { loadExisting(); }, [groupId, weekDate]);

  const save = async (submit = false) => {
    try {
      setLoading(true);
      setError('');
      const payload = { groupId, weekDate, notes, attendances: attendances.map(({ userId, status, note }) => ({ userId, status, note })) };
      let id = evalId;
      if (id) {
        await api.put(`/evaluations/${id}`, payload);
      } else {
        const res = await api.post<ApiResponse>('/evaluations', payload);
        id = res.data.data.id;
        setEvalId(id);
      }
      if (submit) {
        await api.post(`/evaluations/${id}/submit`);
        router.push('/evaluasi');
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Isi Evaluasi Mingguan</h1>
      <Card>
        <CardHeader><CardTitle>Form Evaluasi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Kelompok</Label>
            <select className="flex h-10 w-full rounded-md border px-3" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {groups?.map((g: { id: string; name: string }) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Pekan (Senin)</Label>
            <Input type="date" value={weekDate} onChange={(e) => setWeekDate(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label>Kehadiran Anggota</Label>
            {attendances.map((att, i) => (
              <div key={att.userId} className="rounded-lg border p-3">
                <p className="mb-2 font-medium">{att.name}</p>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAttendances((prev) => prev.map((a, j) => j === i ? { ...a, status: s } : a))}
                      className={cn('rounded-full border px-3 py-1 text-xs font-medium', att.status === s ? statusColors[s] : 'border-gray-200')}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>Catatan Umum</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => save(false)} disabled={loading} variant="outline">Simpan Draft</Button>
            <Button onClick={() => save(true)} disabled={loading}>Submit Final</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
