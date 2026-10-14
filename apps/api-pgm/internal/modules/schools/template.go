package schools

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"

	httpx "github.com/dakwah-depok/aisi/apps/api-pgm/internal/response"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/storage"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

func (h Handler) templateURL(r *http.Request, schoolID string) (*string, error) {
	var url *string
	err := h.DB.QueryRow(r.Context(), `SELECT "templateUrl" FROM "School" WHERE "id"=$1 AND "isActive"`, schoolID).Scan(&url)
	if err != nil {
		return nil, err
	}
	if url != nil && strings.TrimSpace(*url) == "" {
		return nil, nil
	}
	return url, nil
}

func (h Handler) templateInfo(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	url, err := h.templateURL(r, sid)
	if err == pgx.ErrNoRows {
		httpx.Error(w, 404, "PGM tidak ditemukan")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat template")
		return
	}
	httpx.Success(w, 200, map[string]bool{"hasTemplate": url != nil}, "")
}

func (h Handler) uploadTemplate(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	if err := r.ParseMultipartForm(12 << 20); err != nil {
		httpx.Error(w, 400, "Upload template tidak valid")
		return
	}
	files := r.MultipartForm.File["template"]
	if len(files) != 1 {
		httpx.Error(w, 400, "Unggah tepat 1 template")
		return
	}
	store, err := storage.New(h.Config)
	if err != nil {
		httpx.Error(w, 500, "Storage tidak tersedia")
		return
	}
	url, err := putTemplate(r, store, files[0])
	if err != nil {
		httpx.Error(w, 400, err.Error())
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		store.DeleteBestEffort(r.Context(), url)
		httpx.Error(w, 500, "Gagal menyimpan template")
		return
	}
	defer tx.Rollback(r.Context())
	var previous *string
	err = tx.QueryRow(r.Context(), `SELECT "templateUrl" FROM "School" WHERE "id"=$1 AND "isActive" FOR UPDATE`, sid).Scan(&previous)
	if err == pgx.ErrNoRows {
		store.DeleteBestEffort(r.Context(), url)
		httpx.Error(w, 404, "PGM tidak ditemukan")
		return
	}
	if err != nil {
		store.DeleteBestEffort(r.Context(), url)
		httpx.Error(w, 500, "Gagal menyimpan template")
		return
	}
	if _, err = tx.Exec(r.Context(), `UPDATE "School" SET "templateUrl"=$1,"updatedAt"=NOW() WHERE "id"=$2`, url, sid); err != nil {
		store.DeleteBestEffort(r.Context(), url)
		httpx.Error(w, 500, "Gagal menyimpan template")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		store.DeleteBestEffort(r.Context(), url)
		httpx.Error(w, 500, "Gagal menyimpan template")
		return
	}
	if previous != nil && strings.TrimSpace(*previous) != "" && *previous != url {
		store.DeleteBestEffort(r.Context(), *previous)
	}
	httpx.Success(w, 201, map[string]bool{"hasTemplate": true}, "Template berhasil disimpan")
}

func (h Handler) deleteTemplate(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		httpx.Error(w, 500, "Gagal menghapus template")
		return
	}
	defer tx.Rollback(r.Context())
	var previous *string
	err = tx.QueryRow(r.Context(), `SELECT "templateUrl" FROM "School" WHERE "id"=$1 AND "isActive" FOR UPDATE`, sid).Scan(&previous)
	if err == pgx.ErrNoRows {
		httpx.Error(w, 404, "PGM tidak ditemukan")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "Gagal menghapus template")
		return
	}
	if _, err = tx.Exec(r.Context(), `UPDATE "School" SET "templateUrl"=NULL,"updatedAt"=NOW() WHERE "id"=$1`, sid); err != nil {
		httpx.Error(w, 500, "Gagal menghapus template")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		httpx.Error(w, 500, "Gagal menghapus template")
		return
	}
	if previous != nil && strings.TrimSpace(*previous) != "" {
		if store, e := storage.New(h.Config); e == nil {
			store.DeleteBestEffort(r.Context(), *previous)
		}
	}
	httpx.Success(w, 200, map[string]bool{"hasTemplate": false}, "Template dihapus")
}

func (h Handler) templateFile(w http.ResponseWriter, r *http.Request) {
	sid := chi.URLParam(r, "id")
	if !h.access(r, sid) {
		httpx.Error(w, 403, "Akses ditolak")
		return
	}
	url, err := h.templateURL(r, sid)
	if err == pgx.ErrNoRows {
		httpx.Error(w, 404, "PGM tidak ditemukan")
		return
	}
	if err != nil {
		httpx.Error(w, 500, "Gagal memuat template")
		return
	}
	if url == nil {
		httpx.Error(w, 404, "Template tidak ditemukan")
		return
	}
	store, err := storage.New(h.Config)
	if err != nil {
		httpx.Error(w, 500, "Storage tidak tersedia")
		return
	}
	body, ct, err := store.OpenTemplate(r.Context(), *url)
	if err != nil {
		if os.IsNotExist(err) {
			httpx.Error(w, 404, "Template tidak ditemukan")
			return
		}
		httpx.Error(w, 500, "Gagal memuat template")
		return
	}
	defer body.Close()
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "private, max-age=300")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = io.Copy(w, body)
}

func putTemplate(r *http.Request, s *storage.Storage, f *multipart.FileHeader) (string, error) {
	in, err := f.Open()
	if err != nil {
		return "", err
	}
	defer in.Close()
	validated, _, err := storage.ValidateImage(in, f.Size)
	if err != nil {
		return "", err
	}
	optimized, ct, err := storage.OptimizeImage(validated)
	if err != nil {
		return "", err
	}
	return s.Put(r.Context(), storage.PrefixTemplates, "template.jpg", optimized, ct)
}
