package httpx

import (
	"encoding/json"
	"net/http"
)

type Pagination struct {
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}
type envelope struct {
	Success    bool        `json:"success"`
	Data       any         `json:"data,omitempty"`
	Message    string      `json:"message,omitempty"`
	Pagination *Pagination `json:"pagination,omitempty"`
}

func Success(w http.ResponseWriter, status int, data any, message string) {
	write(w, status, envelope{Success: true, Data: data, Message: message})
}
func SuccessPage(w http.ResponseWriter, data any, page, limit, total int) {
	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}
	write(w, http.StatusOK, envelope{Success: true, Data: data, Pagination: &Pagination{page, limit, total, pages}})
}
func Paginated(w http.ResponseWriter, data any, page, limit, total int) {
	SuccessPage(w, data, page, limit, total)
}
func Error(w http.ResponseWriter, status int, message string) {
	write(w, status, envelope{Success: false, Message: message})
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
