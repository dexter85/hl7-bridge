var express = require('express');
var bunyan = require("bunyan");

var exphbs = require('express-handlebars');
var bodyParser = require('body-parser')
var Tester = require("./models/Tester.class");
var Receiver = require("./models/Receiver.class");




var app = express();
var log = bunyan.createLogger({ name: "Server" });
var mTester = null;



var http = require('http');
var fs = require('fs');

var socketServer = http.createServer(function (req, res) {
    fs.readFile(__dirname + "/public/static/socket_index.html", 'utf-8', function (error, content) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
    });
});

var io = require('socket.io').listen(socketServer);
io.sockets.on('connection', function (socket) {
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.use('/static', express.static('public'));

app.get("/", function (req, res) {
    res.render("home")
});

app.post("/testing", function (req, res) {
    let reqBody = req.body;
    let receivers = [];

    for (let index = 0; index < reqBody.receiverName.length; index++) {
        receivers.push(new Receiver(reqBody.receiverName[index], reqBody.receiverPort[index]));
    }

    if (mTester != null) {
        mTester.stopReceivers();
        delete mTester;
        mTester = null;
    }

    mTester = new Tester(reqBody.testName, reqBody.senderIpAddress, reqBody.senderPort, receivers, __dirname + "/data/", io);
    res.render("testing", { postValue: reqBody, receivers: receivers });
});

app.post("/send-message", function (req, res) {
    let hl7Message = req.body.hl7Message;
    mTester.sendMessage(hl7Message);

});


app.listen(3000, function () {
    log.info('Server up: http://localhost:3000');
});

socketServer.listen(3001, function () {
    log.info('Server socket up: 3001 port');
});