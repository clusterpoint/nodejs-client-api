// Node.js includes
var util = require('util');

// 3rd party includes
var builder = require('xmlbuilder');
var _ = require('lodash');

// Internal includes

// Extend lodash with few useful checks
_.isPositiveOrZero = function(value) {
    return _.isFinite(value) && value >= 0;
}

_.isInRange = function(value, min, max) {
    return _.isFinite(value) && value >= min && value <= max;
}

var Term = exports.Term = function(term, xpath, escape) {
    escape = (typeof escape !== 'undefined') ? escape : true;
    var prefix = '', postfix = '';
    if (xpath) {
        var tags = xpath.split('/');
        for (var i in tags) {
            prefix += '<' + tags[i] + '>';
            postfix = '</' + tags[i] + '>' + postfix;
        }
    }
    return prefix + ((escape) ? _.escape(term) : term) + postfix;
}

var QueryTerm = exports.QueryTerm = function(term, xpath, allowed_symbols) {
    var invalidSymbols = "@$\"=<>(){}!+".replace(new RegExp("[" + ((allowed_symbols) ? allowed_symbols : "") + "]", "g"), "");
    term = term.replace(new RegExp("[" + invalidSymbols + "]", "g"), "\\$&");
    return Term(term, xpath);
}

var RelevanceOrdering = exports.RelevanceOrdering = function(ascending) {
    return '<relevance>' + _.escape(ascending) + '</relevance>';
}

var NumericOrdering = exports.NumericOrdering = function(tag, ascending) {
    ascending = ascending || 'ascending';
    return '<numeric>' + Term(ascending, tag) + '</numeric>';
}

var DateOrdering = exports.DateOrdering = function(tag, ascending) {
    ascending = ascending || 'ascending';
    return '<date>' + Term(ascending, tag) + '</date>';
}

var StringOrdering = exports.StringOrdering = function(tag, lang, ascending) {
    ascending = ascending || 'ascending';
    return '<string>' + Term(ascending + ',' + lang, tag) + '</string>';
}

var GenericDistanceOrdering = function(type, array, ascending) {
    var res = '<distance type="' + type + '" order="' + ascending + '">';
    for (var path in array) {
        res += Term(array[path], path);
    }
    res += '</distance>';
    return res;
}

var LatLonDistanceOrdering = exports.LatLonDistanceOrdering = function(array, ascending) {
    ascending = ascending || 'ascending';
    return GenericDistanceOrdering('latlong', array, ascending);
}

var PlaneDistanceOrdering = exports.PlaneDistanceOrdering = function(array, ascending) {
    ascending = ascending || 'ascending';
    return GenericDistanceOrdering('plane', array, ascending);
}

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

    if (_.isObject(command)) {
        var o = command;
        this.command = o.command;
        this.requestId = o.requestId;
        for (var i in o) {
            if (_.contains(this.validTextParamNames, i) || _.contains(this.validRawParamNames, i)) {
                this.setParam(i, (_.isObject(o[i])) ? convertToXml(o[i]) : o[i]);
            } else {
                // Add to unknown params
                this.unknownParams[i] = o[i];
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
        if (!this.allowUnknownParams && (i != documentRootXpath && i != "_document" && i != "_id")) continue;
        // If we encounter default root tag (document), then try to change it to connection root tag
        var root = (i == "_document") ? documentRootXpath : i;
        if (!_.isArray(this.unknownParams[i])) this.unknownParams[i] = [this.unknownParams[i]];
        for (var j in this.unknownParams[i]) {
            var val = this.unknownParams[i][j];
            // If value is just a string, it is supposed to be an id, so set appropiate wrap
            if (i == "_id" && _.isString(val)) {
                var tags = documentIdXpath.split('/');
                root = tags.shift();
                var prefix = '', postfix = '';
                for (var ti in tags) {
                    prefix += '<' + tags[ti] + '>';
                    postfix = '</' + tags[ti] + '>' + postfix;
                }
                val = prefix + val + postfix;
            } else {
                val = convertToXml(val);
            }
            if (createXML === true) {
                doc.ele(root).raw(val);
            } else {
                doc += "<" + root + ">" + val + "</" + root + ">";
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
    if (!_.isArray(values)) values = [values];
    if (replace || !this[paramType][key]) this[paramType][key] = [];
    for (var i in values) {            
        this[paramType][key].push(values[i]);
    }
}

// setParam helper functions for various parameters
Request.prototype.setDocs = function(value, replace) { 
    if (_.isPositiveOrZero(value)) this.setParam('docs', value, replace); 
    return this;
}
Request.prototype.setOffset = function(value, replace) { 
    if (_.isPositiveOrZero(value)) this.setParam('offset', value, replace); 
    return this; 
}
Request.prototype.setQuery = function(value, replace) { 
    if (_.isString(value)) this.setParam('query', value, replace); 
    return this; 
}
Request.prototype.setFacet = function(value, replace) { 
    if (_.isString(value)) this.setParam('facet', value, replace); 
    return this; 
}
Request.prototype.setStemLang = function(value, replace) { 
    if (_.isString(value)) this.setParam('stem-lang', value, replace); 
    return this; 
}
Request.prototype.setExactMatch = function(value, replace) { 
    if (_.isString(value)) this.setParam('exact-match', value, replace); 
    return this; 
}
Request.prototype.setGroup = function(tagName, count, replace) { 
    if (_.isString(tagName) && _.isPositiveOrZero(count)) {
        this.setParam('group', value, replace); 
        this.setParam('group_size', count, replace);
    }
    return this; 
}
Request.prototype.setList = function(list, replace) {
    var listString = '';
    if (_.isString(list)) {
        listString = list;
    } else if (_.isPlainObject(list)) {
        for (var i in list) {
            listString += Term(list[i], i);
        }
    } else {
        // No other types are supported
    }
    if (listString) this.setParam('list', listString, replace);
    return this;
}
Request.prototype.setOrdering = function(value, replace) { 
    if (_.isArray(value)) {
        if (replace) this.setParam('ordering', [], true); // Reset params if need replacing
        _.forEach(value, this.setPath, this);
    } else if (_.isString(value)) {
        this.setParam('ordering', value, replace);
    }
    return this; 
}
Request.prototype.setAggregate = function(value, replace) { 
    if (_.isString(value)) this.setParam('aggregate', value, replace); 
    return this; 
}
Request.prototype.setCr = function(value, replace) { 
    if (_.isNumber(value)) this.setParam('cr', value, replace); 
    return this; 
}
Request.prototype.setIdif = function(value, replace) { 
    if (_.isNumber(value)) this.setParam('idif', value, replace); 
    return this; 
}
Request.prototype.setH = function(value, replace) { 
    if (_.isNumber(value)) this.setParam('h', value, replace); 
    return this; 
}
Request.prototype.setPath = function(value, replace) { 
    if (_.isArray(value)) {
        if (replace) this.setParam('path', [], true); // Reset params if need replacing
        _.forEach(value, this.setPath, this);
    } else if (_.isString(value)) {
        this.setParam('path', value, replace);
    }
    return this; 
}

var convertToXml = function(obj) {
    if (!_.isObject(obj)) return obj;
    var res = '';
    for (var i in obj) {
        res += '<' + i + '>';
        if (_.isObject(obj[i])) res += convertToXml(obj[i]);
        else res += obj[i];
        res += '</' + i + '>';
    }
    return res;
}