"""Mã hoá token Garmin trước khi lưu vào cơ sở dữ liệu."""

from __future__ import annotations

from cryptography.fernet import Fernet


def generate_key() -> str:
    return Fernet.generate_key().decode()


def encrypt(key: str, plaintext: str) -> str:
    return Fernet(key.encode()).encrypt(plaintext.encode()).decode()


def decrypt(key: str, ciphertext: str) -> str:
    return Fernet(key.encode()).decrypt(ciphertext.encode()).decode()
