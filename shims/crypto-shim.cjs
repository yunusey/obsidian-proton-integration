function randomBytes(len) {
	const bytes = new Uint8Array(len);
	crypto.getRandomValues(bytes);
	return bytes;
}

module.exports = { randomBytes };
module.exports.default = module.exports;
