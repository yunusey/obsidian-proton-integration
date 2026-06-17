export function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(
				signal.reason instanceof Error
					? signal.reason
					: new Error('Aborted'),
			);
			return;
		}

		const timeout = window.setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);

		const onAbort = () => {
			window.clearTimeout(timeout);
			reject(
				signal?.reason instanceof Error
					? signal.reason
					: new Error('Aborted'),
			);
		};

		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
