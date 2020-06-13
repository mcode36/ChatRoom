'use strict';



const express     = require('express');
const bodyParser  = require('body-parser');
const helmet      = require('helmet');
const path        = require('path');
const fs          = require('fs');
const formidable  = require('formidable');
const readChunk   = require('read-chunk');
const fileType    = require('file-type');
const PORT = 3000;



var app = express();
app.use('/public', express.static(process.cwd() + '/public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// helmet
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.dnsPrefetchControl());
app.use(helmet.referrerPolicy({ policy: 'same-origin' }))


//Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

//Posts page (static HTML)
app.route('/api/posts')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/posts.html');
  });
app.route('/api/post_01')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/view-post.html');
  });
app.route('/api/new-post')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/new-post.html');
  });
app.route('/api/test')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/test.html');
  });
app.route('/api/account')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/account.html');
  });

// Image upload
app.post('/api/upload', function (req, res) {
  var photos = [],
      form = new formidable.IncomingForm();

  // Tells formidable that there will be multiple files sent.
  form.multiples = true;
  // Upload directory for the images
  form.uploadDir = path.join(__dirname, 'tmp_uploads');

  // Invoked when a file has finished uploading.
  form.on('file', function (name, file) {
      // Allow only 3 files to be uploaded.
      if (photos.length === 3) {
          fs.unlink(file.path);
          return true;
      }

      var buffer = null,
          type = null,
          filename = '';

      buffer = readChunk.sync(file.path, 0, 262);
      type = fileType(buffer);

      // Check the file type, must be either png,jpg or jpeg
      if (type !== null && (type.ext === 'png' || type.ext === 'jpg' || type.ext === 'jpeg')) {
          // Assign new file name
          filename = Date.now() + '-' + file.name;

          // Move the file with the new file name
          fs.rename(file.path, path.join(__dirname, 'uploads/' + filename), (err) => {
              if (err) throw err;
          });

          // Add to the list of photos
          photos.push({
              status: true,
              filename: filename,
              type: type.ext,
              publicPath: 'uploads/' + filename
          });
      } else {
          photos.push({
              status: false,
              filename: file.name,
              message: 'Invalid file type'
          });
          fs.unlink(file.path);
      }
  });

  form.on('error', function(err) {
      console.log('Error occurred during processing - ' + err);
  });

  // Invoked when all the fields have been processed.
  form.on('end', function() {
      console.log('Image upload successful.');
  });

  // Parse the incoming form fields.
  form.parse(req, function (err, fields, files) {
      res.status(200).json(photos);
  });
});

//For FCC testing purposes
// fccTestingRoutes(app);

//Routing for API 
// apiRoutes(app);

//Sample Front-end

    
//404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

//Start our server and tests!
app.listen(PORT, function () {
  console.log("Listening on port " + PORT);
  if(process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch(e) {
        var error = e;
          console.log('Tests are not valid:');
          console.log(error);
      }
    }, 1500);
  }
});

module.exports = app; //for testing
