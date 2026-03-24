# ---- Stage 1: Build ----
FROM golang:alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# ---- Stage 2: Production ----
FROM alpine:3.21

# ca-certificates needed for HTTPS calls to external APIs (OpenAI, Gemini, etc.)
RUN apk --no-cache add ca-certificates

RUN adduser -D -u 1000 appuser
WORKDIR /app
COPY --from=builder /app/main .

USER appuser
EXPOSE 8080
CMD ["./main"]
