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

var xmlKeyRegExp = /((^[-\.\d])|(?:[:!"#$%&\\\'\(\)\\\*+,\/;<>=@?\[\]\^`\{\}\|~])|([^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]))/;
var xmlValRegExp = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/;

/**
* Escapes <, > and & characters in the given term for inclusion into XML (like the search query). Also wraps the term in XML tags if xpath is specified.
* Note that this function doesn't escape the @, $, " and other symbols that are meaningful in a search query. If You want to escape input that comes directly
* from the user and that isn't supposed to contain any search operators at all, it's probably better to use {@link QueryTerm}
* @function
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
 * Creates xml string from provided object. 
 * All keys will be tag names. Tag names specified with '/' seperator will be expanded to correct hierarchy.
 * All values that are string, number or boolean will be saved as a value of term
 * @function
 * @param {Object} obj    Object Term
 * @param {bool} escape Should values be escaped
 * @see  Term
 */
var ObjectTerm = exports.ObjectTerm = function(obj, escape) {
    escape = (typeof escape !== 'undefined') ? escape : true;
    var res = '';
    if (_.isPlainObject(obj)) {
        for (var i in obj) {
            if (_.isString(obj[i]) || _.isNumber(obj[i]) || _.isBoolean(obj[i])) {
                res += Term(obj[i], i, escape);
            } else if (_.isPlainObject(obj[i])) {
                res += Term(ObjectTerm(obj[i], escape), i, false);
            }
        }
    }
    return res;
}

/**
* Escapes <, > and & characters, as well as @"{}()=$~+ (search query operators) in the given term for inclusion into the search query.
* Also wraps the term in XML tags if xpath is specified.
* @function
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
* @function
* @see Request#setOrdering()
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default most relevant documents are returned first
*/
var RelevanceOrdering = exports.RelevanceOrdering = function(ascdesc) {
    return '<relevance>' + _.escape(ascdesc) + '</relevance>';
}

/**
* Returns an ordering string for sorting by a numeric field
* @function
* @see Request#setOrdering()
* @param {String} tag the xpath of the tag by which You wish to perform sorting
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var NumericOrdering = exports.NumericOrdering = function(tag, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return '<numeric>' + Term(ascdesc, tag) + '</numeric>';
}

/**
* Returns an ordering string for sorting by a date field
* @function
* @see Request#setOrdering()
* @param {String} tag the xpath of the tag by which You wish to perform sorting
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var DateOrdering = exports.DateOrdering = function(tag, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return '<date>' + Term(ascdesc, tag) + '</date>';
}

/**
* Returns an ordering string for sorting by a string field
* @function
* @see Request#setOrdering()
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
* @function
* @see Request#setOrdering()
* @param {Array} array an associative array with tag xpaths as keys and centerpoint coordinates as values. Should contain exactly two elements - latitude first and longitude second.
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var LatLonDistanceOrdering = exports.LatLonDistanceOrdering = function(array, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return GenericDistanceOrdering('latlong', array, ascdesc);
}

/**
* Returns an ordering string for sorting by distance from specified coordinates on a geometric plane
* @function
* @see Request#setOrdering()
* @param {Array} array an associative array with tag xpaths as keys and centerpoint coordinates as values.
* @param {String} ascdesc optional parameter to specify ascending/descending order. By default ascending order is used.
*/
var PlaneDistanceOrdering = exports.PlaneDistanceOrdering = function(array, ascdesc) {
    ascdesc = ascdesc || 'ascending';
    return GenericDistanceOrdering('plane', array, ascdesc);
}

/**
* Returns an polygon definition string from provided vertice points
* @function
* @param {String} name name of a shape, should be a valid xml name
* @param {Array} vertices array of vertice coordinates identifying polygon
*                         each element should contain array of two elements which correspond to vertice coordinates
* @param {String} tagName1 tag name of first coordinate (e.g. latitude), if not passed, then default configuration values will be used
* @param {String} tagName2 tag name of second coordinate (e.g. longitude), if not passed, then default configuration values will be used
* @param {String} coord_type coordinate type, either latlong or plane
*/
var PolygonDefinition = exports.PolygonDefinition = function(name, vertices, tagName1, tagName2, coord_type) {
    var res = '<' + name + '>';
    for (var i = 0; i < vertices.length; ++i) {
        res += vertices[i][0] + ' ' + vertices[i][1] + '; ';
    }
    if (tagName1) res += '<coord1_tag_name>' + tagName1 + '</coord1_tag_name>';
    if (tagName2) res += '<coord2_tag_name>' + tagName2 + '</coord2_tag_name>';
    if (coord_type) res += '<coord_type>' + coord_type + '</coord_type>';
    res += '</' + name + '>';
    return res;
}

/**
* Returns an circle definition string with provided center and radius
* @function
* @param {String} name name of a shape, should be a valid xml name
* @param {double[]} center array with two elements identifying center of circle
* @param {double|String} radius radius of circle with optional distance type (km/mi), default is km
* @param {String} tagName1 tag name of first coordinate (e.g. latitude), if not passed, then default configuration values will be used
* @param {String} tagName2 tag name of second coordinate (e.g. longitude), if not passed, then default configuration values will be used
* @param {String} coord_type coordinate type, either latlong or plane 
*/
var CircleDefinition = exports.CircleDefinition = function(name, center, radius, tagName1, tagName2, coord_type) {
    var res = '<' + name + '>';
    res += '<center>' + center[0] + ' ' + center[1] + '</center>';
    res += '<radius>' + radius + '</radius>';
    if (tagName1) res += '<coord1_tag_name>' + tagName1 + '</coord1_tag_name>';
    if (tagName2) res += '<coord2_tag_name>' + tagName2 + '</coord2_tag_name>';
    if (coord_type) res += '<coord_type>' + coord_type + '</coord_type>';
    res += '</' + name + '>';
    return res;
}

/**
 * Constructs an instance of the Request class
 * @class
 * @param {String} command Specifies the command field for the request
 * @param {String} requestId The request ID. Can be useful for identifying a particular request in a log file when debugging
 * @param {String} transactionId Transaction id if relevant
 */
var Request = exports.Request = function(command, requestId, transactionId) {
    /**
     * List of param names that can only contain text (no xml elements)
     * @type {string[]}
     * @readOnly
     */
    this.validTextParamNames = [
        'added_external_id', 'added_id', 'aggregate', 'alert_id', 'case_sensitive', 'count', 'cr', 
        'create_cursor', 'cursor_id', 'cursor_data', 'deleted_external_id', 'deleted_id', 'description', 
        'docs', 'exact-match', 'facet', 'facet_size', 'fail_if_exists', 'file', 'finalize', 'for', 'force', 
        'force_precise_results', 'force_segment', 'from', 'full', 'group', 'group_size', 'h', 'id', 'idif', 
        'iterator_id', 'len', 'message', 'offset', 'optimize_to', 'path', 'persistent', 'position', 'quota', 
        'rate2_ordering', 'rate_from', 'rate_to', 'relevance', 'return_doc', 'return_internal', 'sequence_check', 
        'sql', 'stem-lang', 'step_size', 'text', 'transaction_id', 'type'
    ];
    /**
     * List of param names that can contain xml values or whole xml trees
     * @type {string[]}
     * @readOnly
     */
    this.validRawParamNames = ['alert', 'query', 'list', 'ordering', 'shapes'];
    // 
    /**
     * Should unknown params be allowed. Set this to true if you want to send params that are not on the list
     * @type {Boolean}
     * @default [false]
     */
    this.allowUnknownParams = false;
    this.envelopeParams = {};
    this.textParams = {};
    this.rawParams = {};
    this.unknownParams = {};

    // If command is an object we assume it contains the all needed request variables already set
    if (_.isObject(command)) {
        var o = command;
        this.command = o.command;
        this.requestId = o.requestId;
        this.transactionId = o.transactionId;
        this.label = o.label || "";
        this.requestType = o.requestType || "auto";
        for (var i in o) {
            if (_.contains(this.validTextParamNames, i) || _.contains(this.validRawParamNames, i)) {
                this.setParam(i, (_.isObject(o[i])) ? ObjectToXml(o[i]) : o[i]);
            } else {
                // Add to unknown params
                this.unknownParams[i] = o[i];
            }
        }
    } else {
        this.command = command;
        this.requestId = requestId;
        this.transactionId = transactionId;
        /**
         * Label for cluster nodeset
         * @type {String}
         * @default ""
         */
        this.label = "";
        /**
         * Request type. Possible values: single, cluster, auto
         * @type {String}
         * @default "auto"
         */
        this.requestType = "auto";
    }
}

/**
 * Returns contents of the request as an XML string
 * @param  {String} documentRootXpath
 * @param  {String} documentIdXpath
 * @param  {String} envelopeParams params that should be padded with cps namespace (username, password, storage, etc.)
 * @param  {bool} createXML indicates if xml should be created & validated (slower) @default true
 * @param  {String} transactionId Transaction id if relevant
 * @return {String} XML string of request
 */
Request.prototype.getRequestXml = function(documentRootXpath, documentIdXpath, envelopeParams, createXML, transactionId) {
    var doc;
    if (createXML === true) {
        doc = builder.create("cps:request").att("xmlns:cps", "www.clusterpoint.com");
    } else {
        doc = "<cps:request xmlns:cps=\"www.clusterpoint.com\">";
    }
    envelopeParams.label = this.label;
    envelopeParams.type = this.requestType;
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
    transactionId = this.transactionId || transactionId; // Request transactionId overrites connection transactionId
    if (transactionId) {
        this.setParam('transaction_id', transactionId);
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

/**
 * Sets param for request
 * @param {String} key     Parameter name
 * @param {Array|Object} values  Parameter value(s)
 * @param {bool} replace Should new value replace old ones
 * @throws {Error} If invalid param name is passed
 * @see Request#validTextParamNames
 * @see Request#validRawParamNames
 */
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

/**
 * Sets document count to return
 * @param {int} value   Document count to return
 * @param {bool} replace Should previous value be replaced
 */
Request.prototype.setDocs = function(value, replace) { 
    if (_.isPositiveOrZero(value)) this.setParam('docs', value, replace); 
    return this;
}
/**
 * Sets offset
 * @param {int} value   Offset to return documents from
 * @param {bool} replace Should previous value be replaced
 */
Request.prototype.setOffset = function(value, replace) { 
    if (_.isPositiveOrZero(value)) this.setParam('offset', value, replace); 
    return this; 
}
/**
 * Sets query
 * String is a formatted xml string
 * Object will be converted to xml string using ObjectTerm helper function
 * @param {Object|String} value   Query object or string
 * @param {bool} replace Should previous query value be replaced
 * @see  ObjectTerm
 */
Request.prototype.setQuery = function(value, replace) {
    if (_.isPlainObject(value)) this.setParam('query', ObjectTerm(value), replace);
    else if (_.isString(value)) this.setParam('query', value, replace); 
    return this; 
}
/**
 * Sets facet paths
 * @param {String|String[]} value   a single path as a string or an array of paths
 * @param {bool} replace Should previous values be replaced
 */
Request.prototype.setFacet = function(value, replace) { 
    if (_.isArray(value)) {
        if (replace) this.setParam('facet', [], true); // Reset params if need replacing
        _.forEach(value, function(val) { this.setOrdering(val, replace); }, this);
    } else if (_.isString(value)) {
        this.setParam('facet', value, replace);
    }
    return this; 
}
/**
 * Sets stem-lang
 * @param {String} value   Stem language code (2-letter language ID)
 * @param {bool} replace Should previous value be replaced
 */
Request.prototype.setStemLang = function(value, replace) { 
    if (_.isString(value)) this.setParam('stem-lang', value, replace); 
    return this; 
}
/**
 * Sets exact-match
 * @param {String} value   binary or text
 * @param {bool} replace Should previous value be replaced
 */
Request.prototype.setExactMatch = function(value, replace) { 
    if (_.isString(value)) this.setParam('exact-match', value, replace); 
    return this; 
}
/**
 * Sets grouping sizes
 * @param {String} tagName Tag name of the group
 * @param {int} count   Number of results to return per group
 * @param {bool} replace Should previous value be replaced
 */
Request.prototype.setGroup = function(tagName, count, replace) { 
    if (_.isString(tagName) && _.isPositiveOrZero(count)) {
        this.setParam('group', value, replace); 
        this.setParam('group_size', count, replace);
    }
    return this; 
}
/**
 * Sets listing policy
 * Listing policy is:
 *  * String - already ready xml policy as xml string
 *  * Object - where key is tag name and value is listing type (yes, no, highligh, snippet). Nested paths should be provided as single string with '/'  seperating levels
 * @param {String|Object} list    Listing policy. 
 * @param {bool} replace Should previous listing policy be replaced
 */
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
/**
 * Sets ordering of results
 * @param {String|String[]} value   How should results be ordered (xml string)
 * @param {bool} replace Should previous set ordering be replaced
 */
Request.prototype.setOrdering = function(value, replace) { 
    if (_.isArray(value)) {
        if (replace) this.setParam('ordering', [], true); // Reset params if need replacing
        _.forEach(value, function(val) { this.setOrdering(val, replace); }, this);
    } else if (_.isString(value)) {
        this.setParam('ordering', value, replace);
    }
    return this; 
}
/**
 * Defines aggregation queries for the search request
 * @param {String|String[]} value   Aggregation query
 * @param {bool} replace Should previous aggregate query be replaced
 */
Request.prototype.setAggregate = function(value, replace) {
    if (_.isArray(value)) {
        if (replace) this.setParam('aggregate', [], true); // Reset params if need replacing
        _.forEach(value, function(val) { this.setAggregate(val, replace); }, this);
    } else if (_.isString(value)) {
        this.setParam('aggregate', value, replace);
    }
    return this; 
}
/**
* Minimum ratio between the occurrence of the alternative and the occurrence of the search term.
* If this parameter is increased, less results are returned while performance is improved.
* @param {double} value cr value
* @param {bool} replace Should previous set value be replaced
*/
Request.prototype.setCr = function(value, replace) { 
    if (_.isNumber(value)) this.setParam('cr', value, replace); 
    return this; 
}
/**
* A number that limits how much the alternative may differ from the search term,
* the greater the idif value, the greater the allowed difference.
* If this parameter is increased, more results are returned while performance is decreased.
* @param {double} value idif value
* @param {bool} replace Should previous set value be replaced
*/
Request.prototype.setIdif = function(value, replace) { 
    if (_.isNumber(value)) this.setParam('idif', value, replace); 
    return this; 
}
/**
* A number that limits the overall estimate of the quality of the alternative,
* the greater the cr value and the smaller the idif value, the greater the h value.
* If this parameter is increased, less results are returned while performance is improved.
* @param {double} value h value
* @param {bool} replace Should previous set value be replaced
*/
Request.prototype.setH = function(value, replace) { 
    if (_.isNumber(value)) this.setParam('h', value, replace); 
    return this; 
}
/**
 * Sets paths for listing
 * @param {String|String[]} value   A single facet path as string or an array of paths to list the facet terms from
 * @param {bool} replace Should previous set values be replaced
 */
Request.prototype.setPath = function(value, replace) { 
    if (_.isArray(value)) {
        if (replace) this.setParam('path', [], true); // Reset params if need replacing
        _.forEach(value, function(val) { this.setPath(val, replace); }, this);
    } else if (_.isString(value)) {
        this.setParam('path', value, replace);
    }
    return this; 
}
/**
 * Sets shape definition for geospatial search
 * @param {String|String[]} value   A single shape definition as string or array of string that define multiple shapes
 * @param {bool} replace Should previous set values be replaced
 */
Request.prototype.setShape = function(value, replace) { 
    if (_.isArray(value)) {
        if (replace) this.setParam('shapes', [], true); // Reset params if need replacing
        _.forEach(value, function(val) { this.setShape(val, replace); }, this);
    } else if (_.isString(value)) {
        this.setParam('shapes', value, replace);
    }
    return this; 
}

/**
 * Returns value as xml
 * @function
 * @param {Object|String|Boolean} val Object or string to return
 * @return {String} XML of value
 */
var ValueToXml = exports.ValueToXml = function(val, escape) {
    if (_.isObject(val)) return ObjectToXml(val);
    if (_.isBoolean(val)) return val ? "true" : "false";
    if (_.isDate(val)) return val.toString();
    return (escape) ? _.escape(val) : val;
}

/**
 * Returns values type that need to be added to xml
 * @function
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
 * @function
 * @param  {Object} obj
 * @return {String} object converted as XML
 */
var ObjectToXml = exports.ObjectToXml = function(obj) {
    if (!_.isObject(obj)) throw new TypeError('Passed content must be an object');
    var res = '';
    for (var key in obj) {
        var xml_key = key.replace(new RegExp(xmlKeyRegExp.source, 'g'), '_');
        if (xml_key != key) {
            key = '__' + xml_key + 'js:tagname="' + key + '"';
        }
        var value = obj[key];
        var type = GetValueType(value, key);

        if (_.isArray(value)) {
            if (_.isEmpty(value)) {
                res += '<' + key + type + '/>';
            } else {
                res += '<' + key + type + '>';
                res += ArrayToXml(value);
                res += '</' + key + type + '>';
            }
        } else {
            if (type && _.isPlainObject(value) && _.isEmpty(value)) {
                res += '<' + key + type + '/>';
            } else {
                if (_.isString(value) && value.match('/^\s+$/i')) {
                    value = '_' + value;
                    type += ' js:type="escaped"';
                }
                res += '<' + key + type + '>';
                res += ValueToXml(value, true);
                res += '</' + key + '>';
            }
        }
    }
    return res;
}

/**
 * Converts passed array to xml
 * @function
 * @param  {Array} arr
 * @return {String} array converted as XML
 */
var ArrayToXml = exports.ArrayToXml = function(arr) {
    if (!_.isArray(arr)) throw new TypeError('Passed content must be an array');
    var res = '';
    var skey = 0;
    var l = arr.length;
    for (var i = 0; i < l; ++i) {
        type = GetValueType(arr[i], skey);
        if (_.isArray(arr[i])) {
            res += '<_' + skey + ' js:key="true"' + type + '>';
            res += ArrayToXml(arr[i]);
        } else if (_.isObject(arr[i])) {
            res += '<_' + skey + ' js:key="true"' + type + '>';
            res += ValueToXml(arr[i], true);
        } else {
            if (_.isString(arr[i]) && arr[i].match(/^\s+$/i) != null) {
                arr[i] = '_' + arr[i];
                type += ' js:type="escaped"';
            }
            res += '<_' + skey + type + '>';
            res += ValueToXml(arr[i], true);
        }
        res += '</_' + skey + '>';
        skey++;
    }
    return res;
}
