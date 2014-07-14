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

/**
* Escapes <, > and & characters in the given term for inclusion into XML (like the search query). Also wraps the term in XML tags if xpath is specified.
* Note that this function doesn't escape the @, $, " and other symbols that are meaningful in a search query. If You want to escape input that comes directly
* from the user and that isn't supposed to contain any search operators at all, it's probably better to use {@link QueryTerm}
* @param {String} term the term to be escaped (e.g. a search query term)
* @param {String} xpath an optional xpath, to be specified if the search term is to be searched under a specific xpath
* @param {bool} escape an optional parameter - whether to escape the term's XML
* @returns {String} Escaped term with wrapped tags
* @see QueryTerm
*/
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

/**
* Escapes <, > and & characters, as well as @"{}()=$~+ (search query operators) in the given term for inclusion into the search query.
* Also wraps the term in XML tags if xpath is specified.
* @param {String} term the term to be escaped (e.g. a search query term)
* @param {String} xpath an optional xpath, to be specified if the search term is to be searched under a specific xpath
* @param {String} allowed_symbols a string containing operator symbols that the user is allowed to use (e.g. ")
* @returns {String} Escaped query term with wrapped tags
* @see Term
*/
var QueryTerm = exports.QueryTerm = function(term, xpath, allowed_symbols) {
    var invalidSymbols = "@$\"=<>(){}!+".replace(new RegExp("[" + ((allowed_symbols) ? allowed_symbols : "") + "]", "g"), "");
    term = term.replace(new RegExp("[" + invalidSymbols + "]", "g"), "\\$&");
    return Term(term, xpath);
}

/**
* Returns an ordering string for sorting by relevance
* @see SearchRequest.setOrdering()
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default most relevant documents are returned first
*/
var RelevanceOrdering = exports.RelevanceOrdering = function(ascdesc) {
    return '<relevance>' + _.escape(ascdesc) + '</relevance>';
}

/**
* Returns an ordering string for sorting by a numeric field
* @see SearchRequest.setOrdering()
* @param {String} tag the xpath of the tag by which You wish to perform sorting
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var NumericOrdering = exports.NumericOrdering = function(tag, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return '<numeric>' + Term(ascdesc, tag) + '</numeric>';
}

/**
* Returns an ordering string for sorting by a date field
* @see SearchRequest.setOrdering()
* @param {String} tag the xpath of the tag by which You wish to perform sorting
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var DateOrdering = exports.DateOrdering = function(tag, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return '<date>' + Term(ascdesc, tag) + '</date>';
}

/**
* Returns an ordering string for sorting by a string field
* @see SearchRequest.setOrdering()
* @param {String} tag the xpath of the tag by which You wish to perform sorting
* @param {String} lang specifies the language (collation) to be used for ordering. E.g. "en"
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var StringOrdering = exports.StringOrdering = function(tag, lang, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return '<string>' + Term(ascdesc + ',' + lang, tag) + '</string>';
}

var GenericDistanceOrdering = function(type, array, ascdesc) {
    var res = '<distance type="' + type + '" order="' + ascdesc + '">';
    for (var path in array) {
        res += Term(array[path], path);
    }
    res += '</distance>';
    return res;
}

/**
* Returns an ordering string for sorting by distance from a latitude/longitude coordinate pair
* @see SearchRequest.setOrdering()
* @param {Array} array an associative array with tag xpaths as keys and centerpoint coordinates as values. Should contain exactly two elements - latitude first and longitude second.
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var LatLonDistanceOrdering = exports.LatLonDistanceOrdering = function(array, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return GenericDistanceOrdering('latlong', array, ascdesc);
}

/**
* Returns an ordering string for sorting by distance from specified coordinates on a geometric plane
* @see SearchRequest.setOrdering()
* @param {Array} array an associative array with tag xpaths as keys and centerpoint coordinates as values.
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var PlaneDistanceOrdering = exports.PlaneDistanceOrdering = function(array, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return GenericDistanceOrdering('plane', array, ascdesc);
}

/**
 * Constructs an instance of the Request class.
 * @param {String} command Specifies the command field for the request
 * @param {String} requestId The request ID. Can be useful for identifying a particular request in a log file when debugging
 */
var Request = exports.Request = function(command, requestId) {
    // List of param names that can only contain text (no xml elements)
    this.validTextParamNames = [
        'added_external_id', 'added_id', 'aggregate', 'alert_id', 'case_sensitive', 'count', 'cr', 
        'create_cursor', 'cursor_id', 'cursor_data', 'deleted_external_id', 'deleted_id', 'description', 
        'docs', 'exact-match', 'facet', 'facet_size', 'fail_if_exists', 'file', 'finalize', 'for', 'force', 
        'force_precise_results', 'force_segment', 'from', 'full', 'group', 'group_size', 'h', 'id', 'idif', 
        'iterator_id', 'len', 'message', 'offset', 'optimize_to', 'path', 'persistent', 'position', 'quota', 
        'rate2_ordering', 'rate_from', 'rate_to', 'relevance', 'return_doc', 'return_internal', 'sequence_check', 
        'sql', 'stem-lang', 'step_size', 'text', 'type'
    ];
    // List of param names that can contain xml values or whole xml trees
    this.validRawParamNames = ['alert', 'query', 'list', 'ordering'];
    // Should unknown params be allowed. Set this to true if you want to send params that are not on the list
    this.allowUnknownParams = false;
    this.textParams = {};
    this.rawParams = {};
    this.unknownParams = {};

    // If command is an object we assume it contains the all needed request variables already set
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

/**
 * Returns contents of the request as an XML string
 * @param  {String} documentRootXpath
 * @param  {String} documentIdXpath
 * @param  {String} envelopeParams params that should be padded with cps namespace (username, password, storage, etc.)
 * @param  {bool} createXML indicates if xml should be created & validated (slower) @default true
 * @return {String} XML string of request
 */
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
            // If value is just a string, if it is supposed to be an id, set appropiate wrap
            if (i == "_id" && _.isString(val)) {
                var tags = documentIdXpath.split('/');
                root = tags.shift();
                var prefix = '', postfix = '';
                for (var ti in tags) {
                    prefix += '<' + tags[ti] + '>';
                    postfix = '</' + tags[ti] + '>' + postfix;
                }
                val = prefix + val + postfix;
            } else if (_.isString(val)) {
                // Document is already passed as a parsed document string
                if (createXML === true) {
                    doc.raw(val);
                } else {
                    doc += val;
                }
                continue;
            } else {
                val = ObjectToXml(val);
            }
            if (createXML === true) {
                doc.ele(root).att("xmlns:js", "www.clusterpoint.com/wiki/XML_JSON_conversion").raw(val);
            } else {
                doc += "<" + root + " xmlns:js=\"www.clusterpoint.com/wiki/XML_JSON_conversion\">" + val + "</" + root + ">";
            }
        }
    }
    if (createXML === true) {
        doc = doc.end({pretty: false});
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
        _.forEach(value, this.setOrdering, this);
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

/**
 * Returns value as xml
 * @param {Object|String|Boolean} val Object or string to return
 * @return {String} XML of value
 */
var ValueToXml = exports.ValueToXml = function(val, escape) {
    if (_.isArray(val)) throw new TypeError("Multi-dimensional arrays are not supported");
    if (_.isPlainObject(val)) return ObjectToXml(val);
    if (_.isBoolean(val)) return val ? "true" : "false";
    if (_.isDate(val)) return val.toString();
    return (escape) ? _.escape(val) : val;
}

/**
 * Returns values type that need to be added to xml
 * @param {Any} value 
 * @param {String} key of an element
 * @return {String} xml attribute
 */
var GetValueType = exports.GetValueType = function(value, key) {
    var validType = false;
    var type = '';
    if (_.isObject(value)) {
        // Only add js:type to empty objects
        if (_.isEmpty(value)) type = ' js:type="object"';
        validType = true;
    }
    if (_.isArray(value)) {
        // Only add js:type to empty arrays
        if (_.isEmpty(value)) type = ' js:type="array"';
        validType = true;
    }
    if (_.isBoolean(value)) {
        type = ' js:type="boolean"';
        validType = true;
    }
    if (_.isDate(value)) {
        type = ' js:type="date"';
        validType = true;
    }
    if (_.isNull(value)) {
        type = ' js:type="null"';
        validType = true;
    }
    if (_.isNumber(value) && _.isFinite(value)) {
        type = ' js:type="number"';
        validType = true;
    }
    if (_.isString(value)) {
        if (_.isEmpty(value)) type = ' js:type="string"';
        //type = ' xml:space="preserve"';
        validType = true;
    }
    if (!validType) {
        // Skip undefined, functions, regexp and possibly unknown values
        throw new TypeError('"' + key + '" is of unsupported data type. (Base type: ' + (typeof value) + ')');
    }
    return type;
}

/**
 * Converts passed object to xml
 * @param  {Object} obj
 * @return {String} object converted as XML
 */
var ObjectToXml = exports.ObjectToXml = function(obj) {
    var res = '';
    for (var key in obj) {
        // Check if key is valid xml (see: http://www.w3.org/TR/xml/#NT-Name)
        // This is a reduced set to allow only ASCII characters (Might allow all set in future. change if needed)
        // Missing unicode: \u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd
        if (!key.match(/^[:a-zA-Z_][:a-zA-Z_\-.0-9]*$/)) {
            throw new SyntaxError('Invalid characters in tag name: ' + key);
        }
        var value = obj[key];
        var type = GetValueType(value, key);

        if (_.isArray(value)) {
            if (_.isEmpty(value)) {
                res += '<' + key + type + '/>';
            } else {
                for (var i in value) {
                    res += '<' + key + GetValueType(value[i], key) + '>';
                    res += ValueToXml(value[i], true);
                    res += '</' + key + '>';
                }
            }
        } else {
            if (type && _.isPlainObject(value) && _.isEmpty(value)) {
                res += '<' + key + type + '/>';
            } else {
                res += '<' + key + type + '>';
                res += ValueToXml(value, true);
                res += '</' + key + '>';
            }
        }
    }
    return res;
}