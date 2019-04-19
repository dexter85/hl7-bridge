hl7 = require("./hl7-server/index")
var { isFreePort } = require("node-port-check");
var bunyan = require("bunyan");
var Database = require("./Database.class");

module.exports = class Tester {
    constructor(testName, ipAddressSender, portSender, receivers, dataPath, socket) {
        this.db = new Database(testName, receivers, dataPath);
        this.testName = testName;
        this.ipAddressSender = ipAddressSender;
        this.portSender = portSender;
        this.hl7Parser = new hl7.Parser();
        this.socket = socket;
        this.receivers = receivers;
        this.log = bunyan.createLogger({ name: "Tester (" + testName + ")" });

        this.senderServer = hl7.Server.createTcpClient(ipAddressSender, portSender);
        this.log.info("Stating TCP client at:" + ipAddressSender + ":" + portSender);
        this.receiverServer = [];


        for (let index = 0; index < receivers.length; index++) {
            let receiverInfo = receivers[index];
            let receiver = hl7.tcp();

            receiver.start(receiverInfo.getPort());
            receiver.use((req, res, next) => {
                let port = req.server._connectionKey.split("::::")[1];

                this.log.info("Message received:'" + req.msg.log() + "'");
                this.socket.emit('receiver', { message: req.msg.log(), port: port });

                this.db.setMessageFromReceiver(req.msg.getId(), this.findColumnName(port), req.msg.log()).catch(error => {
                    this.log.error(error);
                });

                next();

            })
            receiver.use((req, res, next) => {

                let port = req.server._connectionKey.split("::::")[1];
                this.db.setAckFromReceiver(res.ack.getAckId(), this.findColumnName(port), res.ack.log()).catch(error => {
                    this.log.error(error);
                });

                this.log.info("Sending ack:'" + res.ack.log());

                next();
                res.end();
            })
            receiver.use((err, req, res, next) => {
                this.log.error(err);
                var msa = res.ack.getSegment('MSA');
                msa.editField(1, 'AR');
                res.ack.addSegment('ERR', err.message);
                res.end();
            });


            this.log.info("Server " + receiverInfo.getName() + " started on port: " + receiverInfo.getPort());
            this.receiverServer.push(receiver);
        }
    }

    findColumnName(port) {
        for (let index = 0; index < this.receivers.length; index++) {
            let receiverInfo = this.receivers[index];
            if (receiverInfo.getPort() == port) {
                return receiverInfo.getEscapeName();
            }
        }
    }

    sendMessage(message) {
        message = message.replace(/(\r\n|\n|\r)/gm, "\r");
        let hl7Message = this.hl7Parser.parse(message);

        this.log.info("Sending Message: '" + message + "'");


        this.db.addNewSenderMessage(hl7Message.getId(), message).catch(error => {
            this.log.error(error);
        });

        this.senderServer.send(hl7Message, (error, ack) => {

            if (error || typeof ack === 'undefined') {
                this.log.error(ack);
                this.log.error(error);
                this.socket.emit('message', 'errors....');
            }
            else {

                this.db.setAckFromSenderMessage(ack.getAckId(), ack.log()).catch(error => {
                    this.log.error(error);
                });

                this.socket.emit('sender-ack', { message: ack.log() });
            }
        });

    }

    stopReceivers() {
        for (let index = 0; index < this.receiverServer.length; index++) {
            this.receiverServer[index].stop();
        }
    }

}
