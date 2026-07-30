import { toast } from 'sonner';

export function getErrorMessage(err: unknown, fallback = 'Terjadi kesalahan'): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function toastSuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

export function toastError(err: unknown, fallback = 'Terjadi kesalahan') {
  toast.error(getErrorMessage(err, fallback));
}

export function toastInfo(message: string) {
  toast.message(message);
}

export { toast };
