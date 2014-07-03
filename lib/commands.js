// Node.js includes
var util = require('util');

// 3rd party includes
var builder = require('xmlbuilder');
var _ = require('lodash');

// Internal includes
var Request = require('./request.js').Request;

var SearchRequest = exports.SearchRequest = function(query, offset, docs, list) {
    var self = this;
    if (_.isObject(query)) {
        query.command = query.command || 'search';
        Request.call(self, query);
    } else {
        Request.call(self, 'search');
    }

    self.setQuery(query);
    self.setOffset(offset);
    self.setDocs(docs);
    if (list) self.setList(list);
}
util.inherits(SearchRequest, Request);

var SQLSearchRequest = exports.SQLSearchRequest = function(query) {
    var self = this;
    if (_.isObject(query)) {
        query.command = query.command || 'search';
        SearchRequest.call(self, query);
    } else {
        SearchRequest.call(self, 'search');

        self.setParam('sql', query);
    }
}
util.inherits(SQLSearchRequest, SearchRequest);

var ModifyRequest = exports.ModifyRequest = function(command, documents) {
    var self = this;    
    Request.call(self, command);

    if (_.isObject(documents)) self.unknownParams['_document'] = documents;
}
util.inherits(ModifyRequest, Request);

var InsertRequest = exports.InsertRequest = function(documents) {
    var self = this;    
    ModifyRequest.call(self, 'insert', documents);
}
util.inherits(InsertRequest, ModifyRequest);

var UpdateRequest = exports.UpdateRequest = function(documents) {
    var self = this;    
    ModifyRequest.call(self, 'update', documents);
}
util.inherits(UpdateRequest, ModifyRequest);

var ReplaceRequest = exports.ReplaceRequest = function(documents) {
    var self = this;    
    ModifyRequest.call(self, 'replace', documents);
}
util.inherits(ReplaceRequest, ModifyRequest);

var PartialReplaceRequest = exports.PartialReplaceRequest = function(documents) {
    var self = this;
    ModifyRequest.call(self, 'partial-replace', documents);
}
util.inherits(PartialReplaceRequest, ModifyRequest);

var DeleteRequest = exports.DeleteRequest = function(ids) {
    var self = this;
    ModifyRequest.call(self, 'delete', ids);
}
util.inherits(DeleteRequest, ModifyRequest);

var AlternativesRequest = exports.AlternativesRequest = function(query, cr, idif, h) {
    var self = this;
    Request.call(self, 'alternatives');

    self.setQuery(query);
    self.setCr(cr);
    self.setIdif(idif);
    self.setH(h);
}
util.inherits(AlternativesRequest, Request);

var ListWordsRequest = exports.ListWordsRequest = function(query) {
    var self = this;
    Request.call(self, 'list-words');

    self.setQuery(query);
}
util.inherits(ListWordsRequest, Request);

var StatusRequest = exports.StatusRequest = function() {
    var self = this;
    Request.call(self, 'status');
}
util.inherits(StatusRequest, Request);

var RetrieveRequest = exports.RetrieveRequest = function(ids) {
    var self = this;
    Request.call(self, 'retrieve');

    if (_.isArray(ids) || _.isString(ids)) self.unknownParams['_id'] = ids;
}
util.inherits(RetrieveRequest, Request);

var LookupRequest = exports.LookupRequest = function(ids, list) {
    var self = this;
    Request.call(self, 'lookup');

    if (_.isArray(ids) || _.isString(ids)) self.unknownParams['_id'] = ids;
    self.setList(list);
}
util.inherits(LookupRequest, Request);

var ListLastRetrieveFirstRequest = exports.ListLastRetrieveFirstRequest = function(command, offset, docs, list) {
    var self = this;
    Request.call(self, command);

    self.setOffset(offset);
    self.setDocs(docs);
    if (list) self.setList(list);
}
util.inherits(ListLastRetrieveFirstRequest, Request);

var ListLastRequest = exports.ListLastRequest = function(list, offset, docs) {
    var self = this;
    ListLastRetrieveFirstRequest.call(self, 'list-last', offset, docs, list);
}
util.inherits(ListLastRequest, ListLastRetrieveFirstRequest);

var ListFirstRequest = exports.ListFirstRequest = function(list, offset, docs) {
    var self = this;
    ListLastRetrieveFirstRequest.call(self, 'list-first', offset, docs, list);
}
util.inherits(ListFirstRequest, ListLastRetrieveFirstRequest);

var RetrieveFirstRequest = exports.RetrieveFirstRequest = function(offset, docs) {
    var self = this;
    ListLastRetrieveFirstRequest.call(self, 'retrieve-last', offset, docs);
}
util.inherits(RetrieveFirstRequest, ListLastRetrieveFirstRequest);

var RetrieveFirstRequest = exports.RetrieveFirstRequest = function(offset, docs) {
    var self = this;
    ListLastRetrieveFirstRequest.call(self, 'retrieve-first', offset, docs);
}
util.inherits(RetrieveFirstRequest, ListLastRetrieveFirstRequest);

var SearchDeleteRequest = exports.SearchDeleteRequest = function(query) {
    var self = this;
    if (_.isObject(query)) {
        query.command = query.command || 'search-delete';
        Request.call(self, query);
    } else {
        Request.call(self, 'search-delete');

        self.setQuery(query);
    }
}
util.inherits(SearchDeleteRequest, Request);

var ListPathsRequest = exports.ListPathsRequest = function() {
    var self = this;
    Request.call(self, 'list-paths');
}
util.inherits(ListPathsRequest, Request);

var ListFacetsRequest = exports.ListFacetsRequest = function(paths) {
    var self = this;
    Request.call(self, 'list-paths');

    self.setPath(paths);
}
util.inherits(ListFacetsRequest, Request);

var SimilarDocumentsRequest = exports.SimilarDocumentsRequest = function(id, len, quota, offset, docs, query) {
    var self = this;
    if (_.isObject(id)) {
        id.command = id.command || 'similar';
        Request.call(self, query);
    } else {
        Request.call(self, 'similar');

        if (_.isString(id)) self.setParam('id', id);
        if (_.isNumber(len)) self.setParam('len', len);
        if (_.isNumber(quota)) self.setParam('quota', quota);
        self.setOffset(offset);
        self.setDocs(docs);
        self.setQuery(query);
    }
}
util.inherits(SimilarDocumentsRequest, Request);

var SimilarTextRequest = exports.SimilarTextRequest = function(text, len, quota, offset, docs, query) {
    var self = this;
    if (_.isObject(text)) {
        text.command = text.command || 'similar';
        Request.call(self, query);
    } else {
        Request.call(self, 'similar');

        if (_.isString(text)) self.setParam('text', text);
        if (_.isNumber(len)) self.setParam('len', len);
        if (_.isNumber(quota)) self.setParam('quota', quota);
        self.setOffset(offset);
        self.setDocs(docs);
        self.setQuery(query);
    }
}
util.inherits(SimilarTextRequest, Request);

var ShowHistoryRequest = exports.ShowHistoryRequest = function(ids, returnDocs) {
    var self = this;
    Request.call(self, 'show-history');

    if (_.isObject(ids)) self.unknownParams['document'] = ids;
    if (returnDocs) self.setParam('return_doc', 'yes');
}
util.inherits(ShowHistoryRequest, Request);