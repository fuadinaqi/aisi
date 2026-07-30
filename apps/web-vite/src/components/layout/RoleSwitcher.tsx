import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getRoleLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

  const role = activeRole && user.roles.includes(activeRole) ? activeRole : user.roles[0];

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
      <select
        value={role || ''}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Ganti peran aktif"
        className={cn(
          'w-full rounded-lg border border-border/80 bg-background px-2 py-1.5 text-xs font-medium text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {user.roles.map((r) => (
          <option key={r} value={r}>
            {getRoleLabel(r)}
          </option>
        ))}
      </select>
    </label>
  );
}
