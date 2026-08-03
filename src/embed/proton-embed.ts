import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderer,
	MarkdownRenderChild,
} from 'obsidian';

import { DriveService } from '../proton/drive-service';
import { ProtonEmbedResolver } from '../proton/embed/resolver';
import { isProtonDriveUrl, PROTON_DRIVE_PROTOCOL } from '../proton/url-parser';

export class ProtonDriveEmbed extends MarkdownRenderChild {
	private blobUrl?: string;
	private loadGeneration = 0;

	constructor(
		container: HTMLElement,
		private readonly app: App,
		private readonly sourceUrl: string,
		private readonly notePath: string,
		private readonly resolver: ProtonEmbedResolver,
		private readonly driveService: DriveService,
	) {
		super(container);
	}

	onload(): void {
		this.register(
			this.driveService.onAuthChange(() => {
				void this.loadEmbed();
			}),
		);
		void this.loadEmbed();
	}

	private async loadEmbed(): Promise<void> {
		const generation = ++this.loadGeneration;
		this.releaseCurrentBlob();

		this.containerEl.empty();
		this.containerEl.removeClass(
			'proton-drive-embed-placeholder',
			'proton-drive-embed-loading',
		);
		this.containerEl.addClass(
			'proton-drive-embed',
			'proton-drive-embed-loading',
		);
		this.containerEl.setText('Loading from proton drive…');

		const result = await this.resolver.prepareEmbed(this.sourceUrl);
		if (generation !== this.loadGeneration) {
			this.releasePreparedBlob(result);
			return;
		}

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
					await this.renderDocument(result, generation);
				}
				break;

			case 'auth-required':
				this.containerEl.addClass('proton-drive-embed-placeholder');
				this.containerEl.createSpan({
					text: 'Sign in to proton drive to embed this file.',
				});
				this.addOpenLinkUnlessProtocol(result.sourceUrl, 'Open link');
				break;

			case 'unsupported':
				this.containerEl.addClass('proton-drive-embed-placeholder');
				this.containerEl.createSpan({ text: `${result.reason}.` });
				this.addOpenLinkUnlessProtocol(
					result.sourceUrl,
					result.fileName ?? 'Open in Proton drive',
				);
				break;
		}
	}

	private async renderDocument(
		result: Extract<
			Awaited<ReturnType<ProtonEmbedResolver['prepareEmbed']>>,
			{ status: 'ready'; mediaKind: 'document' }
		>,
		generation: number,
	): Promise<void> {
		if (generation !== this.loadGeneration) {
			this.releasePreparedBlob(result);
			return;
		}

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

	private addOpenLinkUnlessProtocol(sourceUrl: string, label: string): void {
		try {
			if (new URL(sourceUrl).protocol === PROTON_DRIVE_PROTOCOL) {
				return;
			}
		} catch {
			return;
		}
		this.containerEl.createSpan({ text: ' ' });
		this.containerEl.createEl('a', {
			cls: 'proton-drive-embed-link',
			text: label,
			href: sourceUrl,
		});
	}

	private releaseCurrentBlob(): void {
		if (this.blobUrl) {
			this.resolver.releaseBlobUrl(this.blobUrl);
			this.blobUrl = undefined;
		}
	}

	private releasePreparedBlob(
		result: Awaited<ReturnType<ProtonEmbedResolver['prepareEmbed']>>,
	): void {
		if (
			result.status === 'ready' &&
			'blobUrl' in result &&
			result.blobUrl
		) {
			this.resolver.releaseBlobUrl(result.blobUrl);
		}
	}

	onunload(): void {
		this.loadGeneration++;
		this.releaseCurrentBlob();
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
	driveService: DriveService,
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
			mountEmbed(
				element,
				embed,
				url,
				context,
				app,
				resolver,
				driveService,
			);
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
			mountEmbed(
				element,
				mountPoint,
				url,
				context,
				app,
				resolver,
				driveService,
			);
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
	driveService: DriveService,
): void {
	const container = root.createDiv({ cls: 'proton-drive-embed-host' });
	anchor.replaceWith(container);
	context.addChild(
		new ProtonDriveEmbed(
			container,
			app,
			url,
			context.sourcePath,
			resolver,
			driveService,
		),
	);
}
