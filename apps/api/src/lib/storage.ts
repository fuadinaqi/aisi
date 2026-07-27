import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function isR2Configured(): boolean {
  return !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function generateKey(originalname: string): string {
  const ext = path.extname(originalname);
  return `${uuidv4()}${ext}`;
}

const memoryStorage = multer.memoryStorage();

const MATERI_MIME_TYPES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
];

export const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan'));
    }
  },
});

export const uploadMateri = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = MATERI_MIME_TYPES.some((t) =>
      t.endsWith('/') ? file.mimetype.startsWith(t) : file.mimetype === t,
    );
    if (allowed) cb(null, true);
    else cb(new Error('Tipe file tidak didukung'));
  },
});

export async function putObject(file: Express.Multer.File): Promise<string> {
  const key = generateKey(file.originalname);

  if (isR2Configured()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return key;
  }

  fs.writeFileSync(path.join(uploadDir, key), file.buffer);
  return key;
}

export async function putObjectAndGetUrl(file: Express.Multer.File): Promise<string> {
  const key = await putObject(file);
  return getPublicUrl(key);
}

export async function putObjectsAndGetUrls(files: Express.Multer.File[]): Promise<string[]> {
  return Promise.all(files.map((file) => putObjectAndGetUrl(file)));
}

export function getPublicUrl(key: string): string {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `/uploads/${key}`;
}

export function getUploadPath(filename: string): string {
  return path.join(uploadDir, filename);
}
