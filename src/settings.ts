import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';

import { clearPersistedCredentials } from './plugin-storage';
import ObsidianProtonPlugin from './main';

export interface PluginSettings {
	/** When true, credentials are kept in memory only for this Obsidian session. */
	credentialsInMemoryOnly: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	credentialsInMemoryOnly: true /* privacy by default :) */,
};

export class ProtonSettingTab extends PluginSettingTab {
	plugin: ObsidianProtonPlugin;

	constructor(app: App, plugin: ObsidianProtonPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<'credentialsInMemoryOnly'>[] {
		return [
			{
				name: 'Account status',
				desc: this.getAccountStatusDescription(),
				render: (setting) => {
					setting.addButton((button) => {
						if (this.plugin.driveService.isLoggedIn()) {
							button
								.setButtonText('Sign out')
								.onClick(async () => {
									await this.plugin.signOutOfProtonDrive();
									this.update();
								});
						} else {
							button
								.setButtonText('Sign in')
								.onClick(async () => {
									await this.plugin.signInToProtonDrive();
									this.update();
								});
						}
					});
				},
			},
			{
				name: 'Keep credentials in memory only',
				desc: 'Do not write sign-in data to Obsidian plugin storage. You will need to sign in again after restarting Obsidian. On by default.',
				control: {
					type: 'toggle',
					key: 'credentialsInMemoryOnly',
				},
			},
			{
				name: 'Privacy',
				desc: this.getPrivacyDisclaimer(),
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		if (key === 'credentialsInMemoryOnly' && value === true) {
			await clearPersistedCredentials(this.plugin);
		}
		this.update();
	}

	private getAccountStatusDescription(): string {
		const status = this.plugin.driveService.isLoggedIn()
			? 'Signed in to proton drive'
			: 'Not signed in';

		if (this.plugin.settings.credentialsInMemoryOnly) {
			return `${status} (memory only)`;
		}

		return status;
	}

	private getPrivacyDisclaimer(): string {
		if (this.plugin.settings.credentialsInMemoryOnly) {
			return 'This is a third-party application not officially supported by proton. Sign-in data is kept in memory for this session only.';
		}

		return 'This is a third-party application not officially supported by proton. Sign-in data is stored in Obsidian plugin data unless you enable memory-only mode or sign out.';
	}
}
