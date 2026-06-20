import { App, Notice, PluginSettingTab, Setting } from 'obsidian';

import { clearPersistedCredentials } from './plugin-storage';
import ObsidianProtonPlugin from './main';

export interface PluginSettings {
	/** When true, credentials are kept in memory only for this Obsidian session. */
	credentialsInMemoryOnly: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	credentialsInMemoryOnly: true, /* privacy by default :) */
};

export class ProtonSettingTab extends PluginSettingTab {
	plugin: ObsidianProtonPlugin;

	constructor(app: App, plugin: ObsidianProtonPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('Proton drive').setHeading();

		new Setting(containerEl)
			.setName('Account status')
			.setDesc(this.getAccountStatusDescription())
			.addButton((button) => {
				if (this.plugin.driveService.isLoggedIn()) {
					button.setButtonText('Sign out').onClick(async () => {
						await this.plugin.driveService.logout();
						new Notice('Signed out of proton drive');
						this.display();
					});
				} else {
					button.setButtonText('Sign in').onClick(async () => {
						await this.plugin.signInToProtonDrive();
						this.display();
					});
				}
			});

		new Setting(containerEl)
			.setName('Keep credentials in memory only')
			.setDesc(
				'Do not write sign-in data to Obsidian plugin storage. You will need to sign in again after restarting Obsidian. On by default.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.credentialsInMemoryOnly)
					.onChange(async (value) => {
						this.plugin.settings.credentialsInMemoryOnly = value;
						await this.plugin.saveSettings();
						if (value) {
							await clearPersistedCredentials(this.plugin);
						}
						this.display();
					}),
			);

		new Setting(containerEl).setDesc(this.getPrivacyDisclaimer());
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
