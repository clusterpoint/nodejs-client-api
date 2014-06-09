// Node.js includes
var net = require('net');
var url = require('url');

// 3rd party includes
var xml2js = require('xml2js');
var builder = require('xmlbuilder');

// Internal includes
var protobuf = require('./protobuf.js');
var Reply = require('./reply.js').Reply;
var Request = require('./request.js').Request;

function header(length) {
    var res = [0x09, 0x09, 0x00, 0x00];
    res.push((length & 0x000000FF) >> 0);
    res.push((length & 0x0000FF00) >> 8);
    res.push((length & 0x00FF0000) >> 16);
    res.push((length & 0xFF000000) >> 24);
    return new Buffer(res);
}

var Connection = function(connectionString, storageName, username, password, documentRootXpath, documentIdXpath) {
    this.connectionString = connectionString;
    this.storageName = storageName;
    this.username = username;
    this.password = password;
    this.documentRootXpath = documentRootXpath || "document";
    this.documentRootXpath = documentIdXpath || "document/id";

    this.createXML = true;

    // Parse connection string
    var parsedUrl = url.parse(connectionString);
    if (parsedUrl.protocol == null) {
        // Default connection
        this.connectionOptions = {
            path: "/usr/local/cps2/storages/" + this.storageName + "/storage.sock"
        };
    } else if (parsedUrl.protocol == "unix:") {
        this.connectionOptions = {
            path: parsedUrl.path
        };
    } else if (parsedUrl.protocol == "tcp:") {
        this.connectionOptions = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 5550
        };
    } else if (parsedUrl.protocol == "http:") {
        this.connectionOptions = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            url: parsedUrl.path
        };
    } else {
    }

    this.sendRequest = function (request, callback) {
        // Envelope params
        var ep = {
            storage: [this.storageName],
            user: [this.username],
            password: [this.password],
            command: [request.command]
        };

        var message = request.getRequestXml(this.documentRootXpath, this.documentIdXpath, ep, this.createXML);
        if (this.debug) console.log("Request: ", message);

        var frame = Buffer.concat([protobuf.serializeString(1, message), protobuf.serializeString(2, this.storageName)]);
        frame = Buffer.concat([header(frame.length), frame], 8 + frame.length);

        var reply = null;
        var content_len = 0;
        var received = 0;

        var client = net.connect(this.connectionOptions, function() { // 'connect listener'
            client.write(frame);
        });
        client.on('data', function(data) {
            //console.log('Received data', data, data.toString());
            if (!reply) {
                if (data[0] != 0x09 || data[1] != 0x09 || data[2] != 0x00 || data[3] != 0x00) {
                    client.end();
                    callback(new Error("Invalid header received"), null);
                    return;
                }
                content_len = (data[4]) | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
                reply = data.slice(8);
                received = reply.length;
            } else {
                reply = Buffer.concat([reply, data], reply.length + data.length);
                received += data.length;
            }
            if (received == content_len) {
                client.end();
                var parsed_reply = protobuf.parseString(reply);
                new Reply(parsed_reply[1], callback);
            }
        });
        client.on('end', function() { 
            if (received != content_len) callback(new Error("Could not read message"), null);
        });
        client.on('error', function(err) { 
            callback(err, null);
        });
    }
}

exports.Connection = Connection;

exports.Request = Request;