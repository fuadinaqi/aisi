import fs from 'fs';
import path from 'path';

const srcDir = path.join(import.meta.dirname, '..', 'src');

function transform(content) {
  content = content.replace(/^['"]use client['"];\r?\n/gm, '');

  content = content.replace(/import Link from 'next\/link';/g, "import { Link } from 'react-router-dom';");
  content = content.replace(/<Link([^>]*)\shref=/g, '<Link$1 to=');

  const navReplacements = [
    ["import { useRouter, useParams } from 'next/navigation';", "import { useNavigate, useParams } from 'react-router-dom';"],
    ["import { useParams, useRouter } from 'next/navigation';", "import { useParams, useNavigate } from 'react-router-dom';"],
    ["import { useRouter, useSearchParams } from 'next/navigation';", "import { useNavigate, useSearchParams } from 'react-router-dom';"],
    ["import { useParams, useSearchParams } from 'next/navigation';", "import { useParams, useSearchParams } from 'react-router-dom';"],
    ["import { useRouter } from 'next/navigation';\nimport Link from 'next/link';", "import { useNavigate } from 'react-router-dom';\nimport { Link } from 'react-router-dom';"],
    ["import { useRouter } from 'next/navigation';", "import { useNavigate } from 'react-router-dom';"],
    ["import { useParams } from 'next/navigation';", "import { useParams } from 'react-router-dom';"],
    ["import { usePathname, useRouter } from 'next/navigation';", "import { useLocation, useNavigate } from 'react-router-dom';"],
    ["import { useSearchParams } from 'next/navigation';", "import { useSearchParams } from 'react-router-dom';"],
    ["import { redirect } from 'next/navigation';", "import { Navigate } from 'react-router-dom';"],
  ];

  for (const [from, to] of navReplacements) {
    content = content.split(from).join(to);
  }

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

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?)$/.test(entry.name)) {
      const original = fs.readFileSync(full, 'utf8');
      const next = transform(original);
      if (next !== original) fs.writeFileSync(full, next);
    }
  }
}

walk(srcDir);
console.log('Transform complete');
