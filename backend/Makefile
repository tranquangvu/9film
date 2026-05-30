.PHONY: dev build run tidy

dev:
	go run ./cmd/server/main.go

build:
	go build -o bin/server ./cmd/server/main.go

run: build
	./bin/server

tidy:
	go mod tidy
