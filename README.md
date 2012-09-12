# baseview

`baseview` is a minimalistic CouchBase client for node.js based on the minimalistic CouchDB driver [nano][1].

CouchBase provides view data as JSON, which can be accessed and streamed with this client. To store and retrieve single documents/key-value pairs, the [memcached][2]-library is required.

# usage
``` js
  baseview = require('baseview')('http://127.0.0.1:8092')
  or
  baseview = require('baseview')({url: 'http://127.0.0.1:8092', bucket: 'my_bucket'})
  ...

  // retrieve data from a view
  baseview.view('design_doc', 'view_name', function(error, data) {
    console.log(error, data);
  });
  
  // retrieve data from a spatial index with bounding box.
  // see 'sparta' for bbox calculations
  baseview.spatial('geo', 'points', {bbox: bbox}, function(error, points) {
    console.log(error, points);
  });

  //adding a design document
  baseview.setDesign('design_doc', {
     'names': {
        'map': "function(doc){if(doc.name){emit(doc.name);}}"
      },
      'rating': {
        'map': "function(doc){if(doc.name && doc.rating){emit(doc.rating);}}"
      }
    },
    function(err, res){
      // handle error http://www.couchbase.com/docs/couchbase-manual-2.0/couchbase-views-designdoc-api-storing.html
    }
  );

  // retrieve a design document
  baseview.getDesign('design_doc', function(err,res) {
    // http://www.couchbase.com/docs/couchbase-manual-2.0/couchbase-views-designdoc-api-retrieving.html
  });

  // delete a design document
  baseview.deleteDesign('design_doc', function(err, res) {
    // handle error http://www.couchbase.com/docs/couchbase-manual-2.0/couchbase-views-designdoc-api-deleting.html
  });
```

To create a geographical bounding box (bbox), have a look at [sparta](https://github.com/PatrickHeneise/sparta), a small library for geo calculations.

## example with socket.io
````js
  io.sockets.on('connection', function (socket) {
    baseview.view('feed', 'images', function(error, data) {
      socket.emit('image_feed', data.rows);
    });
  });
````

# tests
Tests are written in specify. To run the tests, execute:
    node tests/views.js
    node tests/spatial.js


# contribute

everyone is welcome to contribute. patches, tests, bugfixes, new features

1. create an [issue][3] on github so the community can comment on your idea
2. fork `baseview` in github
3. create a new branch `git checkout -b my_branch`
4. create tests for the changes you made
5. make sure you pass both existing and newly inserted tests
6. commit your changes
7. push to your branch `git push origin my_branch`
8. create an pull request

# meta

proudly presented by Patrick Heneise, Barcelona.

[1]: https://github.com/dscape/nano
[2]: https://github.com/elbart/node-memcache
[3]: http://github.com/PatrickHeneise/baseview/issues