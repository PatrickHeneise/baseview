/** minimal CouchBase view client in node.js
  * based on nano (https://github.com/dscape/nano)
  *
  * copyright 2012 patrick heneise
  *  
  * licensed under the apache license, version 2.0 (the "license");
  * you may not use this file except in compliance with the license.
  * you may obtain a copy of the license at
  *
  *     http://www.apache.org/licenses/LICENSE-2.0
  *
  * unless required by applicable law or agreed to in writing, software
  * distributed under the license is distributed on an "as is" basis,
  * without warranties or conditions of any kind, either express or implied.
  * see the license for the specific language governing permissions and
  * limitations under the license.
  *
  * @author Patrick Heneise, @PatrickHeneise
  * @license http://www.opensource.org/licenses/mit-license.html MIT License
  */
var request = require('request')
  , qs = require('querystring')
  , error = require('errs')
  , logging = require('./logging')
  , u = require('url');

module.exports = baseview = function (cfg) {

    if(typeof cfg === "string") {
        if(/^https?:/.test(cfg)) { cfg = {url: cfg}; } // url
        else {
            try { cfg   = require(cfg); } // file path
            catch(e) {
                e.message = "couldn't read config file " +
                    (cfg ? cfg.toString() : '');
                throw error.init(e, "badfile");
            }
        }
    }

    var _bucket = cfg && cfg.bucket || "default";
    var _url = cfg && cfg.url || "http://127.0.0.1:8092";

  function isEmpty(object) {
    for(var property in object) {
      if(object.hasOwnProperty(property)) return false; }
    return true;
  }

  function relax(opts,callback) {
    if(typeof opts === 'string') { opts = {path: opts}; }
    var log = logging();
    var headers = { "content-type": "application/json"
                  , "accept"      : "application/json"
                  }
      , req     = { method : (opts.method || "GET")
                  , headers: headers
                  , uri    : _url }
      , params  = opts.params
      , status_code
      , parsed
      , rh;

    if(opts.path) { req.uri += "/" + opts.path; }
    if(opts.encoding !== undefined && callback) {
      req.encoding = opts.encoding;
      delete req.headers["content-type"];
      delete req.headers.accept;
    }
    if(!isEmpty(params)) {
      ['startkey', 'endkey', 'key', 'keys'].forEach(function (key) {
        if (key in params) {
          try { params[key] = JSON.stringify(params[key]); }
          catch (ex2) { 
            ex2.message = 'bad params: ' + key + ' = ' + params[key];
            return new Error(ex, 'jsonstringify', {}); 
          }
        }
      });
      try { req.uri += "?" + qs.stringify(params); }
      catch (ex3) {
        ex3.message = 'invalid params: ' + params.toString();
        return error.request_err(ex3, 'qsstringify', {});
      }
    }
    if(!callback) { // void callback, stream
      try {
        return request(req);
      } catch (ex4) { 
        return error.request_err(ex4, 'streamthrow', {});
      }
    }
    if(opts.body) {
      if (Buffer.isBuffer(opts.body)) {
        req.body = opts.body; // raw data
      }
      else {
        try {
          req.body = JSON.stringify(opts.body, function (key, value) {
            if (typeof(value) === 'function') {
              return value.toString();
            } else {
              return value;
            }
          });
        } catch (ex5) { 
          ex5.message = "couldn't json.stringify the body you provided";
          return error.request_err(ex5, 'jsonstringify', {}, callback);
        }
      } // json data
    }
    log(req);
    try {
      var stream = request(req, function(e,h,b){
        rh = (h && h.headers || {});
        rh['status-code'] = status_code = (h && h.statusCode || 500);
        rh.uri            = req.uri;
        if(e) {
          log({err: 'socket', body: b, headers: rh });
          callback(new Error(e,"socket",req,status_code),b,rh);
          return stream;
        }
        try { parsed = JSON.parse(b); } catch (err) { parsed = b; }
        if (status_code >= 200 && status_code < 300) {
          log({err: null, body: parsed, headers: rh});
          callback(null,parsed,rh);
          return stream;
        }
        else { // proxy the error directly from couchdb
          log({err: 'couch', body: parsed, headers: rh});
          if (!parsed) { parsed = {}; }
          callback(new Error(parsed.reason,parsed.error,req,status_code),
            parsed, rh);
          return stream;
        }
      });
      return stream;
    } catch(ex6) { 
      return new Error(ex6, 'callbackthrow', {});
    }
  }
  
  function view_docs(design_name,view_name,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      var view_path = _bucket + '/_design/' + design_name + '/_view/'  + view_name;
      if (params.keys) {
        var body = {keys: params.keys};
        delete params.keys;
        return relax({ path: view_path
                     , method: "POST", params: params, body: body}, callback);
      }
      else {
        return relax({path: view_path
                     , method: "GET", params: params},callback);
      }
  }
  
  function view_spatial(design_name,view_name,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      var view_path = _bucket + '/_design/' + design_name + '/_spatial/'  + view_name;
      if (params.keys) {
        var body = {keys: params.keys};
        delete params.keys;
        return relax({ path: view_path
                     , method: "POST", params: params, body: body}, callback);
      }
      else {
        return relax({path: view_path
                     , method: "GET", params: params},callback);
      }
  }
    function set_design(design_name, views, callback){
        var view_path = _bucket + '/_design/' + design_name;
        return relax({ path: view_path
            , method: "PUT", body: {views: views}}, callback);
    }

    function get_design(design_name, callback){
        var view_path = _bucket + '/_design/' + design_name;
        return relax({ path: view_path
            , method: "GET"}, callback);
    }

    function delete_design(design_name, callback){
        var view_path = _bucket + '/_design/' + design_name;
        return relax({ path: view_path
            , method: "DELETE"}, callback);
    }

  return {
      view: view_docs,
      spatial: view_spatial,
      setDesign: set_design,
      getDesign: get_design,
      deleteDesign: delete_design
  }
};