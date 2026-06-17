import { NodeEntity, NodeType, ProtonDriveClient } from '@protontech/drive-sdk';

import { DriveService } from '../drive-service';
import { downloadFileToArrayBuffer } from './download';
import {
	classifyEmbedMedia,
	EmbedMediaKind,
	getNodeDisplayName,
	mimeTypeForEmbed,
} from './media';
import { parseProtonDriveUrl, ParsedProtonDriveUrl } from '../url-parser';

export type EmbedFileInfo = {
	nodeUid: string;
	fileName: string;
	mediaType: string | undefined;
	mediaKind: EmbedMediaKind;
	sourceUrl: string;
};

export type PreparedEmbed =
	| {
			status: 'ready';
			mediaKind: 'image' | 'video';
			blobUrl: string;
			fileName: string;
			mediaType: string;
	  }
	| {
			status: 'unsupported';
			reason: string;
			fileName?: string;
			sourceUrl: string;
	  }
	| {
			status: 'document';
			fileName: string;
			sourceUrl: string;
	  }
	| {
			status: 'auth-required';
			sourceUrl: string;
	  };

type FileAccessClient = Pick<
	ProtonDriveClient,
	'getNode' | 'getFileDownloader'
>;

type PublicLinkClient = Awaited<
	ReturnType<ProtonDriveClient['experimental']['authPublicLink']>
>;

export class ProtonEmbedResolver {
	private readonly blobCache = new Map<string, Blob>();
	private readonly publicClients = new Map<string, PublicLinkClient>();

	constructor(private readonly driveService: DriveService) {}

	async prepareEmbed(sourceUrl: string): Promise<PreparedEmbed> {
		const parsed = parseProtonDriveUrl(sourceUrl);
		if (!parsed) {
			return {
				status: 'unsupported',
				reason: 'Unrecognized Proton drive link',
				sourceUrl,
			};
		}

		if (parsed.kind === 'share-folder') {
			return {
				status: 'unsupported',
				reason: 'Folders cannot be embedded',
				sourceUrl,
			};
		}

		if (!this.driveService.isLoggedIn()) {
			return { status: 'auth-required', sourceUrl };
		}

		try {
			const fileInfo = await this.resolveFileInfo(parsed);
			if (fileInfo.mediaKind === 'unsupported') {
				return {
					status: 'unsupported',
					reason: 'This file type cannot be embedded',
					fileName: fileInfo.fileName,
					sourceUrl,
				};
			}

			if (fileInfo.mediaKind === 'document') {
				return {
					status: 'document',
					fileName: fileInfo.fileName,
					sourceUrl,
				};
			}

			const blob = await this.getOrDownloadBlob(parsed, fileInfo);
			const blobUrl = URL.createObjectURL(blob);

			return {
				status: 'ready',
				mediaKind: fileInfo.mediaKind,
				blobUrl,
				fileName: fileInfo.fileName,
				mediaType: blob.type,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Failed to load file';
			return {
				status: 'unsupported',
				reason: message,
				sourceUrl,
			};
		}
	}

	releaseBlobUrl(blobUrl: string): void {
		URL.revokeObjectURL(blobUrl);
	}

	private async resolveFileInfo(
		parsed: ParsedProtonDriveUrl,
	): Promise<EmbedFileInfo> {
		const { client, nodeUid } = await this.getClientForLink(parsed);
		const node = await client.getNode(nodeUid);
		return this.toEmbedFileInfo(node, parsed.originalUrl);
	}

	private toEmbedFileInfo(
		node: NodeEntity,
		sourceUrl: string,
	): EmbedFileInfo {
		const fileName = getNodeDisplayName(node.name);
		const mediaKind = classifyEmbedMedia(
			node.mediaType,
			fileName,
			node.type,
		);

		if (node.type === NodeType.Folder) {
			return {
				nodeUid: node.uid,
				fileName,
				mediaType: node.mediaType,
				mediaKind: 'unsupported',
				sourceUrl,
			};
		}

		return {
			nodeUid: node.uid,
			fileName,
			mediaType: node.mediaType,
			mediaKind,
			sourceUrl,
		};
	}

	private async getOrDownloadBlob(
		parsed: ParsedProtonDriveUrl,
		fileInfo: EmbedFileInfo,
	): Promise<Blob> {
		const cached = this.blobCache.get(fileInfo.nodeUid);
		if (cached) {
			return cached;
		}

		const { client } = await this.getClientForLink(parsed);
		const downloader = await client.getFileDownloader(fileInfo.nodeUid);
		const data = await downloadFileToArrayBuffer(downloader);
		const mimeType =
			mimeTypeForEmbed(
				fileInfo.mediaKind,
				fileInfo.mediaType,
				fileInfo.fileName,
			) ?? 'application/octet-stream';

		const blob = new Blob([data], { type: mimeType });
		this.blobCache.set(fileInfo.nodeUid, blob);
		return blob;
	}

	private async getClientForLink(
		parsed: ParsedProtonDriveUrl,
	): Promise<{ client: FileAccessClient; nodeUid: string }> {
		const authClient = await this.driveService.getClient();

		if (parsed.kind === 'public-link') {
			const publicClient = await this.getPublicLinkClient(
				authClient,
				parsed.originalUrl,
			);
			const linkInfo = await authClient.experimental.getPublicLinkInfo(
				parsed.originalUrl,
			);

			if (linkInfo.directAccess?.nodeUid) {
				return {
					client: publicClient,
					nodeUid: linkInfo.directAccess.nodeUid,
				};
			}

			const root = await publicClient.getRootNode();
			return { client: publicClient, nodeUid: root.uid };
		}

		// SDK maps share URLs to node UIDs via shareId + nodeId.
		// eslint-disable-next-line @typescript-eslint/no-deprecated
		const nodeUid = await authClient.getNodeUid(
			parsed.shareId,
			parsed.nodeId,
		);
		return { client: authClient, nodeUid };
	}

	private async getPublicLinkClient(
		authClient: ProtonDriveClient,
		url: string,
	): Promise<PublicLinkClient> {
		const existing = this.publicClients.get(url);
		if (existing) {
			return existing;
		}

		const publicClient = await authClient.experimental.authPublicLink(
			url,
			undefined,
			true,
		);
		this.publicClients.set(url, publicClient);
		return publicClient;
	}
}
