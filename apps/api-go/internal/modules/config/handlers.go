package configmodule

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/middleware"
	httpx "github.com/dakwah-depok/aisi/apps/api-go/internal/response"
)
func Routes(db *pgxpool.Pool, c config.Config) chi.Router {
	r:=chi.NewRouter()
	r.Get("/group-levels",func(w http.ResponseWriter,req *http.Request){ rows,e:=db.Query(req.Context(),`SELECT "id","level"::text,"label","updatedAt" FROM "GroupLevelConfig" ORDER BY "level"`);if e!=nil{httpx.Error(w,500,"Gagal memuat konfigurasi");return};defer rows.Close();out:=[]map[string]any{};for rows.Next(){var id,level,label string;var updated any;_ = rows.Scan(&id,&level,&label,&updated);out=append(out,map[string]any{"id":id,"level":level,"label":label,"updatedAt":updated})};httpx.Success(w,200,out,"")})
	r.With(middleware.RequireAuth(c),middleware.RequireRole("SUPERADMIN","ADMIN")).Put("/group-levels",func(w http.ResponseWriter,req *http.Request){var in struct{Level string `json:"level"`;Label string `json:"label"`};if json.NewDecoder(req.Body).Decode(&in)!=nil||(in.Level!="LEVEL_1"&&in.Level!="LEVEL_2")||in.Label==""{httpx.Error(w,400,"level dan label tidak valid");return};var id,level,label string;err:=db.QueryRow(req.Context(),`INSERT INTO "GroupLevelConfig" ("id","level","label","updatedAt") VALUES ($1,$2::"GroupLevel",$3,NOW()) ON CONFLICT ("level") DO UPDATE SET "label"=EXCLUDED."label","updatedAt"=NOW() RETURNING "id","level"::text,"label"`,uuid.NewString(),in.Level,in.Label).Scan(&id,&level,&label);if err!=nil{httpx.Error(w,500,"Gagal memperbarui konfigurasi");return};httpx.Success(w,200,map[string]string{"id":id,"level":level,"label":label},"Label level berhasil diperbarui")})
	return r
}
