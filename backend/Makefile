.PHONY: dev build run tidy

dev:
	go run ./cmd/api/main.go

build:
	go build -o bin/server ./cmd/api/main.go

run: build
	./bin/server

tidy:
	go mod tidy
