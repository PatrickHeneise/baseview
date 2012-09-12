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
  couchbase.set('baseviewtestdoc', JSON.stringify(testDoc), function(err, result) {
    couchbase.close();
    assert.equal(err, null, 'Can\'t set sample document');
    assert.ok(result == 'STORED', 'Test document stored.');
  });
});

specify('baseview:setSpatialView', function(assert) {
  var geoView = {
    'points' : 'function(doc) {if (doc.location) { emit({type: "Point", coordinates: [doc.location[0], doc.location[1]]}, doc.test);}}'
  };
  baseview.setSpatialDesign('geoView', geoView, function(err, result) {
    assert.equal(err, null, 'Can\'t update spatial design document');
    assert.equal(result.ok, true);
    assert.ok(result.ok);
  });
});

specify('baseview:getSpatialView', function(assert) {
  baseview.getDesign('geoView', function(err, result) {
    assert.equal(err, null, 'Can\'t get spatial design doc');
    assert.ok(result);
  });
});

specify('baseview:testSpatialView', function(assert) {
  baseview.spatial('geoView', 'points', {bbox: '-180,-90,180,90'}, function(err, result) {
    assert.equal(err, null, 'Can\'t call spatial view');
    assert.equal(result.rows.length, 1);
    assert.ok(result.rows[0].value == 'Hello Baseview');
  });
});

specify('baseview:deleteSpatialView', function(assert) {
  baseview.deleteDesign('dev_geoView', function(err, result) {
    assert.equal(err, null, 'Can\'t delete spatial design document');
    baseview.getDesign('dev_geoView', function(err, result) {
      assert.ok(err.status_code == 404);
    });
  });
});

specify('baseview:teardown', function (assert) {
  couchbase.connect();
  couchbase.delete('baseviewtestdoc', function(err, result) {
    couchbase.close();
    assert.equal(err, null);
    assert.ok(result == 'DELETED')
  });
});

specify.run();