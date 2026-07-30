package response

import (
	"encoding/json"
	"net/http"
)

func Success(w http.ResponseWriter, status int, data any, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "data": data, "message": message})
}
func Paginated(w http.ResponseWriter, data any, page, limit, total int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    data,
		"pagination": map[string]int{
			"page": page, "limit": limit, "total": total, "totalPages": totalPages,
		},
	})
}
func Error(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"success": false, "message": message})
}
