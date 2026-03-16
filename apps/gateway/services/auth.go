package services

import (
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"gateway/repository"
)

// Claims is the JWT payload stored in each token.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// AuthService defines authentication operations.
type AuthService interface {
	Login(ctx context.Context, email, password string) (token string, userID string, userEmail string, err error)
	Register(ctx context.Context, email, password string) (token string, userID string, err error)
	GenerateToken(userID, email string) (string, error)
	ValidateToken(tokenString string) (*Claims, error)
}

type authService struct {
	userRepo  repository.UserRepository
	jwtSecret []byte
}

// NewAuthService creates a new AuthService with the given repository and JWT secret.
func NewAuthService(userRepo repository.UserRepository, jwtSecret string) AuthService {
	return &authService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
	}
}

func (s *authService) Login(ctx context.Context, email, password string) (string, string, string, error) {
	userID, hash, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return "", "", "", fmt.Errorf("invalid credentials")
	}

	if !CheckPassword(hash, password) {
		return "", "", "", fmt.Errorf("invalid credentials")
	}

	token, err := s.GenerateToken(userID, email)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	return token, userID, email, nil
}

func (s *authService) Register(ctx context.Context, email, password string) (string, string, error) {
	exists, err := s.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return "", "", fmt.Errorf("database error: %w", err)
	}
	if exists {
		return "", "", fmt.Errorf("an account with this email already exists")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return "", "", fmt.Errorf("failed to process password: %w", err)
	}

	userID := uuid.New().String()
	if err := s.userRepo.Create(ctx, userID, email, hash); err != nil {
		return "", "", fmt.Errorf("failed to create account: %w", err)
	}

	token, err := s.GenerateToken(userID, email)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	return token, userID, nil
}

func (s *authService) GenerateToken(userID, email string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *authService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// HashPassword returns a bcrypt hash of the plaintext password.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword compares a bcrypt hash with a plaintext password.
func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
