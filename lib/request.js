// Node.js includes
var util = require('util');

// 3rd party includes
var xml2js = require('xmlbuilder');

// Internal includes

var Request = exports.Request = function(command, requestId) {
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