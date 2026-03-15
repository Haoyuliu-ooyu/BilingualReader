package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

// EncryptionKey reads the shared 32-byte key from the environment.
// Returns nil if not set (encryption disabled).
func EncryptionKey() ([]byte, error) {
	hexKey := os.Getenv("LLM_KEY_ENCRYPTION_SECRET")
	if hexKey == "" {
		return nil, fmt.Errorf("LLM_KEY_ENCRYPTION_SECRET not set")
	}
	return hex.DecodeString(hexKey)
}

// EncryptAPIKey encrypts plaintext with AES-256-GCM.
// Returns hex-encoded nonce+ciphertext.
func EncryptAPIKey(plaintext string) (string, error) {
	key, err := EncryptionKey()
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("aes.NewCipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("cipher.NewGCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("rand nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

// DecryptAPIKey decrypts a hex-encoded AES-256-GCM ciphertext back to plaintext.
func DecryptAPIKey(encryptedHex string) (string, error) {
	key, err := EncryptionKey()
	if err != nil {
		return "", err
	}

	data, err := hex.DecodeString(encryptedHex)
	if err != nil {
		return "", fmt.Errorf("hex decode: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("aes.NewCipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("cipher.NewGCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("gcm.Open: %w", err)
	}

	return string(plaintext), nil
}
