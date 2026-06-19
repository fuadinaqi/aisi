import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type AppLogoProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  size?: 'md' | 'lg';
  priority?: boolean;
};

const sizeClasses = {
  md: 'h-10 w-auto object-contain md:h-11',
  lg: 'h-11 w-auto object-contain md:h-12',
} as const;

export function AppLogo({
  href = '/dashboard',
  className,
  imageClassName,
  size = 'md',
  priority = false,
}: AppLogoProps) {
  const image = (
    <Image
      src="/logo.png"
      alt="Bina AISI"
      width={220}
      height={64}
      priority={priority}
      className={cn(sizeClasses[size], imageClassName)}
    />
  );

  if (!href) {
    return <div className={cn('inline-flex items-center', className)}>{image}</div>;
  }

  return (
    <Link href={href} className={cn('inline-flex items-center rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring', className)}>
      {image}
    </Link>
  );
}
