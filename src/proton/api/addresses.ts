import {
	CryptoProxy,
	PrivateKeyReference,
	PublicKeyReference,
	VERIFICATION_STATUS,
} from '@protontech/crypto';
import { ProtonDriveAccountAddress } from '@protontech/drive-sdk';

import { Credentials } from '../credentials';
import { AccountApi, AddressKey, AddressUser } from './account-api';
import { AddressNotFoundError } from './errors';

interface UserData {
	userPrimaryPrivateKeys: PrivateKeyReference[];
	userPrimaryPublicKeys: PublicKeyReference[];
	primaryAddress: {
		email: string;
		addressId: string;
		addressKeyId: string;
	};
	addresses: AddressUser[];
}

export class Addresses {
	private userDataPromise?: Promise<UserData>;
	private readonly otherUsersPublicKeysByEmailPromises = new Map<
		string,
		Promise<PublicKeyReference[]>
	>();
	private readonly addressKeysByKeyIdPromises = new Map<
		string,
		Promise<{
			id: string;
			privateKey: PrivateKeyReference;
			publicKey: PublicKeyReference;
		}>
	>();

	constructor(
		private readonly accountApi: AccountApi,
		private readonly credentials: Credentials,
	) {
		credentials.on('sessionInfoChanged', () => {
			this.userDataPromise = undefined;
			this.otherUsersPublicKeysByEmailPromises.clear();
			this.addressKeysByKeyIdPromises.clear();
		});
	}

	async getOwnPrimaryAddress(): Promise<ProtonDriveAccountAddress> {
		const { primaryAddress } = await this.getUserData();
		return this.getOwnAddress(primaryAddress.addressId);
	}

	async getOwnAddresses(): Promise<ProtonDriveAccountAddress[]> {
		const userData = await this.getUserData();
		const addresses: ProtonDriveAccountAddress[] = [];

		for (const address of userData.addresses) {
			if (!address.ID) {
				continue;
			}
			addresses.push(await this.getOwnAddress(address.ID));
		}

		return addresses;
	}

	async getOwnAddress(
		emailOrAddressId: string,
	): Promise<ProtonDriveAccountAddress> {
		const userData = await this.getUserData();
		const address = userData.addresses.find(
			(a) => a.ID === emailOrAddressId || a.Email === emailOrAddressId,
		);
		if (!address?.ID || !address.Email) {
			throw new Error(`Address ${emailOrAddressId} not found`);
		}

		const keys: { id: string; key: PrivateKeyReference }[] = [];
		const errors: unknown[] = [];

		for (const key of address.Keys ?? []) {
			try {
				const { id, privateKey } = await this.getAddressKey(
					userData.userPrimaryPrivateKeys,
					userData.userPrimaryPublicKeys,
					key,
					address.Email,
				);
				keys.push({ id, key: privateKey });
			} catch (error: unknown) {
				errors.push(error);
			}
		}

		if (keys.length === 0) {
			throw new Error(
				`No private key found: ${errors.map(String).join('; ')}`,
			);
		}

		return {
			email: address.Email,
			addressId: address.ID,
			primaryKeyIndex: 0,
			keys,
		};
	}

	async hasProtonAccount(email: string): Promise<boolean> {
		const keys = await this.getPublicKeys(email);
		return keys.length > 0;
	}

	async getPublicKeys(
		email: string,
		_forceRefresh?: boolean,
	): Promise<PublicKeyReference[]> {
		if (!this.credentials.isLoggedIn()) {
			return [];
		}

		const userData = await this.getUserData();
		const address = userData.addresses.find((a) => a.Email === email);
		if (address) {
			return this.getOwnPublicKeys(address);
		}
		return this.getOtherPublicKeys(email);
	}

	private async getOwnPublicKeys(
		address: AddressUser,
	): Promise<PublicKeyReference[]> {
		const { userPrimaryPrivateKeys, userPrimaryPublicKeys } =
			await this.getUserData();

		const keys: PublicKeyReference[] = [];
		const errors: unknown[] = [];

		for (const key of address.Keys ?? []) {
			try {
				const { publicKey } = await this.getAddressKey(
					userPrimaryPrivateKeys,
					userPrimaryPublicKeys,
					key,
					address.Email,
				);
				keys.push(publicKey);
			} catch (error: unknown) {
				errors.push(error);
			}
		}

		if (keys.length === 0 && errors.length > 0) {
			throw new Error(
				`Failed to load public keys: ${errors.map(String).join('; ')}`,
			);
		}

		return keys;
	}

	private async getOtherPublicKeys(
		email: string,
	): Promise<PublicKeyReference[]> {
		const existing = this.otherUsersPublicKeysByEmailPromises.get(email);
		if (existing) {
			return existing;
		}

		const promise = this.loadOtherPublicKeys(email);
		this.otherUsersPublicKeysByEmailPromises.set(email, promise);
		return promise;
	}

	private async loadOtherPublicKeys(
		email: string,
	): Promise<PublicKeyReference[]> {
		try {
			const response = await this.accountApi.keys(email);
			return await Promise.all(
				(response.Address?.Keys ?? []).map((key) =>
					CryptoProxy.importPublicKey({ armoredKey: key.PublicKey }),
				),
			);
		} catch (error) {
			if (error instanceof AddressNotFoundError) {
				return [];
			}
			this.otherUsersPublicKeysByEmailPromises.delete(email);
			throw error;
		}
	}

	private async getUserData(): Promise<UserData> {
		if (this.userDataPromise) {
			return this.userDataPromise;
		}

		this.userDataPromise = this.loadUserData();
		return this.userDataPromise;
	}

	private async loadUserData(): Promise<UserData> {
		const userKeyPassword = this.credentials.getUserKeyPassword();
		if (!userKeyPassword) {
			throw new Error('Password is not set');
		}

		try {
			const users = await this.accountApi.users();
			const userKeys = users.User?.Keys ?? [];

			const userPrimaryPrivateKeys: PrivateKeyReference[] = [];
			const userPrimaryPublicKeys: PublicKeyReference[] = [];

			for (const userKey of userKeys) {
				if (!userKey.PrivateKey) {
					continue;
				}

				const userPrimaryPrivateKey = await CryptoProxy.importPrivateKey({
					armoredKey: userKey.PrivateKey,
					passphrase: userKeyPassword,
				});

				const userPrimaryPublicKey = await CryptoProxy.importPublicKey({
					binaryKey: await CryptoProxy.exportPublicKey({
						key: userPrimaryPrivateKey,
						format: 'binary',
					}),
				});

				userPrimaryPrivateKeys.push(userPrimaryPrivateKey);
				userPrimaryPublicKeys.push(userPrimaryPublicKey);
			}

			const addresses = await this.accountApi.addresses();
			const primaryAddress = addresses.Addresses?.[0];
			const primaryAddressPrimaryKey = primaryAddress?.Keys?.[0];

			if (
				!primaryAddress?.Email ||
				!primaryAddress.ID ||
				!primaryAddressPrimaryKey?.ID
			) {
				throw new Error('Missing primary address');
			}

			if (
				userPrimaryPrivateKeys.length === 0 ||
				userPrimaryPublicKeys.length === 0
			) {
				throw new Error('Missing user primary keys');
			}

			return {
				userPrimaryPrivateKeys,
				userPrimaryPublicKeys,
				primaryAddress: {
					email: primaryAddress.Email,
					addressId: primaryAddress.ID,
					addressKeyId: primaryAddressPrimaryKey.ID,
				},
				addresses: addresses.Addresses ?? [],
			};
		} catch (error: unknown) {
			this.userDataPromise = undefined;
			throw error;
		}
	}

	private async getAddressKey(
		userPrimaryPrivateKeys: PrivateKeyReference[],
		userPrimaryPublicKeys: PublicKeyReference[],
		key: AddressKey,
		email?: string,
	): Promise<{
		id: string;
		privateKey: PrivateKeyReference;
		publicKey: PublicKeyReference;
	}> {
		const keyId = key.ID;
		if (!keyId) {
			throw new Error('Missing key ID');
		}

		const existing = this.addressKeysByKeyIdPromises.get(keyId);
		if (existing) {
			return existing;
		}

		const promise = this.loadAddressKey(
			userPrimaryPrivateKeys,
			userPrimaryPublicKeys,
			key,
			keyId,
			email,
		);
		this.addressKeysByKeyIdPromises.set(keyId, promise);
		return promise;
	}

	private async loadAddressKey(
		userPrimaryPrivateKeys: PrivateKeyReference[],
		userPrimaryPublicKeys: PublicKeyReference[],
		key: AddressKey,
		keyId: string,
		email?: string,
	): Promise<{
		id: string;
		privateKey: PrivateKeyReference;
		publicKey: PublicKeyReference;
	}> {
		try {
			if (!key.Token && key.PrivateKey) {
				const userKeyPassword = this.credentials.getUserKeyPassword();
				if (!userKeyPassword) {
					throw new Error('User key password is not set');
				}

				const privateKey = await CryptoProxy.importPrivateKey({
					armoredKey: key.PrivateKey,
					passphrase: userKeyPassword,
				});

				return {
					id: keyId,
					privateKey,
					publicKey: await CryptoProxy.importPublicKey({
						binaryKey: await CryptoProxy.exportPublicKey({
							key: privateKey,
							format: 'binary',
						}),
					}),
				};
			}

			const { verificationStatus } = await CryptoProxy.decryptMessage({
				armoredMessage: key.Token ?? '',
				armoredSignature: key.Signature ?? '',
				decryptionKeys: userPrimaryPrivateKeys,
				verificationKeys: userPrimaryPublicKeys,
			});

			if (verificationStatus !== VERIFICATION_STATUS.SIGNED_AND_VALID) {
				throw new Error('Failed to verify address key');
			}

			const { data: decryptedToken } = await CryptoProxy.decryptMessage({
				armoredMessage: key.Token ?? '',
				armoredSignature: key.Signature ?? '',
				decryptionKeys: userPrimaryPrivateKeys,
				verificationKeys: userPrimaryPublicKeys,
			});

			const privateKey = await CryptoProxy.importPrivateKey({
				armoredKey: key.PrivateKey ?? '',
				passphrase: decryptedToken.toString(),
			});

			return {
				id: keyId,
				privateKey,
				publicKey: await CryptoProxy.importPublicKey({
					binaryKey: await CryptoProxy.exportPublicKey({
						key: privateKey,
						format: 'binary',
					}),
				}),
			};
		} catch (error) {
			this.addressKeysByKeyIdPromises.delete(keyId);
			const detail = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Error loading address key ${keyId} for ${email ?? 'unknown'}: ${detail}`,
			);
		}
	}
}
