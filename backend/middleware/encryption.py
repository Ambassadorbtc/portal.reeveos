"""
ReeveOS Application-Level Encryption (ALE)
==========================================
Encrypts PII fields BEFORE they hit MongoDB. The database never sees plaintext
for customer names, emails, phones, or booking notes.

Architecture:
- Master key from environment variable (REEVEOS_MASTER_KEY)
- Per-tenant Data Encryption Keys (DEKs) derived from master + tenant_id
- Sensitive fields encrypted with Fernet (AES-128-CBC + HMAC-SHA256)
- Deterministic mode for email (enables exact-match lookups)
- Randomized mode for names/phones (maximum security)

Usage:
    from middleware.encryption import TenantEncryption
    
    enc = TenantEncryption(business_id)
    
    # Encrypt before storing
    doc["customer"]["name"] = enc.encrypt(raw_name)
    doc["customer"]["email"] = enc.encrypt_deterministic(raw_email)
    doc["customer"]["phone"] = enc.encrypt(raw_phone)
    
    # Decrypt after reading
    name = enc.decrypt(doc["customer"]["name"])
    email = enc.decrypt(doc["customer"]["email"])
"""
import os
import hashlib
import hmac
import base64
import logging
from typing import Optional
from cryptography.fernet import Fernet

logger = logging.getLogger("encryption")

# ─── Master Key ───
# In production: set REEVEOS_MASTER_KEY as a 32-byte base64 string
# Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
_MASTER_KEY = os.getenv("REEVEOS_MASTER_KEY", "")

# Prefix for encrypted values — lets us know a field is encrypted
ENCRYPTED_PREFIX = "ENC::"
DETERMINISTIC_PREFIX = "DET::"


def _get_master_key() -> bytes:
    """Get the master encryption key. Raises if not configured."""
    if not _MASTER_KEY:
        raise RuntimeError(
            "REEVEOS_MASTER_KEY not set. Generate with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return base64.urlsafe_b64decode(_MASTER_KEY)


def _derive_tenant_key(tenant_id: str) -> bytes:
    """
    Derive a per-tenant Fernet key from master key + tenant_id.
    Uses HKDF-like derivation: HMAC-SHA256(master, tenant_id) → Fernet key.
    Each tenant gets a unique key without storing it.
    """
    master = _get_master_key()
    derived = hmac.new(master, tenant_id.encode(), hashlib.sha256).digest()
    # Fernet requires a 32-byte base64-encoded key
    return base64.urlsafe_b64encode(derived)


def _derive_deterministic_key(tenant_id: str) -> bytes:
    """
    Separate key for deterministic encryption.
    Same input always produces same output (for email lookups).
    """
    master = _get_master_key()
    derived = hmac.new(master, f"det:{tenant_id}".encode(), hashlib.sha256).digest()
    return derived


class TenantEncryption:
    """
    Per-tenant encryption for PII fields.
    
    Two modes:
    - encrypt() / decrypt() — Randomized. Same input → different output each time.
      Use for: names, phone numbers, notes. Maximum security.
    - encrypt_deterministic() — Same input → same output always.
      Use for: email (so you can query "find customer by email").
    """
    
    # Fields that should be encrypted (used by auto-encrypt helpers)
    SENSITIVE_FIELDS = {
        "customer.name", "customer.email", "customer.phone",
        "name", "email", "phone",  # Direct fields on customer documents
        "notes",  # Booking notes
    }
    
    DETERMINISTIC_FIELDS = {
        "customer.email", "email",  # Need exact-match lookups
    }
    
    def __init__(self, tenant_id: str):
        self._tenant_id = tenant_id
        self._fernet = None
        self._det_key = None
        self._enabled = bool(_MASTER_KEY)
    
    @property
    def enabled(self) -> bool:
        return self._enabled
    
    def _get_fernet(self) -> Fernet:
        if self._fernet is None:
            self._fernet = Fernet(_derive_tenant_key(self._tenant_id))
        return self._fernet
    
    def _get_det_key(self) -> bytes:
        if self._det_key is None:
            self._det_key = _derive_deterministic_key(self._tenant_id)
        return self._det_key
    
    # ─── Randomized encryption ───
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt a field value. Returns prefixed ciphertext."""
        if not self._enabled or not plaintext:
            return plaintext
        if isinstance(plaintext, str) and plaintext.startswith((ENCRYPTED_PREFIX, DETERMINISTIC_PREFIX)):
            return plaintext  # Already encrypted
        
        try:
            ct = self._get_fernet().encrypt(plaintext.encode())
            return f"{ENCRYPTED_PREFIX}{ct.decode()}"
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise RuntimeError(f"Encryption failed — refusing to store plaintext: {e}")
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a field value. Handles both encrypted and plaintext gracefully."""
        if not ciphertext:
            return ciphertext
        
        if isinstance(ciphertext, str) and ciphertext.startswith(ENCRYPTED_PREFIX):
            if not self._enabled:
                logger.warning("Encrypted data found but REEVEOS_MASTER_KEY not set")
                return "[ENCRYPTED]"
            try:
                raw = ciphertext[len(ENCRYPTED_PREFIX):]
                return self._get_fernet().decrypt(raw.encode()).decode()
            except Exception as e:
                logger.error(f"Decryption failed: {e}")
                return "[DECRYPTION ERROR]"
        
        if isinstance(ciphertext, str) and ciphertext.startswith(DETERMINISTIC_PREFIX):
            if not self._enabled:
                return "[ENCRYPTED]"
            try:
                from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
                from cryptography.hazmat.primitives import padding as sym_padding
                raw = ciphertext[len(DETERMINISTIC_PREFIX):]
                raw_bytes = base64.urlsafe_b64decode(raw)
                iv = raw_bytes[:16]
                ct_bytes = raw_bytes[16:]
                key = self._get_det_key()
                cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
                decryptor = cipher.decryptor()
                padded = decryptor.update(ct_bytes) + decryptor.finalize()
                unpadder = sym_padding.PKCS7(128).unpadder()
                pt_bytes = unpadder.update(padded) + unpadder.finalize()
                return pt_bytes.decode()
            except Exception as e:
                logger.error(f"Deterministic decryption failed: {e}")
                return "[DECRYPTION ERROR]"
        
        # Not encrypted — return as-is (backward compatible with existing data)
        return ciphertext
    
    # ─── Deterministic encryption (for email lookups) ───
    
    def encrypt_deterministic(self, plaintext: str) -> str:
        """
        Deterministic encryption — same input always gives same output.
        Uses AES-CBC with IV derived from HMAC(key, plaintext) for determinism.
        Use ONLY for fields that need exact-match queries (email).
        """
        if not self._enabled or not plaintext:
            return plaintext
        if isinstance(plaintext, str) and plaintext.startswith((ENCRYPTED_PREFIX, DETERMINISTIC_PREFIX)):
            return plaintext
        
        try:
            from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
            from cryptography.hazmat.primitives import padding as sym_padding
            key = self._get_det_key()
            pt_bytes = plaintext.lower().strip().encode()
            # Derive a deterministic IV from HMAC(key, plaintext)
            iv = hmac.new(key, pt_bytes, hashlib.sha256).digest()[:16]
            # AES-CBC with PKCS7 padding
            padder = sym_padding.PKCS7(128).padder()
            padded = padder.update(pt_bytes) + padder.finalize()
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
            encryptor = cipher.encryptor()
            ct_bytes = encryptor.update(padded) + encryptor.finalize()
            encoded = base64.urlsafe_b64encode(iv + ct_bytes).decode()
            return f"{DETERMINISTIC_PREFIX}{encoded}"
        except Exception as e:
            logger.error(f"Deterministic encryption failed: {e}")
            raise RuntimeError(f"Encryption failed — refusing to store plaintext: {e}")
    
    # ─── Auto-encrypt/decrypt helpers for documents ───
    
    def encrypt_customer(self, customer: dict) -> dict:
        """Encrypt PII fields in a customer subdocument."""
        if not self._enabled or not customer:
            return customer
        
        c = dict(customer)
        if c.get("name"):
            c["name"] = self.encrypt(c["name"])
        if c.get("email"):
            c["email"] = self.encrypt_deterministic(c["email"])
        if c.get("phone"):
            c["phone"] = self.encrypt(c["phone"])
        return c
    
    def decrypt_customer(self, customer: dict) -> dict:
        """Decrypt PII fields in a customer subdocument."""
        if not customer:
            return customer
        
        c = dict(customer)
        if c.get("name"):
            c["name"] = self.decrypt(c["name"])
        if c.get("email"):
            c["email"] = self.decrypt(c["email"])
        if c.get("phone"):
            c["phone"] = self.decrypt(c["phone"])
        return c
    
    def encrypt_booking(self, booking: dict) -> dict:
        """Encrypt PII in a booking document."""
        if not self._enabled or not booking:
            return booking
        
        b = dict(booking)
        if b.get("customer"):
            b["customer"] = self.encrypt_customer(b["customer"])
        if b.get("notes"):
            b["notes"] = self.encrypt(b["notes"])
        # Handle flat fields too
        if b.get("name") and "customer" not in b:
            b["name"] = self.encrypt(b["name"])
        if b.get("email") and "customer" not in b:
            b["email"] = self.encrypt_deterministic(b["email"])
        if b.get("phone") and "customer" not in b:
            b["phone"] = self.encrypt(b["phone"])
        return b
    
    def decrypt_booking(self, booking: dict) -> dict:
        """Decrypt PII in a booking document."""
        if not booking:
            return booking
        
        b = dict(booking)
        if b.get("customer"):
            b["customer"] = self.decrypt_customer(b["customer"])
        if b.get("notes"):
            b["notes"] = self.decrypt(b["notes"])
        if b.get("name") and "customer" not in b:
            b["name"] = self.decrypt(b["name"])
        if b.get("email") and "customer" not in b:
            b["email"] = self.decrypt(b["email"])
        if b.get("phone") and "customer" not in b:
            b["phone"] = self.decrypt(b["phone"])
        return b
    
    def decrypt_bookings(self, bookings: list) -> list:
        """Decrypt a list of booking documents."""
        return [self.decrypt_booking(b) for b in bookings]


def is_encryption_enabled() -> bool:
    """Check if encryption is configured."""
    return bool(_MASTER_KEY)
