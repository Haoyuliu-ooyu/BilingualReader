"""
AES-256-GCM decryption that mirrors the Go gateway's crypto.go.

The encrypted payload is hex-encoded: nonce (12 bytes) + ciphertext+tag.
The shared key comes from the LLM_KEY_ENCRYPTION_SECRET env var (64-char hex → 32 bytes).
"""

import os
from binascii import unhexlify
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _encryption_key() -> bytes:
    hex_key = os.getenv("LLM_KEY_ENCRYPTION_SECRET", "")
    if not hex_key:
        raise RuntimeError("LLM_KEY_ENCRYPTION_SECRET not set")
    return unhexlify(hex_key)


def decrypt_api_key(encrypted_hex: str) -> str:
    key = _encryption_key()
    data = unhexlify(encrypted_hex)

    nonce_size = 12  # AES-GCM standard nonce length
    if len(data) < nonce_size:
        raise ValueError("ciphertext too short")

    nonce = data[:nonce_size]
    ciphertext = data[nonce_size:]

    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
