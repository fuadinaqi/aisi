package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/config"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/db"
	httpx "github.com/dakwah-depok/aisi/apps/api-pgm/internal/http"
	"github.com/dakwah-depok/aisi/apps/api-pgm/internal/observability"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	sentryOn := observability.InitSentry(cfg)
	if sentryOn {
		defer observability.FlushSentry()
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpx.Router(pool, cfg),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		log.Printf("PGM Go API mendengarkan pada :%s (database %s)", cfg.Port, cfg.DatabaseName)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdown)
}
