/**
 * Encryption for the WhatsApp Flow data endpoint (POST /api/whatsapp/flow).
 *
 * Meta encrypts every request to a Flow endpoint: a fresh AES-128 key is
 * wrapped with our RSA public key (OAEP / SHA-256), and the payload is
 * AES-128-GCM under that key with the 16-byte auth tag appended. The reply
 * must be AES-128-GCM under the SAME key with the request's IV bit-flipped,
 * base64-encoded as the raw response body.
 *
 * The private key comes from FLOW_PRIVATE_KEY (PEM; literal "\n" sequences are
 * accepted so it can be pasted as a single-line environment variable). The
 * matching public key is derived from it and registered with Meta at startup.
 */

import crypto from 'crypto';

export class FlowDecryptionError extends Error {}

function loadPrivateKeyPem(): string {
  return (process.env.FLOW_PRIVATE_KEY || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/\\n/g, '\n');
}

export function isFlowEndpointConfigured(): boolean {
  return loadPrivateKeyPem().includes('PRIVATE KEY');
}

export function getFlowPublicKeyPem(): string | null {
  const pem = loadPrivateKeyPem();
  if (!pem) return null;
  try {
    return crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ type: 'spki', format: 'pem' }).toString();
  } catch {
    return null;
  }
}

export interface DecryptedFlowRequest {
  body: any;
  aesKey: Buffer;
  iv: Buffer;
}

export function decryptFlowRequest(payload: any): DecryptedFlowRequest {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = payload || {};
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new FlowDecryptionError('Missing encrypted payload fields.');
  }

  const pem = loadPrivateKeyPem();
  if (!pem) throw new FlowDecryptionError('FLOW_PRIVATE_KEY is not configured.');

  try {
    const aesKey = crypto.privateDecrypt(
      { key: crypto.createPrivateKey(pem), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(encrypted_aes_key, 'base64')
    );

    const iv = Buffer.from(initial_vector, 'base64');
    const data = Buffer.from(encrypted_flow_data, 'base64');
    const TAG_LENGTH = 16;
    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, iv);
    decipher.setAuthTag(data.subarray(data.length - TAG_LENGTH));
    const plaintext = Buffer.concat([decipher.update(data.subarray(0, data.length - TAG_LENGTH)), decipher.final()]).toString('utf-8');

    return { body: JSON.parse(plaintext), aesKey, iv };
  } catch (error: any) {
    throw new FlowDecryptionError(error?.message || 'Could not decrypt Flow request.');
  }
}

export function encryptFlowResponse(response: unknown, aesKey: Buffer, requestIv: Buffer): string {
  const flippedIv = Buffer.from(requestIv.map((byte) => ~byte & 0xff));
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, flippedIv);
  return Buffer.concat([cipher.update(JSON.stringify(response), 'utf-8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
}
