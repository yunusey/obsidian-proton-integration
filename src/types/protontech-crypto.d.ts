declare module '@protontech/crypto' {
	export const CryptoProxy: {
		importPrivateKey: (options: {
			armoredKey?: string;
			passphrase?: string;
		}) => Promise<PrivateKeyReference>;
		importPublicKey: (options: {
			armoredKey?: string;
			binaryKey?: Uint8Array;
		}) => Promise<PublicKeyReference>;
		exportPublicKey: (options: {
			key: PrivateKeyReference;
			format: 'binary';
		}) => Promise<Uint8Array>;
		decryptMessage: (options: {
			armoredMessage: string;
			armoredSignature: string;
			decryptionKeys: PrivateKeyReference[];
			verificationKeys: PublicKeyReference[];
		}) => Promise<{
			data: Uint8Array;
			verificationStatus: number;
		}>;
		setEndpoint: (
			endpoint: unknown,
			onClear: (endpoint: { clearKeyStore: () => void }) => void,
		) => void;
	};

	export type PrivateKeyReference = unknown;
	export type PublicKeyReference = unknown;

	export const VERIFICATION_STATUS: {
		SIGNED_AND_VALID: number;
	};
}

declare module '@protontech/crypto/proxy/endpoint/api.ts' {
	export class Api {
		static init: (options: object) => void;
		clearKeyStore: () => void;
	}
}

declare module '@protontech/crypto/srp' {
	export function getSrp(
		info: {
			Version: number;
			Modulus: string;
			ServerEphemeral: string;
			Salt: string;
		},
		options: { password: string },
	): Promise<{
		expectedServerProof: string;
		clientProof: string;
		clientEphemeral: string;
	}>;

	export function getRandomSrpVerifier(
		info: { Modulus: string },
		options: { password: string },
	): Promise<{
		version: number;
		salt: string;
		verifier: string;
	}>;

	export function computeKeyPassword(
		password: string,
		salt: string,
	): Promise<string>;

	export function generateKeySalt(): string;
}
