// An Error that carries an HTTP status. The adapters return its message to the caller; an error without a status is a bug
// and becomes a logged, bare 500 (see respond() in core.js).
const fail = (status, message) => Object.assign(new Error(message), { status });
module.exports = { fail };
