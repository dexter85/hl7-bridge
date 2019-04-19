var slugify = require('slugify')

module.exports = class Receiver {
    constructor(name, port) {
        this.name = name;
        this.port = port;
        this.escapeName = slugify(name, {
            replacement: '_',
            remove: null,
            lower: true
        });
    }

    getName() {
        return this.name;
    }

    getPort() {
        return this.port;
    }

    getEscapeName() {
        return this.escapeName;
    }
};