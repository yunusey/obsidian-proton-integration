import { Plugin } from 'obsidian';

import {
	CredentialsStore,
	StoredCredentials,
} from './proton/credentials';

const CREDENTIALS_DATA_KEY = 'protonCredentials';
const CLIENT_UID_DATA_KEY = 'protonClientUid';

export class PluginCredentialStore implements CredentialsStore {
	constructor(private readonly plugin: Plugin) {}

	async load(): Promise<StoredCredentials | null> {
		const data = (await this.plugin.loadData()) as Record<
			string,
			unknown
		> | null;
		const stored = data?.[CREDENTIALS_DATA_KEY];
		if (!isStoredCredentials(stored)) {
			return null;
		}
		return stored;
	}

	async save(credentials: StoredCredentials): Promise<void> {
		const data =
			((await this.plugin.loadData()) as Record<string, unknown> | null) ??
			{};
		data[CREDENTIALS_DATA_KEY] = credentials;
		await this.plugin.saveData(data);
	}

	async remove(): Promise<void> {
		const data =
			((await this.plugin.loadData()) as Record<string, unknown> | null) ??
			{};
		delete data[CREDENTIALS_DATA_KEY];
		await this.plugin.saveData(data);
	}
}

export async function getOrCreateClientUid(plugin: Plugin): Promise<string> {
	const data =
		((await plugin.loadData()) as Record<string, unknown> | null) ?? {};
	const existing = data[CLIENT_UID_DATA_KEY];
	if (typeof existing === 'string' && existing.length > 0) {
		return existing;
	}

	const bytes = crypto.getRandomValues(new Uint8Array(16));
	const clientUid = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('');
	data[CLIENT_UID_DATA_KEY] = clientUid;
	await plugin.saveData(data);
	return clientUid;
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
	if (!value || typeof value !== 'object') {
		return false;
	}
	return 'session' in value || 'userKeyPassword' in value;
}
