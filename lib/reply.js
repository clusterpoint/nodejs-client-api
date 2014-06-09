// Node.js includes
var util = require('util');

// 3rd party includes
var xml2js = require('xml2js');

// Internal includes

var Reply = exports.Reply = function(data, callback) {
    var self = this;
    xml2js.parseString(data, function(err, res) {
        if (err) return callback(err, null);
        console.log(util.inspect(res, false, null));
    });
}