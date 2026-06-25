import '@protontech/crypto/polyfill';

import { Modal, Notice, Plugin } from 'obsidian';

import {
	clearPersistedCredentials,
	createCredentialStore,
	getOrCreateClientUid,
} from './plugin-storage';
import { registerProtonDriveEmbedProcessor } from './embed/proton-embed';
import { InsertProtonEmbedModal } from './embed/insert-embed-modal';
import { ProtonEmbedResolver } from './proton/embed/resolver';
import { DriveService } from './proton/drive-service';
import { DEFAULT_SETTINGS, PluginSettings, ProtonSettingTab } from './settings';

export default class ObsidianProtonPlugin extends Plugin {
	settings!: PluginSettings;
	driveService!: DriveService;
	embedResolver!: ProtonEmbedResolver;

	async onload() {
		await this.loadSettings();

		if (this.settings.credentialsInMemoryOnly) {
			await clearPersistedCredentials(this);
		}

		const credentialStore = createCredentialStore(this, () =>
			this.shouldPersistCredentials(),
		);
		this.driveService = new DriveService(credentialStore, () =>
			getOrCreateClientUid(this),
		);
		this.embedResolver = new ProtonEmbedResolver(this.driveService);
		await this.driveService.initialize();

		registerProtonDriveEmbedProcessor(
			(processor) => this.registerMarkdownPostProcessor(processor),
			this.app,
			this.embedResolver,
		);

		this.addCommand({
			id: 'proton-sign-in',
			name: 'Sign in to proton drive',
			checkCallback: (checking) => {
				if (this.driveService.isLoggedIn()) {
					return false;
				}
				if (!checking) {
					void this.signInToProtonDrive();
				}
				return true;
			},
		});

		this.addCommand({
			id: 'proton-sign-out',
			name: 'Sign out of proton drive',
			checkCallback: (checking) => {
				if (!this.driveService.isLoggedIn()) {
					return false;
				}
				if (!checking) {
					void this.signOutOfProtonDrive();
				}
				return true;
			},
		});

		this.addCommand({
			id: 'insert-proton-drive-embed',
			name: 'Insert proton drive embed from node UID',
			editorCallback: (editor) => {
				new InsertProtonEmbedModal(this.app, (markdown) => {
					editor.replaceSelection(markdown);
				}).open();
			},
		});

		this.addSettingTab(new ProtonSettingTab(this.app, this));
	}

	onunload() {}

	shouldPersistCredentials(): boolean {
		return !this.settings.credentialsInMemoryOnly;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async signInToProtonDrive(): Promise<void> {
		const modal = new ProtonSignInModal(this.app, async (signInUrl) => {
			window.open(signInUrl, '_blank');
			new Notice(
				'Complete sign-in in your browser, then return to Obsidian.',
			);
		});

		try {
			modal.open();
			await this.driveService.getAuth().authViaWeb(async (signInUrl) => {
				await modal.waitForUser(signInUrl);
			});
			modal.close();
			new Notice('Signed in to proton drive');
		} catch (error) {
			modal.close();
			const message =
				error instanceof Error ? error.message : 'Sign-in failed';
			new Notice(`Proton Drive sign-in failed: ${message}`);
			console.error('Proton Drive sign-in failed', error);
		}
	}

	async signOutOfProtonDrive(): Promise<void> {
		await this.driveService.logout();
		new Notice('Signed out of proton drive');
	}
}

class ProtonSignInModal extends Modal {
	private resolveOpen?: (signInUrl: string) => void;

	constructor(
		app: ObsidianProtonPlugin['app'],
		private readonly onSignInUrl: (
			signInUrl: string,
		) => void | Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Sign in to proton drive' });
		contentEl.createEl('p', {
			text: 'This is a third-party application not officially supported by proton.',
		});
		contentEl.createEl('p', {
			text: 'Click the button below to open proton sign-in in your browser.',
		});

		const button = contentEl.createEl('button', {
			text: 'Open sign-in page',
		});
		button.addEventListener('click', () => {
			void this.openSignInPage();
		});
	}

	waitForUser(signInUrl: string): Promise<void> {
		this.pendingSignInUrl = signInUrl;
		return new Promise((resolve) => {
			this.resolveOpen = () => resolve();
		});
	}

	private pendingSignInUrl?: string;

	private async openSignInPage(): Promise<void> {
		if (!this.pendingSignInUrl) {
			return;
		}
		await this.onSignInUrl(this.pendingSignInUrl);
		this.resolveOpen?.(this.pendingSignInUrl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
