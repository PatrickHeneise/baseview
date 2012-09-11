var specify   = require('specify')
  , memcache  = require('memcache')
  , baseview  = require('../baseview')('http://127.0.0.1:8092')
  , couchbase = new memcache.Client(11211, '127.0.0.1');

specify('baseview:setup', function (assert) {
  var testDoc = {
    'jsonType': 'testDoc',
    'test': 'Hello Baseview',
    'location': [ 41.387427,2.169617 ],
  };
  couchbase.connect();
  couchbase.set('baseviewtest', JSON.stringify(testDoc), function(err, result) {
    couchbase.close();
    assert.equal(err, null, 'Can\'t set sample document');
    assert.ok(result == 'STORED', 'Test document stored.');
  });
});

specify('baseview:setDesign', function(assert) {
  var testView = {
    'test':{
        'map': 'function (doc, meta) {if(doc.jsonType == "testDoc") {emit(meta.id, doc.test);}}'
    }
  };
  baseview.setDesign('testBaseview', testView, function(err, result) {
    assert.equal(err, null, 'Can\'t set design document');
    assert.equal(result.ok, true);
    assert.ok(result.ok);
  });
});

specify('baseview:testDesign', function (assert) {
  baseview.view('testBaseview', 'test', {stale: false}, function(err, result) {
    assert.equal(err, null, 'Can\'t call view');
    assert.equal(result.total_rows, 1);
    assert.ok(result.rows[0].value == 'Hello Baseview');
  });
});

specify('baseview:setGeoView', function(assert) {
  var geoView = {
    'points' : 'function(doc) {if (doc.location) { emit({type: "Point", coordinates: [doc.location[0], doc.location[1]]}, doc.test);}}'
  };
  baseview.setSpatialDesign('dev_geoView', geoView, function(err, result) {
    assert.equal(err, null, 'Can\'t update spatial design document');
    assert.equal(result.ok, true);
    assert.ok(result.ok);
  });
});

specify('baseview:testGeo', function(assert) {
  baseview.spatial('dev_geoView', 'points', function(err, result) {
    console.log(err, result);
    assert.equal(err, null, 'Can\'t call spatial view');
    assert.equal(result.total_rows, 1);
    assert.ok(result.rows[0].value == 'Hello Baseview');
  });
});

//specify('baseview:teardown', function (assert) {
//  baseview.deleteDesign('testBaseview', function(err, result) {
//    assert.equal(err, null);
//    assert.ok(result.ok == true);
//  });
//  couchbase.connect();
//  couchbase.delete('baseviewtest', function(err, result) {
//    couchbase.close();
//    assert.equal(err, null);
//    assert.ok(result == 'DELETED')
//  });
//});

specify.run();