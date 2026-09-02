import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import {
  emailSchema,
  genderSchema,
  updateProfileSchema,
  type UpdateProfileInput,
} from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateGroupQueries } from '@/lib/queryInvalidation';
import type { GroupMemberDetail } from '@/lib/types';
import { GenderSelect } from '@/components/shared/GenderField';
import { toastError, toastSuccess } from '@/lib/toast';

const editMemberSchema = updateProfileSchema.extend({
  email: emailSchema,
  gender: genderSchema,
});

type FormData = UpdateProfileInput & {
  email: string;
  gender: 'IKHWAN' | 'AKHWAT';
};

const emptyForm = (): FormData => ({
  name: '',
  email: '',
  phone: '',
  gender: 'IKHWAN',
  birthPlace: '',
  birthDate: '',
  address: '',
  tiktok: '',
  instagram: '',
  facebook: '',
  socialX: '',
  fatherName: '',
  fatherPhone: '',
  motherName: '',
  motherPhone: '',
  hobby: '',
});

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function EditAnggotaPage() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: member, isLoading } = useQuery<GroupMemberDetail>({
    queryKey: ['group-member', id, userId],
    queryFn: async () =>
      (await api.get<ApiResponse<GroupMemberDetail>>(`/groups/${id}/members/${userId}`)).data.data,
    enabled: !!id && !!userId,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: emptyForm(),
  });

  useEffect(() => {
    if (!member) return;
    const g = member.user.gender === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN';
    reset({
      name: member.user.name,
      email: member.user.email,
      phone: member.user.phone || '',
      gender: g,
      birthPlace: member.user.birthPlace || '',
      birthDate: member.user.birthDate ? member.user.birthDate.slice(0, 10) : '',
      address: member.user.address || '',
      tiktok: member.user.tiktok || '',
      instagram: member.user.instagram || '',
      facebook: member.user.facebook || '',
      socialX: member.user.socialX || '',
      fatherName: member.user.fatherName || '',
      fatherPhone: member.user.fatherPhone || '',
      motherName: member.user.motherName || '',
      motherPhone: member.user.motherPhone || '',
      hobby: member.user.hobby || '',
    });
  }, [member, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await api.put(`/groups/${id}/members/${userId}`, {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        gender: data.gender,
        birthPlace: data.birthPlace?.trim() ?? '',
        birthDate: data.birthDate?.trim() ?? '',
        address: data.address?.trim() ?? '',
        tiktok: data.tiktok?.trim() ?? '',
        instagram: data.instagram?.trim() ?? '',
        facebook: data.facebook?.trim() ?? '',
        socialX: data.socialX?.trim() ?? '',
        fatherName: data.fatherName?.trim() ?? '',
        fatherPhone: data.fatherPhone?.trim() ?? '',
        motherName: data.motherName?.trim() ?? '',
        motherPhone: data.motherPhone?.trim() ?? '',
        hobby: data.hobby?.trim() ?? '',
      });
      await queryClient.invalidateQueries({ queryKey: ['group-member', id, userId] });
      await invalidateGroupQueries(queryClient, { groupId: id });
      toastSuccess('Berhasil disimpan');
      navigate(`/kelompok/${id}/anggota/${userId}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal memperbarui data anggota',
      );
      toastError(err, 'Gagal menyimpan');
    }
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!member) return null;

  const err = errors;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <PageContainer tight className="max-w-2xl">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to={`/kelompok/${id}/anggota/${userId}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader
          title="Edit anggota"
          description="Perbarui identitas dan data pribadi anggota kelompok"
          compact
        />

        <p className="mb-4 px-0.5 text-sm text-muted-foreground">
          {member.group.name} · {member.school.name}
        </p>

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Akun</p>
              <Field id="name" label="Nama lengkap" error={err.name?.message}>
                <Input id="name" className="rounded-xl" {...register('name')} />
              </Field>
              <Field id="email" label="Email" error={err.email?.message}>
                <Input id="email" type="email" className="rounded-xl" {...register('email')} />
              </Field>
              <Field id="gender" label="Jenis kelamin" error={err.gender?.message}>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <GenderSelect
                      id="gender"
                      value={field.value}
                      onChange={(next) => field.onChange(next)}
                    />
                  )}
                />
                {member.group.gender && (
                  <p className="text-xs text-muted-foreground">
                    Harus sama dengan jenis kelompok (
                    {member.group.gender === 'AKHWAT' ? 'Akhwat' : 'Ikhwan'}).
                  </p>
                )}
              </Field>
              <Field id="phone" label="No. telepon (opsional)" error={err.phone?.message}>
                <Input id="phone" className="rounded-xl" placeholder="08xxxxxxxxxx" {...register('phone')} />
              </Field>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">Data diri (opsional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="birthPlace" label="Tempat lahir" error={err.birthPlace?.message}>
                  <Input
                    id="birthPlace"
                    className="rounded-xl"
                    placeholder="Depok"
                    {...register('birthPlace')}
                  />
                </Field>
                <Field id="birthDate" label="Tanggal lahir" error={err.birthDate?.message}>
                  <Input id="birthDate" type="date" className="rounded-xl" {...register('birthDate')} />
                </Field>
              </div>
              <Field id="address" label="Alamat" error={err.address?.message}>
                <Input
                  id="address"
                  className="rounded-xl"
                  placeholder="Alamat lengkap"
                  {...register('address')}
                />
              </Field>
              <Field id="hobby" label="Hobi" error={err.hobby?.message}>
                <Input
                  id="hobby"
                  className="rounded-xl"
                  placeholder="Membaca, olahraga, ..."
                  {...register('hobby')}
                />
              </Field>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">Sosial media (opsional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="tiktok" label="TikTok" error={err.tiktok?.message}>
                  <Input
                    id="tiktok"
                    className="rounded-xl"
                    placeholder="@username atau URL"
                    {...register('tiktok')}
                  />
                </Field>
                <Field id="instagram" label="Instagram" error={err.instagram?.message}>
                  <Input
                    id="instagram"
                    className="rounded-xl"
                    placeholder="@username atau URL"
                    {...register('instagram')}
                  />
                </Field>
                <Field id="facebook" label="Facebook" error={err.facebook?.message}>
                  <Input
                    id="facebook"
                    className="rounded-xl"
                    placeholder="username atau URL"
                    {...register('facebook')}
                  />
                </Field>
                <Field id="socialX" label="X (Twitter)" error={err.socialX?.message}>
                  <Input
                    id="socialX"
                    className="rounded-xl"
                    placeholder="@username atau URL"
                    {...register('socialX')}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">Orang tua (opsional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="fatherName" label="Nama ayah" error={err.fatherName?.message}>
                  <Input id="fatherName" className="rounded-xl" {...register('fatherName')} />
                </Field>
                <Field id="fatherPhone" label="No. telepon ayah" error={err.fatherPhone?.message}>
                  <Input
                    id="fatherPhone"
                    className="rounded-xl"
                    placeholder="08xxxxxxxxxx"
                    {...register('fatherPhone')}
                  />
                </Field>
                <Field id="motherName" label="Nama ibu" error={err.motherName?.message}>
                  <Input id="motherName" className="rounded-xl" {...register('motherName')} />
                </Field>
                <Field id="motherPhone" label="No. telepon ibu" error={err.motherPhone?.message}>
                  <Input
                    id="motherPhone"
                    className="rounded-xl"
                    placeholder="08xxxxxxxxxx"
                    {...register('motherPhone')}
                  />
                </Field>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? 'Menyimpan...' : 'Simpan perubahan'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
