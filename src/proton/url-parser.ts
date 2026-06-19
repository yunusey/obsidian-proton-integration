const PROTON_DRIVE_HOST = 'drive.proton.me';
export const PROTON_DRIVE_PROTOCOL = 'proton-drive:';

const SHARE_FILE_PATTERN =
	/drive\.proton\.me(?:\/u\/\d+)?\/([^/]+)\/file\/([^/?#]+)/i;
const SHARE_FOLDER_PATTERN =
	/drive\.proton\.me(?:\/u\/\d+)?\/([^/]+)\/folder\/([^/?#]+)/i;
const PUBLIC_LINK_PATTERN =
	/drive\.proton\.me\/urls\/([^/#?]+)#([^?]*)/i;

export type ParsedShareFileUrl = {
	kind: 'share-file';
	shareId: string;
	nodeId: string;
	originalUrl: string;
};

export type ParsedShareFolderUrl = {
	kind: 'share-folder';
	shareId: string;
	nodeId: string;
	originalUrl: string;
};

export type ParsedPublicLinkUrl = {
	kind: 'public-link';
	token: string;
	password: string;
	originalUrl: string;
};

export type ParsedNodeUidUrl = {
	kind: 'node-uid';
	nodeUid: string;
	originalUrl: string;
};

export type ParsedProtonDriveUrl =
	| ParsedShareFileUrl
	| ParsedShareFolderUrl
	| ParsedPublicLinkUrl
	| ParsedNodeUidUrl;

export function isProtonDriveUrl(url: string): boolean {
	return parseProtonDriveUrl(url) !== null;
}

export function formatProtonDriveNodeUrl(nodeUid: string): string {
	return `proton-drive://${nodeUid}`;
}

export function parseProtonDriveUrl(url: string): ParsedProtonDriveUrl | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	if (parsed.protocol === PROTON_DRIVE_PROTOCOL) {
		return parseProtonDriveProtocolUrl(parsed);
	}

	if (parsed.hostname !== PROTON_DRIVE_HOST) {
		return null;
	}

	const href = parsed.href;

	const publicMatch = href.match(PUBLIC_LINK_PATTERN);
	if (publicMatch?.[1]) {
		return {
			kind: 'public-link',
			token: publicMatch[1],
			password: publicMatch[2] ?? '',
			originalUrl: href,
		};
	}

	const fileMatch = href.match(SHARE_FILE_PATTERN);
	if (fileMatch?.[1] && fileMatch[2]) {
		return {
			kind: 'share-file',
			shareId: fileMatch[1],
			nodeId: fileMatch[2],
			originalUrl: href,
		};
	}

	const folderMatch = href.match(SHARE_FOLDER_PATTERN);
	if (folderMatch?.[1] && folderMatch[2]) {
		return {
			kind: 'share-folder',
			shareId: folderMatch[1],
			nodeId: folderMatch[2],
			originalUrl: href,
		};
	}

	return null;
}

function parseProtonDriveProtocolUrl(parsed: URL): ParsedNodeUidUrl | null {
	const pathSegments = parsed.pathname.split('/').filter(Boolean);
	const nodeUid = parsed.hostname || pathSegments[0];
	if (!nodeUid) {
		return null;
	}

	let decoded: string;
	try {
		decoded = decodeURIComponent(nodeUid);
	} catch {
		return null;
	}

	return {
		kind: 'node-uid',
		nodeUid: decoded,
		originalUrl: parsed.href,
	};
}
