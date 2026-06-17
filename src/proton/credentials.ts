export interface SessionInfo {
	uid: string;
	accessToken: string;
	refreshToken?: string;
}

export interface StoredCredentials {
	cachePassword?: string;
	userKeyPassword?: string;
	session?: SessionInfo;
}

export interface CredentialsStore {
	load(): Promise<StoredCredentials | null>;
	save(data: StoredCredentials): Promise<void>;
	remove(): Promise<void>;
}

export class Credentials {
	private cachePassword?: string;
	private userKeyPassword?: string;
	private sessionInfo?: SessionInfo;
	private readonly sessionInfoChangedCallbacks = new Set<() => void>();

	constructor(private readonly store: CredentialsStore) {}

	on(_event: 'sessionInfoChanged', callback: () => void): void {
		this.sessionInfoChangedCallbacks.add(callback);
	}

	isLoggedIn(): boolean {
		return !!this.userKeyPassword && !!this.sessionInfo;
	}

	getUserKeyPassword(): string | undefined {
		return this.userKeyPassword;
	}

	async getCachePassword(): Promise<string> {
		if (!this.cachePassword) {
			const bytes = crypto.getRandomValues(new Uint8Array(32));
			this.cachePassword = uint8ArrayToBase64(bytes);
			await this.persistCredentials();
		}
		return this.cachePassword;
	}

	get uid(): string | undefined {
		return this.sessionInfo?.uid;
	}

	get accessToken(): string | undefined {
		return this.sessionInfo?.accessToken;
	}

	get refreshToken(): string | undefined {
		return this.sessionInfo?.refreshToken;
	}

	async load(): Promise<void> {
		const raw = await this.store.load();
		if (!raw) {
			return;
		}
		this.cachePassword = raw.cachePassword;
		this.userKeyPassword = raw.userKeyPassword;
		this.sessionInfo = raw.session;
		this.notifySessionInfoChanged();
	}

	async setUserKeyPassword(userKeyPassword: string): Promise<void> {
		this.userKeyPassword = userKeyPassword;
		await this.persistCredentials();
		this.notifySessionInfoChanged();
	}

	async setSessionInfo(info: SessionInfo): Promise<void> {
		this.sessionInfo = info;
		await this.persistCredentials();
		this.notifySessionInfoChanged();
	}

	async signOut(): Promise<void> {
		this.userKeyPassword = undefined;
		this.sessionInfo = undefined;
		await this.store.remove();
		this.notifySessionInfoChanged();
	}

	private async persistCredentials(): Promise<void> {
		if (!this.userKeyPassword || !this.sessionInfo) {
			return;
		}
		await this.store.save({
			cachePassword: this.cachePassword,
			userKeyPassword: this.userKeyPassword,
			session: this.sessionInfo,
		});
	}

	private notifySessionInfoChanged(): void {
		for (const callback of this.sessionInfoChangedCallbacks) {
			callback();
		}
	}
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}
