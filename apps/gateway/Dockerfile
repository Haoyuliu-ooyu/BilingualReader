FROM golang:alpine AS builder

WORKDIR /app
COPY . .

# Initialize module if not exists (for scaffolding)
# In production, go.mod should exist
RUN [ ! -f go.mod ] && go mod init gateway || true
RUN go mod tidy
RUN go build -o main .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .

EXPOSE 8080
CMD ["./main"]
