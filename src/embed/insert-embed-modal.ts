import { App, Modal, Notice, Setting } from 'obsidian';

import { parseNodeUid } from '../proton/node-uid';
import { formatProtonDriveNodeUrl } from '../proton/url-parser';

export class InsertProtonEmbedModal extends Modal {
	private nodeUid = '';

	constructor(
		app: App,
		private readonly onSubmit: (markdown: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Insert proton drive embed' });
		contentEl.createEl('p', {
			text: 'Paste a proton node UID (`volumeId~nodeId`). This creates a `proton-drive://` link that works for photos library items.',
		});

		// eslint-disable-next-line obsidianmd/ui/sentence-case -- Proton SDK identifier format
		new Setting(contentEl).setName('Node UID').addText((text) => {
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- Proton SDK identifier format
			text.setPlaceholder('volumeId~nodeId');
			text.onChange((value) => {
				this.nodeUid = value.trim();
			});
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					this.submit();
				}
			});
		});

		new Setting(contentEl).addButton((button) => {
			button
				.setButtonText('Insert embed')
				.setCta()
				.onClick(() => {
					this.submit();
				});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private submit(): void {
		if (!this.nodeUid) {
			return;
		}

		try {
			// The return value is ignored--used for validation only
			parseNodeUid(this.nodeUid);
		} catch {
			new Notice('Invalid node UID. Expected `volumeId~nodeId`.');
			return;
		}

		const url = formatProtonDriveNodeUrl(this.nodeUid);
		this.onSubmit(`![](${url})`);
		this.close();
	}
}
