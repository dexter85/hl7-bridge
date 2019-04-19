var fx = require('mkdir-recursive');
var bunyan = require("bunyan");
const sqlite3 = require('sqlite3')
var slugify = require('slugify')



module.exports = class Database {
    constructor(databaseName, receivers, dataPath) {
        databaseName = slugify(databaseName, {
            replacement: '_',
            remove: null,
            lower: true
        });

        let databasePath = dataPath + "/database-" + databaseName + ".sqlite";
        this.log = bunyan.createLogger({ name: "Database (" + databaseName + ")" });
        this.tableName = "testing_" + databaseName;

        let receiversSql = "";
        receivers.forEach(function (receiver) {
            receiversSql += "`" + receiver.getEscapeName() + "_msg` TEXT, `" + receiver.getEscapeName() + "_ack` TEXT, ";
        });


        fx.mkdir(dataPath, (err) => {
            if (err) {
                this.log.error("Problem creating data folder");
                process.exit;
            }
            else {
                this.log.info("Database folder is ok");
                this.database = new sqlite3.Database(databasePath, (err) => {
                    if (err) {
                        this.log.error('Could not connect to database', err);
                    } else {
                        this.log.info('Connected to database');
                        this.database.run("CREATE TABLE IF NOT EXISTS `" + this.tableName + "`(`id` TEXT NOT NULL PRIMARY KEY, `sender_msg` TEXT NOT NULL, `sender_ack` TEXT, " + receiversSql + " `createdAt` NUMERIC, `updatedAt` NUMERIC);", error => {
                            if (error)
                                throw error;
                            this.database.run("CREATE TRIGGER IF NOT EXISTS `" + this.tableName + "_tgr_ai` AFTER INSERT ON `" + this.tableName + "` BEGIN UPDATE " + this.tableName + " SET createdAt = DATETIME('NOW'), updatedAt = DATETIME('NOW') WHERE id = new.id; END;", error => {
                                if (error)
                                    throw error;
                            });
                            this.database.run("CREATE TRIGGER IF NOT EXISTS `" + this.tableName + "_tgr_au` AFTER UPDATE ON `" + this.tableName + "` BEGIN UPDATE " + this.tableName + " SET updatedAt = DATETIME('NOW') WHERE id = new.id; END;", error => {
                                if (error)
                                    throw error;
                            });
                        });
                    }
                })
            }
        });
    }

    addNewSenderMessage(messageId, message) {
        return new Promise((resolve, reject) => {
            this.database.run("INSERT INTO `" + this.tableName + "` (id, sender_msg) VALUES (?, ?)", [messageId, message], (error) => {
                if (error) {
                    reject(error);
                }
                resolve(true);
            });
        });
    }

    setAckFromSenderMessage(messageId, ack) {
        return new Promise((resolve, reject) => {
            this.database.run("UPDATE `" + this.tableName + "` SET sender_ack = ? WHERE id = ?;", [ack, messageId], (error) => {
                if (error) {
                    reject(error);
                }
                resolve(true);
            });
        });
    }
    setAckFromReceiver(messageId, columnName, ack) {
        return new Promise((resolve, reject) => {
            this.database.run("UPDATE `" + this.tableName + "` SET " + columnName + "_ack = ? WHERE id = ?;", [ack, messageId], (error) => {
                if (error) {
                    reject(error);
                }
                resolve(true);
            });
        });
    }

    setMessageFromReceiver(messageId, columnName, ack) {
        return new Promise((resolve, reject) => {
            this.database.run("UPDATE `" + this.tableName + "` SET " + columnName + "_msg = ? WHERE id = ?;", [ack, messageId], (error) => {
                if (error) {
                    reject(error);
                }
                resolve(true);
            });
        });
    }
}