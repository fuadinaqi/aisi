.PHONY: run build tidy smoke

run:
	go run ./cmd/server

build:
	mkdir -p bin
	go build -o bin/aisi-api ./cmd/server

tidy:
	go mod tidy

smoke:
	bash ../../scripts/smoke-api.sh http://127.0.0.1:4000
