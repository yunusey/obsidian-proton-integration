import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from 'obsidian';

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

	/**
	 * Obsidian 1.13.0+: declarative definitions for settings search and auto-save.
	 * {@link display} remains as a fallback for older Obsidian versions.
	 */
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
									// eslint-disable-next-line obsidianmd/no-unsupported-api -- only reached on Obsidian 1.13+
									this.update();
								});
						} else {
							button
								.setButtonText('Sign in')
								.onClick(async () => {
									await this.plugin.signInToProtonDrive();
									// eslint-disable-next-line obsidianmd/no-unsupported-api -- only reached on Obsidian 1.13+
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
		// eslint-disable-next-line obsidianmd/no-unsupported-api -- only invoked by Obsidian 1.13+
		await super.setControlValue(key, value);
		if (key === 'credentialsInMemoryOnly' && value === true) {
			await clearPersistedCredentials(this.plugin);
		}
		// Refresh account status / privacy copy that depend on this toggle.
		// eslint-disable-next-line obsidianmd/no-unsupported-api -- only reached on Obsidian 1.13+
		this.update();
	}

	/**
	 * Fallback for Obsidian versions before 1.13.0.
	 * Skipped when {@link getSettingDefinitions} returns a non-empty array.
	 */
	display(): void {
		this.renderLegacySettings();
	}

	private renderLegacySettings(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Account status')
			.setDesc(this.getAccountStatusDescription())
			.addButton((button) => {
				if (this.plugin.driveService.isLoggedIn()) {
					button.setButtonText('Sign out').onClick(async () => {
						await this.plugin.signOutOfProtonDrive();
						this.renderLegacySettings();
					});
				} else {
					button.setButtonText('Sign in').onClick(async () => {
						await this.plugin.signInToProtonDrive();
						this.renderLegacySettings();
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
						this.renderLegacySettings();
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
