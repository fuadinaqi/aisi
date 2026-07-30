import fs from 'fs';
import path from 'path';

const web = path.join(import.meta.dirname, '..', '..', 'web');
const webVite = path.join(import.meta.dirname, '..');

const pageMap = {
  'app/(dashboard)/schools/[id]/page.tsx': 'src/pages/schools/SchoolDetailPage.tsx',
  'app/(dashboard)/schools/[id]/kelompok/baru/page.tsx': 'src/pages/schools/SchoolKelompokBaruPage.tsx',
  'app/(dashboard)/schools/[id]/pj/undang/page.tsx': 'src/pages/schools/SchoolPjUndangPage.tsx',
  'app/(dashboard)/schools/[id]/pj/[userId]/ganti/page.tsx': 'src/pages/schools/SchoolPjGantiPage.tsx',
  'app/(dashboard)/schools/[id]/pj/PjSekolahForm.tsx': 'src/pages/schools/PjSekolahForm.tsx',
  'app/(dashboard)/kelompok/[id]/page.tsx': 'src/pages/kelompok/KelompokDetailPage.tsx',
  'app/(dashboard)/kelompok/[id]/edit/page.tsx': 'src/pages/kelompok/KelompokEditPage.tsx',
  'app/(dashboard)/kelompok/[id]/anggota/undang/page.tsx': 'src/pages/kelompok/KelompokAnggotaUndangPage.tsx',
  'app/(dashboard)/kelompok/[id]/anggota/[userId]/page.tsx': 'src/pages/kelompok/KelompokAnggotaDetailPage.tsx',
  'app/(dashboard)/kelompok/[id]/anggota/[userId]/edit/page.tsx': 'src/pages/kelompok/KelompokAnggotaEditPage.tsx',
  'app/(dashboard)/events/[id]/page.tsx': 'src/pages/events/EventDetailPage.tsx',
  'app/(dashboard)/materi/[id]/page.tsx': 'src/pages/materi/MateriDetailPage.tsx',
  'app/(dashboard)/evaluasi/[id]/page.tsx': 'src/pages/evaluasi/EvaluasiDetailPage.tsx',
  'app/(dashboard)/kks/[id]/page.tsx': 'src/pages/kks/KksDetailPage.tsx',
};

function transform(content) {
  content = content.replace(/^['"]use client['"];\r?\n/gm, '');
  content = content.replace(/import Link from 'next\/link';/g, "import { Link } from 'react-router-dom';");
  content = content.replace(/<Link([^>]*)\shref=/g, '<Link$1 to=');
  const navReplacements = [
    ["import { useRouter, useParams } from 'next/navigation';", "import { useNavigate, useParams } from 'react-router-dom';"],
    ["import { useParams, useRouter } from 'next/navigation';", "import { useParams, useNavigate } from 'react-router-dom';"],
    ["import { useRouter, useSearchParams } from 'next/navigation';", "import { useNavigate, useSearchParams } from 'react-router-dom';"],
    ["import { useParams, useSearchParams } from 'next/navigation';", "import { useParams, useSearchParams } from 'react-router-dom';"],
    ["import { useRouter } from 'next/navigation';", "import { useNavigate } from 'react-router-dom';"],
    ["import { useParams } from 'next/navigation';", "import { useParams } from 'react-router-dom';"],
    ["import { usePathname, useRouter } from 'next/navigation';", "import { useLocation, useNavigate } from 'react-router-dom';"],
    ["import { useSearchParams } from 'next/navigation';", "import { useSearchParams } from 'react-router-dom';"],
    ["import { redirect } from 'next/navigation';", "import { Navigate } from 'react-router-dom';"],
  ];
  for (const [from, to] of navReplacements) content = content.split(from).join(to);
  content = content.replace(/\bconst router = useRouter\(\);/g, 'const navigate = useNavigate();');
  content = content.replace(/\bconst pathname = usePathname\(\);/g, 'const { pathname } = useLocation();');
  content = content.replace(/\brouter\.replace\(/g, 'navigate(');
  content = content.replace(/\brouter\.push\(/g, 'navigate(');
  content = content.replace(/navigate\('\/login'\);/g, "navigate('/login', { replace: true });");
  content = content.replace(/navigate\('\/dashboard'\);/g, "navigate('/dashboard', { replace: true });");
  content = content.replace(/redirect\('\/login'\);/g, 'return <Navigate to="/login" replace />;');
  content = content.replace(/redirect\('\/dashboard'\);/g, 'return <Navigate to="/dashboard" replace />;');
  content = content.replace(/process\.env\.NEXT_PUBLIC_API_URL/g, 'import.meta.env.VITE_API_URL');
  return content;
}

for (const [srcRel, destRel] of Object.entries(pageMap)) {
  const src = path.join(web, srcRel);
  const dest = path.join(webVite, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const content = transform(fs.readFileSync(src, 'utf8'));
  fs.writeFileSync(dest, content);
  console.log('Copied', destRel);
}
