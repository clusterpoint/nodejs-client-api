// Node.js includes
var net = require('net');
var tls = require('tls');
var url = require('url');
var fs = require('fs');

// 3rd party includes
var xml2js = require('xml2js');
var builder = require('xmlbuilder');
var _ = require('lodash');

// Internal includes
var protobuf = require('./protobuf.js');
var Reply = exports.Reply = require('./reply.js').Reply;
var Request = exports.Request = require('./request.js').Request;
var Commands = require('./commands');

/**
 * Connection class that allows sending requests to specific storage or cluster
 * @class
 * @param {String} connectionString in format: (unix|tcp|http)://(host|path)[:port][path]
 * @param {String} storageName
 * @param {String} username
 * @param {String} password
 * @param {String} documentRootXpath [Dafault = "document"]
 * @param {String} documentIdXpath [Default = "document/id"]
 * @param {Object} envelopeParams extra envelope parameters (these parameters will be prefixed with cps namespace) in format: key -> value
 *
 * @throws {Error} If invalid connection string is passed or required arguments are missing
 */
var Connection = exports.Connection = function(connectionString, storageName, username, password, documentRootXpath, documentIdXpath, envelopeParams) {
    if (arguments.length < 4) throw new Error("Missing required arguments");

    var connectionString = connectionString;
    var storageName = storageName;
    var username = username;
    var password = password;
    var documentRootXpath = documentRootXpath || "document";
    var documentIdXpath = documentIdXpath || "document/id";
    var extraEnvelopeParams = envelopeParams || {};
    var connectionOptions;
    var transactionId = undefined;
    var beginTransactionInProgress = false;
    
    this._freeClientSockets = []; // client sockets which are aviable for use
    this._bussyClientSockets = []; // client sockets which are busy handling a request
    this._setTransactionId = function(tid) { transactionId = tid;}

    this.createXML = true;

    // Parse connection string
    var parsedUrl = url.parse(connectionString);
    if (parsedUrl.protocol == null) {
        // Default connection
        // Use default cps install location and connect using unix socket
        connectionOptions = {
            path: "/usr/local/cps2/storages/" + this.storageName + "/storage.sock"
        };
    } else if (parsedUrl.protocol == "unix:") {
        // Connect using unix socket to provided path
        connectionOptions = {
            path: parsedUrl.path
        };
    } else if (parsedUrl.protocol == "tcp:") {
        // Connect using tcp protocol to provided host and port (default = 5550)
        connectionOptions = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 5550
        };
    } else if (parsedUrl.protocol == "tcps:") {
        if (parsedUrl.port == null) throw new Error("Invalid connection string");
        connectionOptions = {
            host: parsedUrl.hostname,
            port: parsedUrl.port,
            ssl: true,
            rejectUnauthorized: false,
            method: "STREAM_CRYPTO_METHOD_SSLv23_CLIENT"
        }
    } else if (parsedUrl.protocol == "http:") {
        // Connect using http protocol to provided path and port (default = 80)
        connectionOptions = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            url: parsedUrl.path
        };
    } else {
        // We do not support any other connection type
        throw new Error("Invalid connection string");
    }

    //this.connectionOptions.rejectUnauthorized = true;
    //this.connectionOptions.ca = fs.readFileSync("addtrustexternalcaroot.crt");

    // read only getters
    Object.defineProperty(this, 'connectionString', { value: connectionString });
    Object.defineProperty(this, 'storageName', { value: storageName });
    Object.defineProperty(this, 'username', { value: username });
    Object.defineProperty(this, 'password', { value: password });
    Object.defineProperty(this, 'documentRootXpath', { value: documentRootXpath });
    Object.defineProperty(this, 'documentIdXpath', { value: documentIdXpath });
    Object.defineProperty(this, 'extraEnvelopeParams', { value: extraEnvelopeParams });
    Object.defineProperty(this, 'connectionOptions', { value: connectionOptions });
    Object.defineProperty(this, 'transactionId', { get: function(){ return transactionId; } });
}

/**
 * Remove socket from _bussyClientSockets and put it in _freeClientSockets
 * @param  {net.Socket}   socket
 */
Connection.prototype._PutClientSocketForReuse = function (socket) {
    var idx = this._bussyClientSockets.indexOf(socket);
    if (idx == -1)
    {
        if (this.debug)
            console.log("can't find busy socket. This should not happen!");
    }
    else
        this._bussyClientSockets.splice(idx, 1);
    this._freeClientSockets.push(socket);
    //console.log("scoket added for reuse (" + this._freeClientSockets.length + "/" + (this._freeClientSockets.length + this._bussyClientSockets.length) + ")"); // todo: remove
}

/**
 * @callback requestCallback
 * @param {Error} error Error if any
 * @param {Reply} reply Reply instance
 */

/**
 * Sends provided request to 
 * @param  {Request | String}   request
 * @param  {requestCallback} callback that will be called when reqest recieves response
 * @param  {String}   format currently supported are 'xml' and 'json' (default)
 */
Connection.prototype.sendRequest = function (request, callback, format) {
    var self = this;

    if (self.beginTransactionInProgress)
        throw new Error("can't send requests while begin-transaction is in progress");

    format = format || 'json';
    // Envelope params that get sent with every request
    var ep = _.clone(self.extraEnvelopeParams);
    ep = _.assign(ep, {
        storage: [self.storageName],
        user: [self.username],
        password: [self.password],
        command: [request.command],
        response_format: format
    });
    if (self.application) ep.application = self.application;

    var message;
    if (request && request.getRequestXml) {
        // Get xml string from request object
        message = request.getRequestXml(self.documentRootXpath, self.documentIdXpath, ep, self.createXML, self.transactionId);
    } else if (_.isString(request)) {
        // If request is just string then it must be already formed xml, so just send that
        message = request;
    } else {
        callback(new Error("Invalid request type"));
        return;
    }
    if (self.debug) console.log("Request: ", message);

    if (request.command == "begin-transaction")
        self.beginTransactionInProgress = true;

    if (request.command == "commit-transaction" || request.command == "rollback-transaction") {
        self._setTransactionId(undefined);
    }

    var reply = null;
    var content_len = 0;
    var received = 0;

    var client;
    var networkTime;
    var connectionTime;

    var sendDataFn = function() { // 'connect listener'
		if (self.debug && connectionTime) {
			console.log('Database connection established in', (new Date().getTime() - connectionTime.getTime()) / 1000, 'seconds');
		}
        // Once we have connected send the message
        if (!self.connectionOptions.url) {
            /**
             * Creates header for clusterpoint messages
             * @param  {Integer} length
             * @return {Buffer}
             */
            function header(length) {
                var res = [0x09, 0x09, 0x00, 0x00];
                res.push((length & 0x000000FF) >> 0);
                res.push((length & 0x0000FF00) >> 8);
                res.push((length & 0x00FF0000) >> 16);
                res.push((length & 0xFF000000) >> 24);
                return new Buffer(res);
            }

            // This is socket message so we should send protobuf message
            var frame = Buffer.concat([protobuf.serializeString(1, message), protobuf.serializeString(2, self.storageName)]);
            frame = Buffer.concat([header(frame.length), frame], 8 + frame.length);
			if (self.debug) {
				console.log("Request: ", message);
				networkTime = new Date();
			}
            client.write(frame);
        } else {
            var header = "";
            header += "POST " + self.connectionOptions.url + " HTTP/1.0\r\n";
            header += "Host: " + self.connectionOptions.host + ":" + self.connectionOptions.port + "\r\n";
            header += "Content-Length: " + message.length + "\r\n";
            header += "Connection: close\r\n";
            header += "\r\n";
			if (self.debug) {
				console.log("Request: ", message);
				networkTime = new Date();
			}
            client.write(header);
            client.write(message);
        }
    }

    // Acquire socket
    if (self._freeClientSockets.length > 0) {
        if (self.debug) 
            console.log("Reusing database connection");     
        client = self._freeClientSockets.pop();
        sendDataFn();
    } else {
        // Create new connection
        if (self.debug) 
            console.log("Establishing new database connection (" + (1+self._bussyClientSockets.length) + " busy connections)...");     
        connectionTime = new Date();
        if (self.connectionOptions.ssl == true)
            client = tls.connect(self.connectionOptions, sendDataFn);
        else 
            client = net.connect(self.connectionOptions, sendDataFn);
        client.on('close', function(err) {
            var idx = self._bussyClientSockets.indexOf(client);
            if (idx != -1) {
                self._bussyClientSockets.splice(idx, 1);
            } else {
                idx = self._freeClientSockets.indexOf(client);
                if (idx != -1)
                    self._freeClientSockets.splice(idx, 1);
            }
        });
    }
    self._bussyClientSockets.push(client);

    // Socket callbacks
    client.removeAllListeners('data');
    client.on('data', function(data) {
        if (!reply) {
            if (!self.connectionOptions.url) {
                // Validating socket response (should be header bytes, if not return error)
                if (data[0] != 0x09 || data[1] != 0x09 || data[2] != 0x00 || data[3] != 0x00) {
                    client.end();
                    callback(new Error("Invalid header received"), null);
                    if (self.beginTransactionInProgress && request.command == "begin-transaction")
                        self.beginTransactionInProgress = false;
                    return;
                }
                content_len = (data[4]) | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
                reply = data.slice(8);
                received = reply.length;
            } else {
                // Read HTTP response
                reply = data.toString();
                // Get content length
                var matches = reply.match(/Content-Length: (\d+)\r\n\r\n/);
                if (matches && matches[1]) content_len = matches[1];
                var loc = reply.indexOf("\r\n\r\n");
                if (loc != -1) {
                    // Response data found
                    reply = new Buffer(reply.substr(loc + 4));
                    received = reply.length;
                } else {
                    // No data yet. We still need to read headers
                    reply = null;
                }
            }
        } else {
            reply = Buffer.concat([reply, data], reply.length + data.length);
            received += data.length;
        }
        if (received > content_len) {
            // Currently not supporting multiple messages inside single connection
            received = content_len;
            // TODO: Received more data than wanted
        }
        if (received != 0 && received == content_len) {
            if (self.debug) {
                console.log('Network and query seconds:', (new Date().getTime() - networkTime.getTime()) / 1000);
            }
            self._PutClientSocketForReuse(client);
            var callbackWrapper = (request.command != "begin-transaction") ? callback : function(err, reply) {
                self.beginTransactionInProgress = false;
                self._setTransactionId((reply.getParam('transaction_id', undefined)));
                callback(err, reply);
            };
            if (!self.connectionOptions.url) {
                var protobuf_reply = protobuf.parseString(reply);
                if (self.debug) console.log("Reply: " + protobuf_reply[1]);
                new Reply(protobuf_reply[1], callbackWrapper, format);
            } else {
                if (self.debug) console.log("Reply: " + reply);
                new Reply(reply.toString(), callbackWrapper, format);
            }
        }
    });
    client.removeAllListeners('end');
    client.on('end', function() { 
        if (received != content_len) callback(new Error("Could not read message"), null);
        if (received == 0) callback(new Error("No data received"));
        client.end();
        var idx = self._freeClientSockets.indexOf(client);
        if (idx != -1)
            self._freeClientSockets.splice(idx, 1);
    });
    client.removeAllListeners('error');
    client.on('error', function(err) {
        callback(err, null);
    });
}
