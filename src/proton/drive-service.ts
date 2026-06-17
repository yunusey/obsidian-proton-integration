import {
	MemoryCache,
	NodeEntity,
	NodeType,
	ProtonDriveClient,
} from '@protontech/drive-sdk';

import { AccountApi } from './api/account-api';
import { Addresses } from './api/addresses';
import { ApiClient } from './api/api-client';
import { Auth } from './api/auth';
import { HTTPClient } from './api/http-client';
import { Srp } from './api/srp';
import { initProtonCrypto } from './crypto';
import { Credentials, CredentialsStore } from './credentials';

export interface DriveFolderEntry {
	uid: string;
	name: string;
	type: 'file' | 'folder';
}

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

	async listMyFilesChildren(): Promise<DriveFolderEntry[]> {
		const client = await this.getClient();
		const root = await client.getMyFilesRootFolder();
		const entries: DriveFolderEntry[] = [];

		for await (const childUid of client.iterateFolderChildrenNodeUids(
			root.uid,
		)) {
			const node = await client.getNode(childUid);
			entries.push(toDriveFolderEntry(node));
		}

		entries.sort((a, b) => a.name.localeCompare(b.name));
		return entries;
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

function toDriveFolderEntry(node: NodeEntity): DriveFolderEntry {
	const name = node.name.ok
		? node.name.value
		: node.name.error instanceof Error
			? node.name.error.message
			: 'name' in node.name.error
				? node.name.error.name
				: 'Unknown node';

	return {
		uid: node.uid,
		name,
		type: node.type === NodeType.Folder ? 'folder' : 'file',
	};
}
