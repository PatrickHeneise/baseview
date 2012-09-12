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
  */
var request = require('request')
  , qs = require('querystring')
  , errs = require('errs')
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
    // most simple case is no opts, which returns the root
    if(typeof opts === "function") {
      callback = opts;
      opts     = {path: ""};
    }

    // string is the same as a simple get request to that path
    if(typeof opts === 'string') {
      opts = {path: opts};
    }

    // no opts, meaning stream root
    if(!opts) {
      opts     = {path: ""};
      callback = null;
    }
    
    var params  = opts.params
      , headers = { "content-type": "application/json"
                  , "accept"      : "application/json"
                }
      , req     = { method  : (opts.method || "GET")
                , headers : headers
                , uri     : cfg.url }
      , status_code
      , parsed
      , rh;
    

    if (opts.headers) {
      for (var k in opts.headers) {
        req.headers[k] = opts.headers[k];
      }
    }

    if(opts.path) {
      req.uri += "/" + opts.path;
    }
    else if(opts.doc)  {
      // not a design document
      if(!/^_design/.test(opts.doc)) {
        try {
          req.uri += "/" + encodeURIComponent(opts.doc);
        }
        catch (error) {
          return errs.handle(errs.merge(error,
            { "message": "couldnt encode: "+(opts && opts.doc)+" as an uri"
            , "scope"  : "nano"
            , "errid"  : "encode_uri"
            }), callback);
        }
      }
      else {
        // design document
        req.uri += "/" + opts.doc;
      }

      if(opts.att) {
        req.uri += "/" + opts.att;
      }
    }

    if(opts.encoding !== undefined && callback) {
      req.encoding = opts.encoding;
      delete req.headers["content-type"];
      delete req.headers.accept;
    }

    if(opts.content_type) {
      req.headers["content-type"] = opts.content_type;
      delete req.headers.accept; // undo headers set
    }

    // these need to be encoded
    if(!isEmpty(params)) {
      try {
        ['startkey', 'endkey', 'key', 'keys'].forEach(function (key) {
          if (key in params) {
            try { params[key] = JSON.stringify(params[key]); }
            catch (err) {
              return errs.handle(errs.merge(err,
                { "message": "bad params: " + key + " = " + params[key]
                , "scope"  : "nano"
                , "errid"  : "encode_keys"
                }), callback);
            }
          }
        });
      } catch (err6) {
        return errs.handle(errs.merge(err6,
          { "messsage": "params is not an object"
          , "scope"   : "nano"
          , "errid"   : "bad_params"
          }), callback);
      }

      try {
        req.uri += "?" + qs.stringify(params);
      }
      catch (err2) {
        return errs.handle(errs.merge(err2,
           { "message": "invalid params: " + params.toString()
           , "scope"  : "nano"
           , "errid"  : "encode_params"
           }), callback);
      }
    }

    if(opts.body) {
      if (Buffer.isBuffer(opts.body)) {
        req.body = opts.body; // raw data
      }
      else {
        try {
          req.body = JSON.stringify(opts.body, function (key, value) {
            // don't encode functions
            // this allows functions to be given without pre-escaping
            if (typeof(value) === 'function') {
              return value.toString();
            } else {
              return value;
            }
          });
        } catch (err3) {
          return errs.handle(errs.merge(err3,
             { "message": "body seems to be invalid json"
             , "scope"  : "nano"
             , "errid"  : "encode_body"
             }), callback);
        }
      } // json data
    }

    if(opts.form) {
      req.headers['content-type'] = 
        'application/x-www-form-urlencoded; charset=utf-8';
      req.body = qs.stringify(opts.form).toString('utf8');
    }

    // streaming mode
    if(!callback) {
      try {
        return request(req);
      } catch (err4) {
        return errs.handle(errs.merge(err4,
           { "message": "request threw when you tried to stream"
           , "scope"  : "request"
           , "errid"  : "stream"
           }), callback);
      }
    }
    
    //console.log(req);

    try {
      var stream = request(req, function(e,h,b) {
        // make sure headers exist
        rh = (h && h.headers || {});
        rh['status-code'] = status_code = (h && h.statusCode || 500);
        rh.uri            = req.uri;

        if(e) {
          errs.handle(errs.merge(e,
            {   "message": "error happened in your connection"
              , "scope"  : "socket"
              , "errid"  : "request"
            }), callback);
          return stream;
        }

        delete rh.server;
        delete rh['content-length'];

        try { parsed = JSON.parse(b); } catch (err) { parsed = b; }

        if (status_code >= 200 && status_code < 400) {
          callback(null,parsed,rh);
          return stream;
        }
        else { // proxy the error directly from couchdb
          if (!parsed) { parsed = {}; }
          if (!parsed.message && (parsed.reason || parsed.error)) {
            parsed.message = (parsed.reason || parsed.error);
          }
          errs.handle(errs.merge(errs.create(parsed),
             { "scope"       : "couch"
             , "status_code" : status_code
             , "status-code" : status_code
             , "request"     : req
             , "headers"     : rh
             , "errid"       : "non_200"
             , "message"     : parsed.reason || "couch returned "+status_code
             }), callback);
          return stream;
        }
      });
      return stream;
    } catch(err5) {
      return errs.merge(err5,
         { "message": "request threw when you tried to create the object"
         , "scope"  : "request"
         , "errid"  : "callback"
         });
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
      return relax({ path: view_path, method: "POST", params: params, body: body}, callback);
    }
    else {
      return relax({path: view_path, method: "GET", params: params}, callback);
    }
  }
  
  function view_spatial(design_name, view_name, params, callback) {
    if(typeof params === "function") {
      callback = params;
      params   = {};
    }
    var view_path = _bucket + '/_design/' + design_name + '/_spatial/'  + view_name;
    if (params.keys) {
      var body = {keys: params.keys};
      delete params.keys;
      return relax({ path: view_path, method: "POST", params: params, body: body}, callback);
    }
    else {
      return relax({path: view_path, method: "GET", params: params}, callback);
      }
  }
  
  function set_design(design_name, views, callback) {
    var view_path = _bucket + '/_design/' + design_name;
    return relax({ path: view_path, method: "PUT", body: {views: views}}, callback);
  }
  
  function set_spatial(design_name, geoview, callback) {
    var view_path = _bucket + '/_design/' + design_name;
    return relax({ path: view_path, method: "PUT", body: {views: {}, spatial: geoview}}, callback);
  }

  function get_design(design_name, callback) {
    var view_path = _bucket + '/_design/' + design_name;
    return relax({ path: view_path, method: "GET"}, callback);
  }

  function delete_design(design_name, callback) {
    var view_path = _bucket + '/_design/' + design_name;
    return relax({ path: view_path, method: "DELETE"}, callback);
  }

  return {
    view: view_docs,
    spatial: view_spatial,
    setSpatialDesign: set_spatial,
    setDesign: set_design,
    getDesign: get_design,
    deleteDesign: delete_design
  }
};