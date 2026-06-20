import type { QueryClient } from '@tanstack/react-query';

/** Ringkasan dashboard, analitik, poin, dan leaderboard. */
export async function invalidateDashboardQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['analytics'] });
  await queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
  await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  await queryClient.invalidateQueries({ queryKey: ['points-me'] });
}

/** Invalidate daftar & turunan evaluasi setelah create/update/submit. */
export async function invalidateEvaluationQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['evaluations'] });
  await invalidateDashboardQueries(queryClient);
}

/** Invalidate daftar agenda & detail event terkait. */
export async function invalidateEventQueries(
  queryClient: QueryClient,
  eventId?: string,
  opts?: { includePoints?: boolean },
) {
  await queryClient.invalidateQueries({ queryKey: ['events'] });
  if (eventId) {
    await queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  }
  if (opts?.includePoints) {
    await invalidateDashboardQueries(queryClient);
  }
}

/** Invalidate daftar materi setelah create/update. */
export async function invalidateMateriQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['materi'] });
}

/** Invalidate undangan setelah kirim/resend. */
export async function invalidateInvitationQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['invitations'] });
}

/** Invalidate sekolah setelah create/update PJ/kelompok. */
export async function invalidateSchoolQueries(queryClient: QueryClient, schoolId?: string) {
  await queryClient.invalidateQueries({ queryKey: ['schools'] });
  if (schoolId) {
    await queryClient.invalidateQueries({ queryKey: ['school', schoolId] });
  }
  await invalidateDashboardQueries(queryClient);
}

/** Invalidate kelompok setelah create/update/anggota. */
export async function invalidateGroupQueries(
  queryClient: QueryClient,
  opts?: { groupId?: string; schoolId?: string },
) {
  await queryClient.invalidateQueries({ queryKey: ['groups'] });
  if (opts?.groupId) {
    await queryClient.invalidateQueries({ queryKey: ['group', opts.groupId] });
  }
  if (opts?.schoolId) {
    await queryClient.invalidateQueries({ queryKey: ['school', opts.schoolId] });
    await queryClient.invalidateQueries({ queryKey: ['school-pembina', opts.schoolId] });
  }
  await invalidateDashboardQueries(queryClient);
}

/** Invalidate label level kelompok setelah konfigurasi diubah. */
export async function invalidateConfigQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['group-levels'] });
}

/** Invalidate master & entri mutabaah. */
export async function invalidateMutabaahQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['mutabaah-items'] });
  await queryClient.invalidateQueries({ queryKey: ['mutabaah-my'] });
  await queryClient.invalidateQueries({ queryKey: ['mutabaah-member'] });
  await queryClient.invalidateQueries({ queryKey: ['mutabaah-group'] });
  await invalidateDashboardQueries(queryClient);
}

/** Invalidate master & progress indikator capaian. */
export async function invalidateICQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['ic-items'] });
  await queryClient.invalidateQueries({ queryKey: ['ic-member'] });
}

/** Invalidate notifikasi setelah ditandai dibaca. */
export async function invalidateNotificationQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

/** Invalidate daftar KKS setelah kirim/update. */
export async function invalidateKksQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ['kks'] });
  await invalidateNotificationQueries(queryClient);
}
