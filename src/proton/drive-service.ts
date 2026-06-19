import { MemoryCache, ProtonDriveClient } from '@protontech/drive-sdk';
import { ProtonDrivePhotosClient } from '@protontech/drive-sdk/dist/protonDrivePhotosClient';

import { AccountApi } from './api/account-api';
import { Addresses } from './api/addresses';
import { ApiClient } from './api/api-client';
import { Auth } from './api/auth';
import { HTTPClient } from './api/http-client';
import { Srp } from './api/srp';
import { initProtonCrypto } from './crypto';
import { Credentials, CredentialsStore } from './credentials';
import { parseNodeUid } from './node-uid';

type NodeAccessClient = Pick<
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- photos nodes use experimental SDK client
	ProtonDriveClient | ProtonDrivePhotosClient,
	'getNode' | 'getFileDownloader'
>;

export class DriveService {
	private credentials: Credentials;
	private apiClient?: ApiClient;
	private auth?: Auth;
	private addresses?: Addresses;
	private client?: ProtonDriveClient;
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- photos nodes use experimental SDK client
	private photosClient?: ProtonDrivePhotosClient;
	private clientUid?: string;
	private photosVolumeId?: string;
	private driveVolumeId?: string;

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

	// eslint-disable-next-line @typescript-eslint/no-deprecated -- photos nodes use experimental SDK client
	async getPhotosClient(): Promise<ProtonDrivePhotosClient> {
		if (!this.credentials.isLoggedIn()) {
			throw new Error('Not signed in to Proton Drive');
		}
		await this.ensurePhotosClient();
		return this.photosClient!;
	}

	async getClientForNodeUid(nodeUid: string): Promise<NodeAccessClient> {
		await this.ensureVolumeIds();
		const { volumeId } = parseNodeUid(nodeUid);

		if (volumeId === this.photosVolumeId) {
			return this.getPhotosClient();
		}
		if (volumeId === this.driveVolumeId) {
			return this.getClient();
		}

		throw new Error(
			'Unsupported Proton volume. Use a photos or my files node uid, or embed a share link instead.',
		);
	}

	async logout(): Promise<void> {
		this.client = undefined;
		this.photosClient = undefined;
		this.photosVolumeId = undefined;
		this.driveVolumeId = undefined;
		await this.credentials.signOut();
	}

	private async ensureVolumeIds(): Promise<void> {
		if (this.photosVolumeId && this.driveVolumeId) {
			return;
		}

		const photosClient = await this.getPhotosClient();
		const driveClient = await this.getClient();
		const [photosRoot, driveRoot] = await Promise.all([
			photosClient.getMyPhotosRootFolder(),
			driveClient.getMyFilesRootFolder(),
		]);

		this.photosVolumeId = parseNodeUid(photosRoot.uid).volumeId;
		this.driveVolumeId = parseNodeUid(driveRoot.uid).volumeId;
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

	private async ensurePhotosClient(): Promise<void> {
		if (this.photosClient) {
			return;
		}

		this.ensureApiLayer();

		const openPGPCryptoModule = initProtonCrypto();
		const httpClient = new HTTPClient(this.apiClient!);
		const srpModule = new Srp(new AccountApi(this.apiClient!));

		// eslint-disable-next-line @typescript-eslint/no-deprecated -- photos nodes use experimental SDK client
		this.photosClient = new ProtonDrivePhotosClient({
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
