import imageCompression from 'browser-image-compression';

const OPTIONS = {
  maxWidthOrHeight: 1600,
  maxSizeMB: 1.5,
  fileType: 'image/jpeg' as const,
  useWebWorker: true,
  initialQuality: 0.8,
};

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** Compress an image for upload. Throws if the file is not an image or compression fails. */
export async function compressImage(file: File): Promise<File> {
  if (!isImageFile(file)) {
    throw new Error('File harus berupa gambar');
  }
  try {
    const compressed = await imageCompression(file, OPTIONS);
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([compressed], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    throw new Error('Gagal mengoptimalkan foto. Coba foto lain atau kurangi ukurannya.');
  }
}

/** Compress image files; leave non-images unchanged. */
export async function compressImagesInList(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    if (isImageFile(file)) {
      out.push(await compressImage(file));
    } else {
      out.push(file);
    }
  }
  return out;
}
