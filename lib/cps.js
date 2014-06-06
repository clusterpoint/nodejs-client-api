// Node.js includes
var net = require('net');
var url = require('url');

// 3rd party includes
var xml2js = require('xml2js');
var builder = require('xmlbuilder');

// Internal includes
var protobuf = require('./protobuf.js');

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
        frame = Buffer.concat([header(frame.length), frame]);

        var client = net.connect(this.connectionOptions, function() { // 'connect listener'
            client.write(frame);
        });
        client.on('data', function(data) {
            //console.log('Received data', data, data.toString());
            client.end();
            callback.apply(this, [data.toString()]);
        });
        client.on('end', function() { 
            //console.log('client disconnected'); 
        });
        client.on('error', function() { 
            //console.log('client error'); 
        });
    }
}

var Request = function(command, requestId) {
    this.command = command;
    this.requestId = requestId;
    this.label = "";
    this.requestType = "auto";

    this.params = {};

    this.getRequestXml = function(documentRootXpath, documentIdXpath, envelopeParams, createXML) {
        var doc;
        if (createXML === true) {
            doc = builder.create("cps:request").att("xmlns:cps", "www.clusterpoint.com");
        } else {
            doc = "<cps:request xmlns:cps=\"www.clusterpoint.com\">";
        }
        for (var i in envelopeParams) {
            if (!Array.isArray(envelopeParams[i])) envelopeParams[i] = [envelopeParams[i]];
            for (var j in envelopeParams[i]) {
                if (createXML === true) {
                    doc.ele("cps:" + i, envelopeParams[i][j]).up();
                } else {
                    doc += "<cps:" + i + ">" + envelopeParams[i][j] + "</cps:" + i + ">";
                }
            }
        }
        if (createXML === true) {
            doc.ele("cps:content");
        } else {
            doc += "<cps:content>";
        }
        for (var i in this.params) {
            for (var j in this.params[i]) {
                if (createXML === true) {
                    doc.ele(i, this.params[i][j]).up();
                } else {
                    doc += "<" + i + ">" + this.params[i][j] + "</" + i + ">";
                }
            }
        }
        if (createXML === true) {
            doc = doc.end();
        } else {
            doc += "</cps:content>";
        }
        return doc;
    }

    this.setParam = function(key, values, replace) {
        replace = replace || false;
        if (!Array.isArray(value)) values = [values];
        for (var i in values) {
            this.params[key].push(values[i]);
        }
    }
}

exports.Connection = Connection;

exports.Request = Request;