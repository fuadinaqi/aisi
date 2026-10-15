import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole, getRoleLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface RoleSwitcherProps {
  className?: string;
  /** Jika true, setelah switch navigate ke dashboard */
  redirectOnSwitch?: boolean;
  compact?: boolean;
}

export function RoleSwitcher({
  className,
  redirectOnSwitch = true,
  compact = false,
}: RoleSwitcherProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);
  const setActiveRole = useAuthStore((s) => s.setActiveRole);

  if (!user) return null;

  const role = activeRole && user.roles.includes(activeRole) ? activeRole : getPrimaryRole(user.roles);

  if (user.roles.length <= 1) {
    return (
      <p className={cn('truncate text-xs text-muted-foreground', className)}>
        {getRoleLabel(role || 'ANGGOTA')}
      </p>
    );
  }

  const handleChange = (next: string) => {
    if (next === role) return;
    setActiveRole(next);
    if (redirectOnSwitch) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <label className={cn('block', className)}>
      {!compact && (
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Peran aktif
        </span>
      )}
      <SearchableSelect
        value={role || ''}
        onChange={handleChange}
        ariaLabel="Ganti peran aktif"
        size="sm"
        options={user.roles.map((r) => ({ value: r, label: getRoleLabel(r) }))}
        className="text-xs font-medium"
      />
    </label>
  );
}
