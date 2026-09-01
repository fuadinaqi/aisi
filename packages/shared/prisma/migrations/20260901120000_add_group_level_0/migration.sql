-- Nilai enum baru harus di-commit dulu sebelum dipakai di INSERT (aman di semua versi PG).
ALTER TYPE "GroupLevel" ADD VALUE 'LEVEL_0' BEFORE 'LEVEL_1';
