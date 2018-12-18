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

var path = require("path");
var DynamicDictionaries = require("../dict/DynamicDictionaries");
var Tokenizer = require("../Tokenizer");

/**
 * DictionaryLoader base constructor
 * @param {object} options Options for the dictionary (only dic_path for now)
 * @constructor
 */
function DictionaryLoader(options) {
    this.dic = new DynamicDictionaries();
    this.dic_path = options.dic_path || 'dict/';
}

DictionaryLoader.prototype.loadArrayBuffer = function (file, callback) {
    throw new Error("DictionaryLoader#loadArrayBuffer should be overriden");
};

DictionaryLoader.prototype.isCached = function (file, callback) {
    throw new Error("DictionaryLoader#isCached should be overridden");
};

DictionaryLoader.prototype.clearCache = function (file, callback) {
    throw new Error("DictionaryLoader#clearCache should be overridden");
};

/**
 * Load dictionary files
 * @param {DictionaryLoader~onLoad} load_callback Callback function called after loaded
 */
DictionaryLoader.prototype.load = async function (load_callback) {
    var err = null;
    var dic = this.dic;
    var partialGetArrayBufferData = (name) => {
        return new Promise((resolve, reject) => {
            this.loadArrayBuffer(path.join(this.dic_path, name + '.dat'), (err, res) => {
                if (err)
                    return reject(err);
                return resolve(res);
            });
        });
    };

    try {
        dic.loadTrie.apply(dic, await Promise.all(['base', 'check'].map(async name => new Int32Array(await partialGetArrayBufferData(name)))));
        dic.loadTokenInfoDictionaries.apply(dic, await Promise.all((['tid', 'tid_pos', 'tid_map'].map(async name => new Uint8Array(await partialGetArrayBufferData(name))))));
        dic.loadConnectionCosts(new Int16Array(await partialGetArrayBufferData('cc')));
        dic.loadUnknownDictionaries.apply(dic, await Promise.all(['unk', 'unk_pos', 'unk_map', 'unk_char', 'unk_compat', 'unk_invoke']
            .map(async name => name == 'unk_compat' ? new Uint32Array(await partialGetArrayBufferData(name)) : new Uint8Array(await partialGetArrayBufferData(name)))));
    } catch (e) {
        err = e;
    }

    load_callback(err, new Tokenizer(dic));
};

/**
 * Callback
 * @callback DictionaryLoader~onLoad
 * @param {Object} err Error object
 * @param {DynamicDictionaries} dic Loaded dictionary
 */

module.exports = DictionaryLoader;
