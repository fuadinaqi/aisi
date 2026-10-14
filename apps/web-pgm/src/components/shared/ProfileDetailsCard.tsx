import { getGenderLabel } from '@/lib/utils';
import { ListGroup } from '@/components/layout/AppUI';
import { cn } from '@/lib/utils';

export type ProfileDetails = {
  gender?: string | null;
  phone?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  address?: string | null;
  hobby?: string | null;
  tiktok?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  socialX?: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 md:px-5">
      <p className="shrink-0 text-xs text-muted-foreground">{label}</p>
      <p className="min-w-0 text-right text-sm font-medium">{value?.trim() || '—'}</p>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ListGroup className={cn('divide-y divide-border/60', className)}>
      <div className="px-4 py-3 md:px-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      {children}
    </ListGroup>
  );
}

function formatBirthDate(value?: string | null) {
  if (!value) return null;
  const d = value.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function ProfileDetailsCard({
  profile,
  className,
}: {
  profile: ProfileDetails;
  className?: string;
}) {
  const birth =
    [profile.birthPlace, formatBirthDate(profile.birthDate)].filter(Boolean).join(', ') || null;

  return (
    <div className="space-y-3">
      <Section title="Data diri" className={className}>
        <Row label="Jenis kelamin" value={profile.gender ? getGenderLabel(profile.gender) : null} />
        <Row label="Telepon" value={profile.phone} />
        <Row label="Tempat, tanggal lahir" value={birth} />
        <Row label="Alamat" value={profile.address} />
        <Row label="Hobi" value={profile.hobby} />
      </Section>

      <Section title="Sosial media" className={className}>
        <Row label="TikTok" value={profile.tiktok} />
        <Row label="Instagram" value={profile.instagram} />
        <Row label="Facebook" value={profile.facebook} />
        <Row label="X (Twitter)" value={profile.socialX} />
      </Section>

      <Section title="Orang tua" className={className}>
        <Row label="Nama ayah" value={profile.fatherName} />
        <Row label="Telepon ayah" value={profile.fatherPhone} />
        <Row label="Nama ibu" value={profile.motherName} />
        <Row label="Telepon ibu" value={profile.motherPhone} />
      </Section>
    </div>
  );
}
