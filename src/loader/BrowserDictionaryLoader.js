/*
 * Copyright 2014 Takuya Asano
 * Copyright 2010-2014 Atilika Inc. and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

var DictionaryLoader = require("./DictionaryLoader");
var DB_NAME = "kuromoji-dict";
var TABLE_NAME = "dict-data";

/**
 * BrowserDictionaryLoader inherits DictionaryLoader, using jQuery XHR for download
 * @param {object} options Options for the dictionary (only dic_path and no_cache for now)
 * @constructor
 */
function BrowserDictionaryLoader(options) {
    DictionaryLoader.call(this, options);

    // cache is on by default
    if (options.cache !== false) {
        this.dbPromise = new Promise((resolve, reject) => {
            var request = window.indexedDB.open(DB_NAME);

            request.onerror = function(event) {
                throw 'Error loading indexedDB ' + event.target.errorCode;
            };

            // called after done upgrading (if needed) and ready
            request.onsuccess = function(event) {
                resolve(event.target.result);
            };

            // gets called on initialization or schema upgrade
            request.onupgradeneeded = function(event) {
                var db = event.target.result;
                db.createObjectStore(TABLE_NAME, { keyPath: 'url' });
            };
        });
    }
}

BrowserDictionaryLoader.prototype = Object.create(DictionaryLoader.prototype);

function download(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
        if (this.status > 0 && this.status !== 200) {
            callback(xhr.statusText, null);
            return;
        }
        callback(null, new Uint8Array(this.response).buffer);
    };
    xhr.onerror = function (err) {
        callback(err, null);
    };
    xhr.send();
}

/**
 * Utility function to load dictionary.
 * Use gzip, or brotli compression may be used. Make sure `Content-Encoding`
 * is set and the browser will decompress automatically.
 * @param {string} url Dictionary URL
 * @param {BrowserDictionaryLoader~onLoad} callback Callback function
 */
BrowserDictionaryLoader.prototype.loadArrayBuffer = function (url, callback) {
    // Check if we have it cached
    if (this.dbPromise) {
        this.dbPromise.then((db) => {
            // check if it exists
            db.transaction([TABLE_NAME]).objectStore(TABLE_NAME)
                .get(url).onsuccess = function(event) {
                    if (event.target.result) {
                        callback(null, event.target.result.data);
                    } else {
                        // doesn't exist in the db yet
                        // new transaction
                        download(url, (err, data) => {
                            db.transaction([TABLE_NAME], 'readwrite')
                                .objectStore(TABLE_NAME).add({
                                    url,
                                    data,
                                }).onsuccess = function(event) {
                                    callback(null, data);
                                };
                        });
                    }
                };
        });
    } else {
        download(url, callback);
    }
};

/**
 * Checks if the dictionary files have already been downloaded and are stored
 * in the indexedDB cache.
 * @param {BrowserDictionaryLoader~onIsCached} callback Callback function
 */
BrowserDictionaryLoader.prototype.isCached = function (callback) {
};

/**
 * Clears out any cached dictionary files so they will be forced to re-download.
 * @param {BrowserDictionaryLoader~onClearCache} callback Callback function
 */
BrowserDictionaryLoader.prototype.clearCache = function (callback) {
    var request = window.indexedDB.deleteDatabase(DB_NAME);

    request.onerror = function(event) {
        callback('Error deleting database', null);
    };

    request.onsuccess = function(event) {
        callback(null, null);
    };
};

/**
 * Callback
 * @callback BrowserDictionaryLoader~onLoad
 * @param {Object} err Error object
 * @param {Uint8Array} buffer Loaded buffer
 */

module.exports = BrowserDictionaryLoader;
