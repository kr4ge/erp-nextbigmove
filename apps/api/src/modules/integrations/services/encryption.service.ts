import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';

  /**
   * Encrypt credentials using tenant's encryption key
   * @param credentials - Credentials object to encrypt
   * @param tenantKey - Tenant's encryption key (64-char hex string)
   * @returns Encrypted string in format: iv:authTag:encrypted
   */
  encrypt(credentials: any, tenantKey: string): string {
    try {
      // Convert hex key to Buffer (32 bytes)
      const key = Buffer.from(tenantKey, 'hex');

      // Generate random IV (16 bytes for AES-GCM)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt credentials (convert to JSON first)
      const credentialsJson = JSON.stringify(credentials);
      let encrypted = cipher.update(credentialsJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Return combined string: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt credentials using tenant's encryption key
   * @param encryptedData - Encrypted string in format: iv:authTag:encrypted
   * @param tenantKey - Tenant's encryption key (64-char hex string)
   * @returns Decrypted credentials object
   */
  decrypt(encryptedData: string, tenantKey: string): any {
    try {
      // Split encrypted data into components
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;

      // Convert hex strings to Buffers
      const key = Buffer.from(tenantKey, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Parse JSON and return
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Validate that an encryption key is properly formatted
   * @param key - Encryption key to validate
   * @returns true if valid, throws error otherwise
   */
  validateKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      throw new Error('Encryption key must be a non-empty string');
    }

    // Key should be 64 hex characters (32 bytes)
    if (key.length !== 64) {
      throw new Error('Encryption key must be 64 hex characters (32 bytes)');
    }

    // Verify it's valid hex
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      throw new Error('Encryption key must be valid hexadecimal');
    }

    return true;
  }
}
