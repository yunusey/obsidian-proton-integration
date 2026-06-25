import { AUTH_CLIENT_ID, PROTON_ACCOUNT_URL } from '../constants';

const FORK_AAD = new TextEncoder().encode('fork');
const GCM_NONCE_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

export const FORK_POLL_INTERVAL_MS = 5000;
export const FORK_INITIAL_DELAY_MS = 5000;
export const FORK_MAX_POLL_TIME_MS = 10 * 60 * 1000;

type ForkPayloadJson = {
	type?: string;
	keyPassword?: string;
};

export function generateSignInUrl(userCode: string): {
	encryptionKey: Uint8Array;
	signInUrl: string;
} {
	const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
	const base64EncodedKey = uint8ArrayToBase64(encryptionKey);
	const payload = `0:${userCode}:${base64EncodedKey}:${AUTH_CLIENT_ID}`;
	const signInUrl = `${PROTON_ACCOUNT_URL}/desktop/login?app=drive&pv=3#payload=${encodeURIComponent(payload)}`;

	return { encryptionKey, signInUrl };
}

export async function parseUserKeyPassword(
	encryptionKey: Uint8Array,
	encryptedPayload: string,
): Promise<string> {
	const decryptedPayload = await decryptForkPayload(
		encryptedPayload,
		encryptionKey,
	);
	return parseForkUserKeyPassword(decryptedPayload);
}

async function decryptForkPayload(
	encodedPayload: string,
	encryptionKey: Uint8Array,
): Promise<string> {
	const blob = base64ToUint8Array(encodedPayload);
	if (blob.length < GCM_NONCE_LENGTH + GCM_TAG_LENGTH) {
		throw new Error('Invalid fork payload blob length');
	}

	const nonce = blob.subarray(0, GCM_NONCE_LENGTH);
	const tag = blob.subarray(blob.length - GCM_TAG_LENGTH);
	const ciphertext = blob.subarray(
		GCM_NONCE_LENGTH,
		blob.length - GCM_TAG_LENGTH,
	);

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		toArrayBuffer(encryptionKey),
		{ name: 'AES-GCM' },
		false,
		['decrypt'],
	);

	const plaintext = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: toArrayBuffer(nonce),
			additionalData: FORK_AAD,
			tagLength: GCM_TAG_LENGTH * 8,
		},
		cryptoKey,
		toArrayBuffer(concatUint8Arrays(ciphertext, tag)),
	);

	return new TextDecoder().decode(plaintext);
}

function parseForkUserKeyPassword(decryptedPayloadJson: string): string {
	const payload = JSON.parse(decryptedPayloadJson) as ForkPayloadJson;
	const keyPassword = payload.keyPassword;
	if (typeof keyPassword !== 'string') {
		throw new Error('Failed to deserialize the fork payload');
	}
	return keyPassword;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const { buffer, byteOffset, byteLength } = bytes;
	if (buffer instanceof ArrayBuffer) {
		return buffer.slice(byteOffset, byteOffset + byteLength);
	}

	return bytes.slice().buffer;
}
