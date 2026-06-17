import { MemoryCache, ProtonDriveClient } from '@protontech/drive-sdk';

import { AccountApi } from './api/account-api';
import { Addresses } from './api/addresses';
import { ApiClient } from './api/api-client';
import { Auth } from './api/auth';
import { HTTPClient } from './api/http-client';
import { Srp } from './api/srp';
import { initProtonCrypto } from './crypto';
import { Credentials, CredentialsStore } from './credentials';

export class DriveService {
	private credentials: Credentials;
	private apiClient?: ApiClient;
	private auth?: Auth;
	private addresses?: Addresses;
	private client?: ProtonDriveClient;
	private clientUid?: string;

	constructor(
		private readonly credentialsStore: CredentialsStore,
		private readonly getClientUid: () => Promise<string>,
	) {
		this.credentials = new Credentials(credentialsStore);
	}

	async initialize(): Promise<void> {
		await this.credentials.load();
		this.clientUid = await this.getClientUid();

		if (this.credentials.isLoggedIn()) {
			await this.ensureClient();
		}
	}

	isLoggedIn(): boolean {
		return this.credentials.isLoggedIn();
	}

	getAuth(): Auth {
		this.ensureApiLayer();
		return this.auth!;
	}

	async getClient(): Promise<ProtonDriveClient> {
		if (!this.credentials.isLoggedIn()) {
			throw new Error('Not signed in to Proton Drive');
		}
		await this.ensureClient();
		return this.client!;
	}

	async logout(): Promise<void> {
		this.client = undefined;
		await this.credentials.signOut();
	}

	private ensureApiLayer(): void {
		if (this.apiClient && this.auth && this.addresses) {
			return;
		}

		this.apiClient = new ApiClient(this.credentials);
		const accountApi = new AccountApi(this.apiClient);
		this.auth = new Auth(accountApi, this.credentials);
		this.addresses = new Addresses(accountApi, this.credentials);
	}

	private async ensureClient(): Promise<void> {
		if (this.client) {
			return;
		}

		this.ensureApiLayer();

		const openPGPCryptoModule = initProtonCrypto();
		const httpClient = new HTTPClient(this.apiClient!);
		const srpModule = new Srp(new AccountApi(this.apiClient!));

		this.client = new ProtonDriveClient({
			httpClient,
			entitiesCache: new MemoryCache(),
			cryptoCache: new MemoryCache(),
			account: this.addresses!,
			openPGPCryptoModule,
			srpModule,
			config: {
				clientUid: this.clientUid,
			},
		});
	}
}
