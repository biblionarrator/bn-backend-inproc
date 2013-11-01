"use strict";
var fs = require('fs'),
    util = require('util'),
    Q = require('q');

function InprocBackend(config) {
    var self = this;
    var connect = Q.defer();
    var inproc = { files: { } };
    connect.resolve(true);

    this.connect = function () {
        return connect.promise;
    }

    this.wait = function (callback) {
        if (callback) {
            callback();
        } else {
            return connect.promise;
        }
    };

    this.get = function (col, keys, callback, options) {
        inproc[col] = inproc[col] || { };
        if (keys === '*') {
            callback(undefined, inproc[col]);
        } else if (util.isArray(keys)) {
            var results = { };
            keys.forEach(function (key) {
                results[key] = inproc[col][key];
            });
            callback(undefined, results);
        } else {
            callback(undefined, inproc[col][keys]);
        }
    }; 

    this.set = function (col, key, object, callback, options) {
        inproc[col] = inproc[col] || { };
        inproc[col][key] = object;
        if (options && options.expiration > 0) {
            setTimeout(function () {
                delete inproc[col][key];
            }, options.expiration * 1000);
        }
        if (typeof callback === 'function') callback(undefined, null);
    };

    this.del = function (model, key, callback) {
        delete inproc[col][key];
        if (typeof callback === 'function') callback(undefined, null);
    };

    self.cache = {
        init: function () {
        },
        get: function (keys, callback) {
            self.get('cache', keys, callback);
        },
        set: function (key, value, expiration, callback) {
            self.set('cache', key, value, callback, { expiration: expiration });
        }
    };

    self.media = {
        send: function (recordid, name, res) {
            res.setHeader('Content-type', inproc['files'][recordid][name].metadata.content_type);
            res.send(inproc['files'][recordid][name].data);
        },
        save: function (recordid, name, metadata, tmppath, callback) {
            inproc['files'][recordid] = inproc['files'][recordid] || { };
            inproc['files'][recordid][name] = { metadata: metadata };
            fs.readFile(tmppath, function (err, data) {
                inproc['files'][recordid][name].data = data;
                fs.unlink(tmppath, function () {
                    callback(err);
                });
            });
        },
        del: function (recordid, name, callback) {
            delete inproc['files'][recordid][name];
            callback(undefined, null);
        }
    };

    self.dump = function (outstream, promise, wantedList) {
        outstream.end(JSON.stringify(inproc), function () {
            promise.resolve(true);
        });
    };

    config.backendconf = config.backendconf || { };
    self.cacheexpire = config.cacheconf.defaultexpiry || 600;
    self.connected = false;
}

module.exports = InprocBackend;
