var specify   = require('specify')
  , memcache  = require('memcache')
  , baseview  = require('../baseview')('http://127.0.0.1:8092')
  , couchbase = new memcache.Client(11211, '127.0.0.1');

specify('baseview:setup', function (assert) {
  var testDoc = {
    'jsonType': 'testDoc',
    'test': 'Hello Baseview'
  };
  couchbase.connect();
  couchbase.set('baseviewtestdoc', JSON.stringify(testDoc), function(err, result) {
    couchbase.close();
    assert.equal(err, null, 'Can\'t set sample document');
    assert.ok(result == 'STORED', 'Test document stored.');
  });
});

specify('baseview:setDesignDocument', function(assert) {
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

specify('baseview:getDesignDocument', function(assert) {
  baseview.getDesign('testBaseview', function(err, result) {
    assert.equal(err, null, 'Can\'t get design doc');
    assert.ok(result);
  });
});

specify('baseview:testView', function(assert) {
  baseview.view('testBaseview', 'test', {stale: false}, function(err, result) {
    assert.equal(err, null, 'Can\'t call view');
    assert.equal(result.total_rows, 1);
    assert.ok(result.rows[0].value == 'Hello Baseview');
  });
});

specify('baseview:deleteDesign', function(assert) {
  baseview.deleteDesign('testBaseview', function(err, result) {
    assert.equal(err, null, 'Can\'t delete design document');
    baseview.getDesign('testBaseview', function(err, result) {
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