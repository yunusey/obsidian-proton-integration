import { App, Notice, PluginSettingTab, Setting } from 'obsidian';

import ObsidianProtonPlugin from './main';
import { DriveService } from './proton/drive-service';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PluginSettings {}

export const DEFAULT_SETTINGS: PluginSettings = {};

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

		new Setting(containerEl).setDesc(
			'This is a third-party application not officially supported by proton. Your credentials are stored locally in Obsidian plugin data.',
		);
	}

	private getAccountStatusDescription(): string {
		return this.plugin.driveService.isLoggedIn()
			? 'Signed in to proton drive'
			: 'Not signed in';
	}
}

export function formatDriveListing(
	entries: Awaited<ReturnType<DriveService['listMyFilesChildren']>>,
): string {
	if (entries.length === 0) {
		return 'My files is empty.';
	}

	return entries
		.map((entry) => `${entry.type === 'folder' ? '📁' : '📄'} ${entry.name}`)
		.join('\n');
}
