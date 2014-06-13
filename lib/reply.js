// Node.js includes
var util = require('util');

// 3rd party includes
var xml2js = require('xml2js');
var _ = require('lodash');

// Internal includes

var Reply = exports.Reply = function(data, callback, format) {
    var self = this;
    var mergeResponseIntoObject = function(err, res) {
        if (err) return callback(err);
        self._rawResponse = res;
        if (!res || !res['cps:reply']) return callback(new Error("Invalid reply"));
        self.seconds = res['cps:reply']['cps:seconds'];
        if (res['cps:reply']['cps:content']) {
            var content = res['cps:reply']['cps:content'];
            self.hits = content.hits;
            self = _.merge(self, content);
        }

        callback(null, self);
    };

    if (format == 'xml') {
        xml2js.parseString(data, {explicitArray: false}, mergeResponseIntoObject);
    } else if (format == 'json') {
        try {
            mergeResponseIntoObject(null, JSON.parse(data));
        } catch (e) {
            callback(e);
        }
    }
}

Reply.prototype.getParam = function(key, defaultValue) {
    if (this[key]) return this[key];
    if (defaultValue === null || defaultValue === undefined) throw new Error("Invalid response parameter");
    return defaultValue;
}