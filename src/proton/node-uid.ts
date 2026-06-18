const NODE_UID_SEPARATOR = '~';

export function parseNodeUid(nodeUid: string): {
	volumeId: string;
	nodeId: string;
} {
	const separatorIndex = nodeUid.indexOf(NODE_UID_SEPARATOR);
	if (separatorIndex <= 0 || separatorIndex === nodeUid.length - 1) {
		throw new Error('Invalid Proton node UID');
	}

	return {
		volumeId: nodeUid.slice(0, separatorIndex),
		nodeId: nodeUid.slice(separatorIndex + 1),
	};
}
