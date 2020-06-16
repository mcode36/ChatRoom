'use strict';

// require external libraries
const nunjucks = require('nunjucks');
const bcrypt = require('bcrypt');
const randomstring = require("randomstring");
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;

// required by cropper
const path        = require('path');
const fs          = require('fs');
const formidable  = require('formidable');
const readChunk   = require('read-chunk');
const fileType    = require('file-type');

// Global variables
var sess;
var db;
var bypass_login = true;

const db_client = new MongoClient(process.env.DB, {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

// Util functions
function patch_html(html, from_str, to_str) {
  var fs = require('fs');
  var data = fs.readFileSync(html, 'utf8');
  var result = data.replace(from_str, to_str);
  return result;
}



module.exports = (app) => {
  // Connect to database
  db_client.connect((err, client) => {
    if (err) {
      console.log("Database error: " + err);
    } else {
      console.log("Successful database connection");
    }
    db = client.db("hcc");
  });

  // nunjucks configuration
  var env = nunjucks.configure(['views/'], { // set folders with templates
    autoescape: true,
    noCache: true, // can be set to false at production
    express: app
  });

  // quick mongoDB test
  app.get('/api/insertone', (req, res) => {
    db.collection('test').insertOne({ dummy: 'dummy' }, (err, r) => {
      if (err) {
        console.log("error inserting new record.");
      }
      res.send('insert successful');
    });
  });

  //Index page (static HTML)
  app.route('/')
    .get((req, res) => {
      if (bypass_login) {
        sess = req.session;
        sess.currentuser = 'mtoast@gmail.com';
        sess.cookie.maxAge = 10 * 60 * 1000; // 10 min
      }
      res.sendFile(process.cwd() + '/views/index.html');
    });

  //Posts page (static HTML)
  app.route('/api/posts')
    .get((req, res) => {
      console.log('Route:/api/posts ; Method: get');
      sess = req.session;
      if (!sess.currentuser) { return res.redirect('/api/login'); }
      res.sendFile(process.cwd() + '/views/posts.html');
    });
  app.route('/api/post_01')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/view-post.html');
    });
  app.route('/api/new-post')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/new-post.html');
    });
  app.route('/api/test')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/test.html');
    });

  // account page
  app.route('/api/account')
    .get((req, res) => {
      console.log('Route:/api/account ; Method: get');
      let col = db.collection('accounts');
      sess = req.session;
      if (!sess.currentuser) { return res.redirect('/api/login'); }
      console.log(sess.currentuser)
      col.findOne({ email: sess.currentuser }, (err, r) => {
        if (err) { console.log("error on route /api/account : findOne()"); }
        let obj = {
          username: r.username,
          email: r.email,
          avatar: 'default'
        }
        res.render('account.html', obj);
      });
    });

  // Login
  app.route('/api/login')
    .get((req, res) => {
      // pass Login form
      console.log('Route:/api/login ; Method: get');
      res.sendFile(process.cwd() + '/views/login.html');
    })
    .post((req, res) => {
      // Verify login
      console.log('Route:/api/login ; Method: post');
      let msg = '';
      db.collection('accounts').findOne({ email: req.body.v_email }, (err, r) => {
        if (err) {
          console.log("error with findOne() on route /api/login ...");
        }
        if (!r) {
          msg = JSON.stringify({ E: "No record found for: " + req.body.v_email });
          //msg = '{"E": "No record found for: ' + req.body.v_email + '"}';
        }
        else {
          if (bcrypt.compareSync(req.body.v_passwd, r.password)) {
            console.log('Login successful');
            sess = req.session;
            sess.currentuser = r.email;
            sess.cookie.maxAge = 10 * 60 * 1000; // 10 min
            msg = JSON.stringify({ URL: "/api/posts" });
          } else {
            msg = JSON.stringify({ E: "Wrong password." });
          }
        }
        res.send(msg);
      });


    })

  // register
  app.route('/api/register')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/register.html');
    })
    .post((req, res) => {
      console.log('Route:/api/register ; Method: post');
      console.log('session data:', sess);
      let col = db.collection('accounts');
      // username is for display purpose
      // email and password are used for login validation
      // TODO: Use Bcrypt to encrypt password
      let hashPasswd = bcrypt.hashSync(req.body.v_passwd, 8);
      let obj = {
        username: req.body.v_uname,
        email: req.body.v_email,
        password: hashPasswd
      }
      col.insertOne(obj, (err, r) => {
        if (err) {
          console.log("error inserting new record.");
        }
      });
      res.redirect('/api/login')
    });

  // password reset request
  app.route('/api/passwd_reset_req')
    .get((req, res) => {
      let html = process.cwd() + '/views/passwd_reset_req.html';
      if (req.query.rcode) {
        // TODO: add req.query.email to the error message 
        let new_html = patch_html(html, 'rcode=0', 'rcode=3')
        res.send(new_html);
      } else {
        res.sendFile(html);
      }
    })

    .post((req, res) => {
      console.log('Route:/api/passwd_reset_req ; Method: post');
      let col = db.collection('accounts');

      // check if account exists
      col.findOne({ email: req.body.v_email }, (err, r) => {
        if (err) {
          console.log("error with findOne() on route /api/login ...");
        }
        if (!r) {
          res.redirect('/api/passwd_reset_req?rcode=3&email=' + req.body.v_email)
        }
        else {
          // generate random reset code
          let resetcode = randomstring.generate({ length: 6, charset: 'numeric' });

          // TODO: send email
          console.log('send to email:', req.body.v_email);

          // set tmp session data
          sess = req.session;
          sess.cookie.maxAge = 3 * 60 * 1000; // 3 min
          sess.tmpkey = req.body.v_email;
          // save tmpkey to DB
          col.updateOne({ email: req.body.v_email },
            { $set: { tmpkey: resetcode } }, (err, r) => {
              if (err) {
                console.log("error updating account:", req.body.v_email);
              } else {
                console.log("Add resetcode successful:", req.body.v_email, " : ", resetcode);
              }
            });
          res.redirect('/api/passwd_reset')
        }
      });
    });

  // password reset
  app.route('/api/passwd_reset')
    .get((req, res) => {
      console.log('Route:/api/passwd_reset ; Method: get');
      sess = req.session;
      res.sendFile(process.cwd() + '/views/passwd_reset.html');
    })
    .post((req, res) => {
      console.log('Route:/api/passwd_reset ; Method: post');
      let msg = '';
      let col = db.collection('accounts');
      // check session tmpkey
      sess = req.session;
      if (!sess.tmpkey) {
        console.log('session key missing. session expired?');
        msg = JSON.stringify({ URL: '/api/passwd_reset_req' });
        res.send(msg);
      } else {
        console.log('session email address:', sess.tmpkey);
        // verify req.body.v_code with tmpkey in DB 
        col.findOne({ email: sess.tmpkey }, (err, r) => {
          if (err) { console.log("error on route /api/passwd_reset : findOne()"); }
          if (r.tmpkey == req.body.v_code) {
            sess.currentuser = r.email;
            sess.cookie.maxAge = 10 * 60 * 1000; // 10 min
            // TODO: destroy tmpkey in DB
            msg = JSON.stringify({ URL: '/api/account' });
            res.send(msg);
          }
          else {
            msg = JSON.stringify({ E: "Wrong password reset code." });
            res.send(msg);
          }
        });

      }
    });

  // logout
  app.route('/api/logout')
    .get((req, res) => {
      req.session.destroy();
      res.sendFile(process.cwd() + '/views/index.html');
    });

  // Image upload
  app.post('/api/upload', (req, res) => {
    var photos = [],
      form = new formidable.IncomingForm();

    // Tells formidable that there will be multiple files sent.
    form.multiples = true;
    // Upload directory for the images

    //form.uploadDir = path.join(__dirname, 'tmp_uploads');
    form.uploadDir = process.cwd() + '/tmp_uploads';
    console.log(form.uploadDir)

    // Invoked when a file has finished uploading.
    form.on('file', (name, file) => {
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
        let new_loc = process.cwd() + '/uploads/' + filename
        fs.rename(file.path, new_loc, (err) => {
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

    form.on('error', (err) => {
      console.log('Error occurred during processing - ' + err);
    });

    // Invoked when all the fields have been processed.
    form.on('end', () => {
      console.log('Image upload successful.');
    });

    // Parse the incoming form fields.
    form.parse(req, (err, fields, files) => {
      res.status(200).json(photos);
    });
  });

};
