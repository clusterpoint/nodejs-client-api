// Node.js includes
var util = require('util');

// 3rd party includes
var builder = require('xmlbuilder');
var _ = require('lodash');

// Internal includes
var Request = require('./request.js').Request;

var Term = exports.Term = function(term, xpath, escape) {
    escape = (typeof escape !== 'undefined') ? escape : true;
    var prefix = '', postfix = '';
    if (xpath) {
        var tags = xpath.split('/');
        for (var i in tags) {
            prefix += '<' + tags[i] + '>';
            postfix += '</' + tags[i] + '>';
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

var SearchRequest = exports.SearchRequest = function(query, offset, docs, list) {
    var self = this;
    if (typeof query == 'object') {
        Request.call(self, query);
    } else {
        Request.call(self, 'search');
    }

    this.setQuery = function(value) { 
        if (typeof value == 'string') self.setParam('query', value); 
        return this; 
    };
    this.setDocs = function(value) { 
        if (typeof value == 'number') self.setParam('docs', value); 
        return this;
    };
    this.setOffset = function(value) { 
        if (typeof value == 'number') self.setParam('offset', value); 
        return this; 
    };
    this.setFacet = function(value) { 
        if (typeof value == 'string') self.setParam('facet', value); 
        return this; 
    };
    this.setStemLang = function(value) { 
        if (typeof value == 'string') self.setParam('stem-lang', value); 
        return this; 
    };
    this.setExactMatch = function(value) { 
        if (typeof value == 'string') self.setParam('exact-match', value); 
        return this; 
    };
    this.setGroup = function(tagName, count) { 
        self.setParam('group', value); 
        self.setParam('group_size', count);
        return this; 
    };
    this.setList = function(list) {
        var listString = '';
        if (typeof list == 'string') {
            listString = list;
        } else if (typeof list == 'object') {
            for (var i in list) {
                listString += Term(list[i], i);
            }
        }
        if (listString) self.setParam('list', listString);
        return this;
    }
    this.setOrdering = function(value) { 
        if (typeof value == 'string') self.setParam('ordering', value); 
        return this; 
    };
    this.setAggregate = function(value) { 
        if (typeof value == 'string') self.setParam('aggregate', value); 
        return this; 
    };

    this.setQuery(query);
    this.setOffset(offset);
    this.setDocs(docs);
    if (list) this.setList(list);
}
util.inherits(SearchRequest, Request);

var SQLSearchRequest = exports.SQLSearchRequest = function(query) {
    var self = this;
    if (typeof query == 'object') {
        SearchRequest.call(self, query);
    } else {
        SearchRequest.call(self, 'search');
    }

    if (typeof query == 'sql') this.setParam('sql', query);
}
util.inherits(SQLSearchRequest, SearchRequest);