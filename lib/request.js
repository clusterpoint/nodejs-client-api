// Node.js includes
var util = require('util');

// 3rd party includes
var builder = require('xmlbuilder');
var _ = require('lodash');

// Internal includes

var Request = exports.Request = function(command, requestId) {
    this.validTextParamNames = [
        'added_external_id', 'added_id', 'aggregate', 'alert_id', 'case_sensitive', 'count', 'cr', 
        'create_cursor', 'cursor_id', 'cursor_data', 'deleted_external_id', 'deleted_id', 'description', 
        'docs', 'exact-match', 'facet', 'facet_size', 'fail_if_exists', 'file', 'finalize', 'for', 'force', 
        'force_precise_results', 'force_segment', 'from', 'full', 'group', 'group_size', 'h', 'id', 'idif', 
        'iterator_id', 'len', 'message', 'offset', 'optimize_to', 'path', 'persistent', 'position', 'quota', 
        'rate2_ordering', 'rate_from', 'rate_to', 'relevance', 'return_doc', 'return_internal', 'sequence_check', 
        'sql', 'stem-lang', 'step_size', 'text', 'type'
    ];
    this.validRawParamNames = ['alert', 'query', 'list', 'ordering'];
    this.allowUnknownParams = false;
    this.textParams = {};
    this.rawParams = {};
    this.unknownParams = {};

    if (typeof command == 'object') {
        var o = command;
        this.command = o.command;
        this.requestId = o.requestId;
        for (var i in o) {
            if (_.contains(this.validTextParamNames, i) || _.contains(this.validRawParamNames, i)) {
                this.setParam(i, (typeof o[i] == 'object') ? convertToXml(o[i]) : o[i]);
            } else {
                // Add to unknown params
                this.unknownParams[i] = (typeof o[i] == 'object') ? convertToXml(o[i]) : o[i];
            }
        }
    } else {
        this.command = command;
        this.requestId = requestId;
        this.label = "";
        this.requestType = "auto";
    }
}

Request.prototype.getRequestXml = function(documentRootXpath, documentIdXpath, envelopeParams, createXML) {
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
                doc.ele("cps:" + i, envelopeParams[i][j]);
            } else {
                doc += "<cps:" + i + ">" + envelopeParams[i][j] + "</cps:" + i + ">";
            }
        }
    }
    if (createXML === true) {
        doc = doc.ele("cps:content");
    } else {
        doc += "<cps:content>";
    }
    for (var i in this.textParams) {
        for (var j in this.textParams[i]) {
            if (createXML === true) {
                doc.ele(i, this.textParams[i][j]);
            } else {
                doc += "<" + i + ">" + _.escape(this.textParams[i][j]) + "</" + i + ">";
            }
        }
    }
    for (var i in this.rawParams) {
        for (var j in this.rawParams[i]) {
            if (createXML === true) {
                doc.ele(i).raw(this.rawParams[i][j]);
            } else {
                doc += "<" + i + ">" + this.rawParams[i][j] + "</" + i + ">";
            }
        }
    }
    for (var i in this.unknownParams) {
        // Allow only document tags from unknown params
        if (!this.allowUnknownParams && i != documentRootXpath) continue;
        if (!Array.isArray(this.unknownParams[i])) this.unknownParams[i] = [this.unknownParams[i]];
        for (var j in this.unknownParams[i]) {
            if (createXML === true) {
                doc.ele(i).raw(this.unknownParams[i][j]);
            } else {
                doc += "<" + i + ">" + this.unknownParams[i][j] + "</" + i + ">";
            }
        }
    }
    for (var i in this.documents) {
        var d = this.documents[i];
        if (typeof d == 'string') {
            if (createXML === true) {
            } else {
                doc += d;
            }
        } else if (typeof d == 'object') {
            if (createXML === true) {
            } else {
                doc += d;
            }
        }
    }
    if (createXML === true) {
        doc = doc.end({pretty: true});
    } else {
        doc += "</cps:content></cps:request>";
    }
    return doc;
}

Request.prototype.setParam = function(key, values, replace) {
    var paramType = _.contains(this.validTextParamNames, key) ? "textParams" : (_.contains(this.validRawParamNames, key) ? "rawParams" : null);
    if (paramType === null) throw new Error("Invalid param name");
    replace = replace || false;
    if (!Array.isArray(values)) values = [values];
    if (replace || !this[paramType][key]) this[paramType][key] = [];
    for (var i in values) {            
        this[paramType][key].push(values[i]);
    }
}

var convertToXml = function(obj) {
    var res = '';
    for (var i in obj) {
        res += '<' + i + '>';
        if (typeof obj[i] == 'object') res += convertToXml(obj[i]);
        else res += obj[i];
        res += '</' + i + '>';
    }
    return res;
}