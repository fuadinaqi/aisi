package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/dakwah-depok/aisi/apps/api-go/internal/config"
)

type Claims struct {
	UserID string   `json:"userId"`
	Email  string   `json:"email"`
	Roles  []string `json:"roles"`
	jwt.RegisteredClaims
}
type RefreshClaims struct {
	Token string `json:"token"`
	jwt.RegisteredClaims
}

func AccessToken(c config.Config, userID, email string, roles []string) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{userID, email, roles, jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(c.JWTAccessExpires)), IssuedAt: jwt.NewNumericDate(time.Now())}}).SignedString([]byte(c.JWTSecret))
}
func NewRefreshToken(c config.Config) (id, token string, err error) {
	id = uuid.NewString()
	token, err = jwt.NewWithClaims(jwt.SigningMethodHS256, RefreshClaims{Token: id, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(c.JWTRefreshExpires)), IssuedAt: jwt.NewNumericDate(time.Now())}}).SignedString([]byte(c.JWTRefreshSecret))
	return
}
func ParseAccess(c config.Config, raw string) (*Claims, error) {
	claims := new(Claims)
	t, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok { return nil, fmt.Errorf("metode JWT tidak valid") }
		return []byte(c.JWTSecret), nil
	})
	if err != nil || !t.Valid { return nil, fmt.Errorf("access token tidak valid") }
	return claims, nil
}
func ParseRefresh(c config.Config, raw string) (*RefreshClaims, error) {
	claims := new(RefreshClaims)
	t, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode JWT tidak valid")
		}
		return []byte(c.JWTRefreshSecret), nil
	})
	if err != nil || !t.Valid || claims.Token == "" {
		return nil, fmt.Errorf("refresh token tidak valid")
	}
	return claims, nil
}
