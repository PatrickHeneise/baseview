//
// use nunitjs to run the tests
// http://www.nunitjs.org/
//
var assert = require("assert");
var baseView;
module.exports = {
    setUp:function (callback) {
        baseView = require("../baseview.js")({url: 'http://192.168.1.200:8092', bucket:'test'});
        callback.done();
    },

    tearDown:function (callback) {
        callback.done();
    },

    testSet:function (test) {
        baseView.setDesign('users',
            {
                'names':{
                    'map': "function(doc){if(doc.name){emit(doc.name);}}"
                },
                'rating': {
                    'map': "function(doc){if(doc.name && doc.rating){emit(doc.rating);}}"
                }
            },
            function(err, res){
                assert(!err);
                assert(res.ok);
                test.done();
            }
        );
    },
    testGet:function (test) {
        baseView.getDesign('users', function(err,res){
            assert(!err);
            test.done();
        });
    },
    testDelete:function (test) {
        baseView.deleteDesign('users', function(err, res){
            assert(!err);
            baseView.getDesign('users', function(err,res){
                console.log("error", err, "result", res);
                assert(err);
                assert(res.error === "not_found");
                assert(res.reason === "deleted" || res.reason === "missing");
                test.done();
            });
        });
    }
};