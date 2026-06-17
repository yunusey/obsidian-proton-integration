import { FileDownloader } from '@protontech/drive-sdk';

const DEFAULT_MAX_EMBED_BYTES = 100 * 1024 * 1024;

export async function downloadFileToArrayBuffer(
	downloader: FileDownloader,
	maxBytes = DEFAULT_MAX_EMBED_BYTES,
): Promise<ArrayBuffer> {
	const parts: Uint8Array[] = [];
	let totalBytes = 0;

	const stream = new WritableStream<Uint8Array>({
		write(chunk) {
			totalBytes += chunk.byteLength;
			if (totalBytes > maxBytes) {
				throw new Error(
					`File exceeds the ${formatBytes(maxBytes)} embed limit`,
				);
			}
			parts.push(chunk);
		},
	});

	const controller = downloader.downloadToStream(stream);
	await controller.completion();

	return concatUint8Arrays(parts).buffer as ArrayBuffer;
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
	const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.byteLength;
	}
	return result;
}

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `${Math.round(bytes / (1024 * 1024))} MB`;
	}
	return `${Math.round(bytes / 1024)} KB`;
}
