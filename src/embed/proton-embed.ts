import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
	MarkdownRenderChild,
} from 'obsidian';

import { ProtonEmbedResolver } from '../proton/embed/resolver';
import { isProtonDriveUrl } from '../proton/url-parser';

export class ProtonDriveEmbed extends MarkdownRenderChild {
	private blobUrl?: string;

	constructor(
		container: HTMLElement,
		private readonly app: App,
		private readonly sourceUrl: string,
		private readonly notePath: string,
		private readonly resolver: ProtonEmbedResolver,
	) {
		super(container);
	}

	onload(): void {
		void this.loadEmbed();
	}

	private async loadEmbed(): Promise<void> {
		this.containerEl.addClass('proton-drive-embed', 'proton-drive-embed-loading');
		this.containerEl.setText('Loading from proton drive…');

		const result = await this.resolver.prepareEmbed(this.sourceUrl);
		this.containerEl.empty();
		this.containerEl.removeClass('proton-drive-embed-loading');

		switch (result.status) {
			case 'ready':
				this.addCaption(result.fileName);
				if (result.mediaKind === 'image') {
					this.blobUrl = result.blobUrl;
					const img = this.containerEl.createEl('img', {
						cls: 'proton-drive-embed-image',
						attr: {
							src: result.blobUrl,
							alt: result.fileName,
							loading: 'lazy',
						},
					});
					void img;
				} else if (result.mediaKind === 'video') {
					this.blobUrl = result.blobUrl;
					const video = this.containerEl.createEl('video', {
						cls: 'proton-drive-embed-video',
						attr: {
							src: result.blobUrl,
							controls: 'true',
							preload: 'metadata',
						},
					});
					void video;
				} else if (result.mediaKind === 'document') {
					await this.renderDocument(result);
				}
				break;

			case 'auth-required':
				this.containerEl.addClass('proton-drive-embed-placeholder');
				this.containerEl.createSpan({
					text: 'Sign in to proton drive to embed this file. ',
				});
				this.containerEl.createEl('a', {
					cls: 'proton-drive-embed-link',
					text: 'Open link',
					href: result.sourceUrl,
				});
				break;

			case 'unsupported':
				this.containerEl.addClass('proton-drive-embed-placeholder');
				this.containerEl.createSpan({ text: `${result.reason}. ` });
				this.containerEl.createEl('a', {
					cls: 'proton-drive-embed-link',
					text: result.fileName ?? 'Open in Proton drive',
					href: result.sourceUrl,
				});
				break;
		}
	}

	private async renderDocument(
		result: Extract<
			Awaited<ReturnType<ProtonEmbedResolver['prepareEmbed']>>,
			{ status: 'ready'; mediaKind: 'document' }
		>,
	): Promise<void> {
		if (result.documentFormat === 'pdf') {
			if (!result.blobUrl) {
				return;
			}
			this.blobUrl = result.blobUrl;
			this.containerEl.createEl('iframe', {
				cls: 'proton-drive-embed-pdf',
				attr: {
					src: result.blobUrl,
					title: result.fileName,
				},
			});
			return;
		}

		if (!result.textContent) {
			return;
		}

		if (result.documentFormat === 'markdown') {
			const contentEl = this.containerEl.createDiv({
				cls: 'proton-drive-embed-markdown markdown-preview-view',
			});
			await MarkdownRenderer.render(
				this.app,
				result.textContent,
				contentEl,
				this.notePath,
				this,
			);
			return;
		}

		this.containerEl.createEl('pre', {
			cls: 'proton-drive-embed-text',
			text: result.textContent,
		});
	}

	private addCaption(fileName: string): void {
		this.containerEl.createDiv({
			cls: 'proton-drive-embed-caption',
			text: fileName,
		});
	}

	onunload(): void {
		if (this.blobUrl) {
			this.resolver.releaseBlobUrl(this.blobUrl);
		}
	}
}

export function registerProtonDriveEmbedProcessor(
	register: (
		postProcessor: (
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void,
	) => void,
	app: App,
	resolver: ProtonEmbedResolver,
): void {
	register((element, context) => {
		const seenUrls = new Set<string>();

		for (const embed of element.findAll('.external-embed')) {
			const img = embed.querySelector('img');
			const url = img?.getAttribute('src');
			if (!url || !isProtonDriveUrl(url) || seenUrls.has(url)) {
				continue;
			}
			seenUrls.add(url);
			mountEmbed(element, embed, url, context, app, resolver);
		}

		for (const img of element.findAll('img')) {
			const url = img.getAttribute('src');
			if (!url || !isProtonDriveUrl(url) || seenUrls.has(url)) {
				continue;
			}
			if (img.closest('.proton-drive-embed-host')) {
				continue;
			}
			seenUrls.add(url);
			const mountPoint = img.closest('.external-embed') ?? img;
			mountEmbed(element, mountPoint, url, context, app, resolver);
		}
	});
}

function mountEmbed(
	root: HTMLElement,
	anchor: Element,
	url: string,
	context: MarkdownPostProcessorContext,
	app: App,
	resolver: ProtonEmbedResolver,
): void {
	const container = root.createDiv({ cls: 'proton-drive-embed-host' });
	anchor.replaceWith(container);
	context.addChild(
		new ProtonDriveEmbed(container, app, url, context.sourcePath, resolver),
	);
}
