import { NodeType, Result } from '@protontech/drive-sdk';

export type EmbedMediaKind = 'image' | 'video' | 'document' | 'unsupported';

export type DocumentFormat = 'pdf' | 'markdown' | 'text';

const IMAGE_EXTENSIONS = new Set([
	'apng',
	'avif',
	'bmp',
	'gif',
	'heic',
	'heif',
	'jpeg',
	'jpg',
	'png',
	'svg',
	'webp',
	'tif',
	'tiff',
]);

const VIDEO_EXTENSIONS = new Set([
	'avi',
	'm4v',
	'mkv',
	'mov',
	'mp4',
	'mpeg',
	'mpg',
	'webm',
	'wmv',
]);

const DOCUMENT_EXTENSIONS = new Set(['pdf', 'txt', 'md', 'markdown']);

export function getNodeDisplayName(
	name: Result<string, unknown>,
): string {
	if (name.ok) {
		return name.value;
	}
	if (
		typeof name.error === 'object' &&
		name.error !== null &&
		'name' in name.error &&
		typeof name.error.name === 'string'
	) {
		return name.error.name;
	}
	return 'unknown';
}

export function classifyEmbedMedia(
	mediaType: string | undefined,
	fileName: string,
	nodeType: NodeType,
): EmbedMediaKind {
	if (nodeType !== NodeType.File && nodeType !== NodeType.Photo) {
		return 'unsupported';
	}

	const normalizedMediaType = mediaType?.toLowerCase() ?? '';
	if (normalizedMediaType.startsWith('image/')) {
		return 'image';
	}
	if (normalizedMediaType.startsWith('video/')) {
		return 'video';
	}
	if (
		normalizedMediaType === 'application/pdf' ||
		normalizedMediaType.startsWith('text/')
	) {
		return 'document';
	}

	const extension = fileName.includes('.')
		? fileName.split('.').pop()?.toLowerCase()
		: undefined;

	if (extension && IMAGE_EXTENSIONS.has(extension)) {
		return 'image';
	}
	if (extension && VIDEO_EXTENSIONS.has(extension)) {
		return 'video';
	}
	if (extension && DOCUMENT_EXTENSIONS.has(extension)) {
		return 'document';
	}

	return 'unsupported';
}

export function mimeTypeForEmbed(
	mediaKind: EmbedMediaKind,
	mediaType: string | undefined,
	fileName: string,
): string | undefined {
	if (mediaType) {
		return mediaType;
	}

	const extension = fileName.includes('.')
		? fileName.split('.').pop()?.toLowerCase()
		: undefined;
	if (!extension) {
		return undefined;
	}

	if (mediaKind === 'image') {
		if (extension === 'jpg') {
			return 'image/jpeg';
		}
		if (extension === 'svg') {
			return 'image/svg+xml';
		}
		return `image/${extension}`;
	}

	if (mediaKind === 'video') {
		if (extension === 'mov') {
			return 'video/quicktime';
		}
		return `video/${extension}`;
	}

	if (mediaKind === 'document') {
		if (extension === 'pdf') {
			return 'application/pdf';
		}
		if (extension === 'md' || extension === 'markdown') {
			return 'text/markdown';
		}
		if (extension === 'txt') {
			return 'text/plain';
		}
	}

	return undefined;
}

export function getDocumentFormat(
	mediaType: string | undefined,
	fileName: string,
): DocumentFormat | undefined {
	const normalizedMediaType = mediaType?.toLowerCase() ?? '';
	if (normalizedMediaType === 'application/pdf') {
		return 'pdf';
	}
	if (
		normalizedMediaType === 'text/markdown' ||
		normalizedMediaType === 'text/x-markdown'
	) {
		return 'markdown';
	}
	if (normalizedMediaType.startsWith('text/')) {
		return 'text';
	}

	const extension = fileName.includes('.')
		? fileName.split('.').pop()?.toLowerCase()
		: undefined;

	if (extension === 'pdf') {
		return 'pdf';
	}
	if (extension === 'md' || extension === 'markdown') {
		return 'markdown';
	}
	if (extension === 'txt') {
		return 'text';
	}

	return undefined;
}

export function maxBytesForEmbed(
	mediaKind: EmbedMediaKind,
	documentFormat?: DocumentFormat,
): number {
	const defaultMaxBytes = 100 * 1024 * 1024;
	const textMaxBytes = 2 * 1024 * 1024;

	if (mediaKind === 'document' && documentFormat !== 'pdf') {
		return textMaxBytes;
	}

	return defaultMaxBytes;
}
