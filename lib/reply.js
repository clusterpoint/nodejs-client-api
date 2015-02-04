// Node.js includes
var util = require('util');

// 3rd party includes
var xml2js = require('xml2js');
var _ = require('lodash');

// Internal includes

/**
 * Reply class
 * @class
 * @param {String}   data Data received from Clusterpoint
 * @param {requestCallback} callback that gets called when data is correctly parsed callback(err, this)
 * @param {String}   format of data. Currently supported 'xml', 'json'
 */
var Reply = exports.Reply = function(data, callback, format) {
    var self = this;
    // Merges response content into objects variables, so it can be easily accessible
    var mergeResponseIntoObject = function(err, res) {
        if (err) return callback(err);
        self._rawResponse = res;
        if (!res || !res['cps:reply']) return callback(new Error("Invalid reply"));
        self.seconds = res['cps:reply']['cps:seconds'];
        if (res['cps:reply']['cps:content']) {
            var content = res['cps:reply']['cps:content'];
            self = _.merge(self, content);
        }

        callback(res['cps:reply']['cps:error'], self);
    };

    if (format == 'xml' || data.indexOf("<?xml") === 0) {
        // Test for xml even if we requested json
        xml2js.parseString(data, {explicitArray: false}, mergeResponseIntoObject);
    } else if (format == 'json') {
        try {
            mergeResponseIntoObject(null, JSON.parse(data));
        } catch (e) {
            callback(e);
        }
    }
}

/**
 * Gets paramater from reply
 * @param  {String} key
 * @param  {Any} defaultValue value to return if key is not found
 * @return {Any}
 * @throws {Error} If default value is not provided and param is not present
 */
Reply.prototype.getParam = function(key, defaultValue) {
    if (this[key]) return this[key];
    if (defaultValue === null || defaultValue === undefined) throw new Error("Invalid response parameter");
    return defaultValue;
}