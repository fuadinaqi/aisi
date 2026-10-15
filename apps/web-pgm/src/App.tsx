import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import HomeRedirect from '@/pages/HomeRedirect';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import SetPasswordPage from '@/pages/SetPasswordPage';
import AcceptRolePage from '@/pages/AcceptRolePage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import NotificationsPage from '@/pages/notifications/NotificationsPage';
import LeaderboardPage from '@/pages/leaderboard/LeaderboardPage';
import SchoolsPage from '@/pages/schools/SchoolsPage';
import SchoolNewPage from '@/pages/schools/SchoolNewPage';
import SchoolDetailPage from '@/pages/schools/SchoolDetailPage';
import SchoolKelompokBaruPage from '@/pages/schools/SchoolKelompokBaruPage';
import SchoolPjUndangPage from '@/pages/schools/SchoolPjUndangPage';
import SchoolPjGantiPage from '@/pages/schools/SchoolPjGantiPage';
import KelompokRedirectPage from '@/pages/kelompok/KelompokRedirectPage';
import KelompokDetailPage from '@/pages/kelompok/KelompokDetailPage';
import KelompokEditPage from '@/pages/kelompok/KelompokEditPage';
import KelompokAnggotaUndangPage from '@/pages/kelompok/KelompokAnggotaUndangPage';
import KelompokAnggotaDetailPage from '@/pages/kelompok/KelompokAnggotaDetailPage';
import KelompokAnggotaEditPage from '@/pages/kelompok/KelompokAnggotaEditPage';
import UsersPage from '@/pages/users/UsersPage';
import UsersInvitePage from '@/pages/users/UsersInvitePage';
import UsersDetailPage from '@/pages/users/UsersDetailPage';
import InvitationsPage from '@/pages/invitations/InvitationsPage';
import EventsPage from '@/pages/events/EventsPage';
import EventNewPage from '@/pages/events/EventNewPage';
import EventDetailPage from '@/pages/events/EventDetailPage';
import EventCheckInsPage from '@/pages/events/EventCheckInsPage';
import MateriPage from '@/pages/materi/MateriPage';
import MateriNewPage from '@/pages/materi/MateriNewPage';
import MateriHistoryPage from '@/pages/materi/MateriHistoryPage';
import MateriEditPage from '@/pages/materi/MateriEditPage';
import MateriDetailPage from '@/pages/materi/MateriDetailPage';
import LaporanKegiatanPage from '@/pages/laporan/LaporanKegiatanPage';
import EvaluasiPage from '@/pages/evaluasi/EvaluasiPage';
import EvaluasiIsiPage from '@/pages/evaluasi/EvaluasiIsiPage';
import EvaluasiDetailPage from '@/pages/evaluasi/EvaluasiDetailPage';
import MutabaahPage from '@/pages/mutabaah/MutabaahPage';
import PembinaPage from '@/pages/pembina/PembinaPage';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import KksPage from '@/pages/kks/KksPage';
import KksDetailPage from '@/pages/kks/KksDetailPage';
import ConfigPage from '@/pages/config/ConfigPage';
import ConfigMutabaahPage from '@/pages/config/ConfigMutabaahPage';
import ConfigIcPage from '@/pages/config/ConfigIcPage';
import KebutuhanMentorPage from '@/pages/kebutuhan-mentor/KebutuhanMentorPage';
import KebutuhanMentorEditPage from '@/pages/kebutuhan-mentor/KebutuhanMentorEditPage';
import KebutuhanMentorApplicationsPage from '@/pages/kebutuhan-mentor/KebutuhanMentorApplicationsPage';
import CalonMentorPage from '@/pages/calon-mentor/CalonMentorPage';
import CalonMentorApplyPage from '@/pages/calon-mentor/CalonMentorApplyPage';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/accept-role" element={<AcceptRolePage />} />
        <Route path="/calon-mentor" element={<CalonMentorPage />} />
        <Route path="/calon-mentor/:schoolId" element={<CalonMentorApplyPage />} />

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/schools" element={<SchoolsPage />} />
          <Route path="/schools/new" element={<SchoolNewPage />} />
          <Route path="/schools/:id" element={<SchoolDetailPage />} />
          <Route path="/schools/:id/kelompok/baru" element={<SchoolKelompokBaruPage />} />
          <Route path="/schools/:id/pj/undang" element={<SchoolPjUndangPage />} />
          <Route path="/schools/:id/pj/:userId/ganti" element={<SchoolPjGantiPage />} />
          <Route path="/kebutuhan-mentor" element={<KebutuhanMentorPage />} />
          <Route path="/kebutuhan-mentor/:schoolId" element={<KebutuhanMentorEditPage />} />
          <Route path="/kebutuhan-mentor/:schoolId/pendaftar" element={<KebutuhanMentorApplicationsPage />} />
          <Route path="/kelompok" element={<KelompokRedirectPage />} />
          <Route path="/kelompok/:id" element={<KelompokDetailPage />} />
          <Route path="/kelompok/:id/edit" element={<KelompokEditPage />} />
          <Route path="/kelompok/:id/anggota/undang" element={<KelompokAnggotaUndangPage />} />
          <Route path="/kelompok/:id/anggota/:userId" element={<KelompokAnggotaDetailPage />} />
          <Route path="/kelompok/:id/anggota/:userId/edit" element={<KelompokAnggotaEditPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/invite" element={<UsersInvitePage />} />
          <Route path="/users/:userId" element={<UsersDetailPage />} />
          <Route path="/invitations" element={<InvitationsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/new" element={<EventNewPage />} />
          <Route path="/events/check-ins" element={<EventCheckInsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/materi" element={<MateriPage />} />
          <Route path="/materi/new" element={<MateriNewPage />} />
          <Route path="/materi/history" element={<MateriHistoryPage />} />
          <Route path="/materi/:id/edit" element={<MateriEditPage />} />
          <Route path="/materi/:id" element={<MateriDetailPage />} />
          <Route path="/laporan" element={<LaporanKegiatanPage />} />
          <Route path="/evaluasi" element={<EvaluasiPage />} />
          <Route
            path="/evaluasi/isi"
            element={
              <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
                <EvaluasiIsiPage />
              </RoleGuard>
            }
          />
          <Route
            path="/evaluasi/:id"
            element={
              <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
                <EvaluasiDetailPage />
              </RoleGuard>
            }
          />
          <Route path="/mutabaah" element={<MutabaahPage />} />
          <Route path="/pembina" element={<PembinaPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/kks" element={<KksPage />} />
          <Route path="/kks/:id" element={<KksDetailPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/config/mutabaah" element={<ConfigMutabaahPage />} />
          <Route path="/config/ic" element={<ConfigIcPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
