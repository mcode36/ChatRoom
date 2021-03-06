'use strict';

// required external libraries
const bcrypt = require('bcrypt');
const randomstring = require("randomstring");
const MongoClient = require('mongodb').MongoClient;
const nunjucks = require('nunjucks');
const h2p = require('html2plaintext')
const ObjectId = require('mongodb').ObjectId;

// required by cropper
const path = require('path');
const fs = require('fs');
const formidable = require('formidable');
const readChunk = require('read-chunk');
const fileType = require('file-type');

// Global variables
var sess;
var db;

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
    //// createIndex only need to run once at project setup
    // db.collection('posts').createIndex(
    //   { title: "text", content: "text" }, function(err, result) {
    //   if (err) { return console.log(err); }
    //   console.log(result);
    // });
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

  // Test page
  app.route('/test')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/tryRun/btn/button.html');
    });

  //Index page (static HTML)
  app.route('/')
    .get((req, res) => {
      //res.sendFile(process.cwd() + '/views/index.html');
      sess = req.session;
      let btn_text = 'Member Login';
      if (sess.authUser) { btn_text = 'Enter'; }
      console.log(btn_text);
      res.render('index.html', {btn_text:btn_text});
    });

  // About page
  app.route('/about')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/about.html');
    });

  // Posts 
  app.route('/api/posts')
    .get((req, res) => {
      console.log('Route:/api/posts ; Method: get');
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }

      // Pagination
      const col_account = db.collection('accounts');
      const col_post = db.collection('posts');
      const posts_per_page = 5;
      let page_n = 1;
      if (req.query.page) {
        page_n = parseInt(req.query.page);
      }
      let skip_n = posts_per_page * (page_n - 1);

      col_account.find({}).toArray((err, accounts) => {
        // build dictionary
        let uname_dict = {};
        let avatar_dict = {};
        for (let i = 0; i < accounts.length; i++) {
          uname_dict[accounts[i]._id] = accounts[i].username;
          avatar_dict[accounts[i]._id] = accounts[i].avatar;
        }

        // query string (search, category conditions)
        let query_string = {} // default
        let page_qString = '';
        if (req.query.cat) {
          query_string = { category: req.query.cat }
          page_qString = '&cat=' + req.query.cat;
        }
        // search function will overwrite category listing
        if (req.query.search) {  
          query_string = { $text: { $search: req.query.search } }
          page_qString = '&search="' + req.query.search + '"';
        }
        
        // query options
        let query_options = {
          sort: { date: -1 },
          limit: 5,
          skip: skip_n
        }
        col_post.find(query_string, query_options, function (err, cursor) {
          if (err) return console.log(err);
          cursor.count(false, function (err, total_posts) {
            if (err) return console.log(err);
            cursor.toArray(function (err, posts) {
              if (err) return console.log(err);

              // set page object for rendering page
              let max_page = Math.ceil(total_posts / posts_per_page);
              let page = {
                current: page_n,
                total: max_page,
                qString: page_qString
              };
              if (page_n + 1 <= max_page) { page.next = page_n + 1; } else { page.next = 0 }
              if (page_n - 1 >= 1) { page.prev = page_n - 1; } else { page.prev = 0 }

              // post processing posts array
              for (let i = 0; i < posts.length; i++) {
                // post processing date field
                let d = new Date(posts[i].date);
                let d_string = d.toLocaleString('default', { month: 'long' }) + ' ' + d.getDate() + ', ' + d.getFullYear();
                posts[i]['d_string'] = d_string;
                // post processing content field
                let text = '', x = 0;
                let t = h2p(posts[i].content).split(' ');
                while (true) {
                  text = text + t[x] + ' ';
                  x += 1;
                  if (x >= t.length) { break; }
                  if (text.length > 220) { text = text + '...'; break; }
                }
                // post processing object_position_style
                posts[i]['object_position_style'] = 'object-position:' + posts[i]['spriteOffset'] + 'px 0px';

                // post processing other variables
                posts[i]['plain_text'] = text;
                posts[i]['author'] = uname_dict[posts[i]['author_id']];
                posts[i]['avatar'] = avatar_dict[posts[i]['author_id']];
              }
              res.render('posts.html', { user: sess.authUser, posts: posts, page: page });
            })
          })
        });
      });

    });

  // View Post
  app.route('/api/view_post/:post_id')
    .get((req, res) => {
      console.log('Route:/api/view_post (get) post_id:', req.params.post_id);
      let col_account = db.collection('accounts');
      let col_post = db.collection('posts');
      col_account.find({}).toArray((err, accounts) => {
        // build dictionary
        let uname_dict = {};
        let avatar_dict = {};
        for (let i = 0; i < accounts.length; i++) {
          uname_dict[accounts[i]._id] = accounts[i].username;
          avatar_dict[accounts[i]._id] = accounts[i].avatar;
        }

        col_post.findOne({ _id: ObjectId(req.params.post_id) }, (err, post) => {
          let d = new Date(post.date);
          post.d_string = d.toLocaleString('default', { month: 'long' }) + ' ' + d.getDate() + ', ' + d.getFullYear();
          // post.isOwner
          post.isOwner = false;
          if (post.author_id == sess.authUser.uid) {
            post.isOwner = true;
          }
          // post.already_liked
          post.already_liked = false;
          if (post.likes_by.includes(sess.authUser.username)) {
            post.already_liked = true;
          }
          // author username and avatar 
          post.author_username = uname_dict[post.author_id];
          post.author_avatar = avatar_dict[post.author_id];
          // comments
          for (let i = 0; i < post.comments.length; i++) {
            let d = new Date(post.comments[i].date);
            post.comments[i].d_string = d.toLocaleString('en-US');
            post.comments[i].username = uname_dict[post.comments[i].by_id];
            post.comments[i].avatar = avatar_dict[post.comments[i].by_id];
          }
          res.render('view_post.html', { user: sess.authUser, post: post });


        });
      });




    })

    .put((req, res) => { // handle likes
      console.log('Route:/api/view_post (put) post_id:', req.params.post_id);
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }
      let col_post = db.collection('posts');

      col_post.findOne({ _id: ObjectId(req.params.post_id) }, (err, post) => {

        post.likes_by.push(sess.authUser.username);
        let likes_obj = {
          n_likes: post.n_likes + 1,
          likes_by: post.likes_by
        }
        col_post.updateOne({ _id: ObjectId(req.params.post_id) },
          { $set: likes_obj }, (err, r) => {
            if (err) {
              console.log("error updating post");
            } else {
              console.log("Update post successful. number of likes: ", likes_obj.n_likes);
              res.json({ n_likes: likes_obj.n_likes });
            }
          });
      });
    });

  // New Post
  app.route('/api/newPost')
    .get((req, res) => {
      console.log('Route:/api/newPost ; Method: get');
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }

      // res.render('new_post.html', sess.authUser);

      let post = {
        caption: 'New Post',
        submit_button_text: 'Post',
        form_action: '/api/newPost/',
        banner_img: 'default.jpg',
        spriteOffset: -221,
        title: '',
        category: 'restaurants',
        content: ''
      }
      res.render('new_post.html', { author: sess.authUser, post: post });
    })

    .post((req, res) => {
      sess = req.session;
      // console.log(req.body);
      if (!sess.authUser) { return res.redirect('/api/login'); }

      let col_post = db.collection('posts');
      let content_obj = {
        author_id: sess.authUser.uid,
        date: new Date(),
        title: req.body.v_title,
        category: req.body.v_category,
        banner_img: req.body.v_banner,
        spriteOffset: req.body.v_spriteOffset,
        content: req.body.v_content,
        n_likes: 0,
        likes_by: [],
        comments: []
      }
      col_post.insertOne(content_obj, (err, r) => {
        if (err) { console.log("error inserting new post."); }
      });
      res.redirect('/api/posts')
    });



  // Edit Post
  app.route('/api/editPost/:post_id')
    .get((req, res) => {
      console.log('Route:/api/editPost (get) post_id:', req.params.post_id);
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }
      let col_account = db.collection('accounts');
      let col_post = db.collection('posts');

      col_post.findOne({ _id: ObjectId(req.params.post_id) }, (err, post) => {
        post.caption = 'Edit Post';
        post.submit_button_text = 'Update';
        post.form_action = '/api/editPost/' + req.params.post_id;
        col_account.findOne({ _id: ObjectId(post.author_id) }, (err, author) => {
          res.render('new_post.html', { author: author, post: post });
        });
      });
    })
    .post((req, res) => {
      console.log('Route:/api/editPost (get) post_id:', req.params.post_id);
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }

      let col_post = db.collection('posts');
      let content_obj = {
        author_id: sess.authUser.uid,
        date: new Date(),
        title: req.body.v_title,
        category: req.body.v_category,
        banner_img: req.body.v_banner,
        spriteOffset: req.body.v_spriteOffset,
        content: req.body.v_content
      }

      col_post.updateOne({ _id: ObjectId(req.params.post_id) },
        { $set: content_obj }, (err, r) => {
          if (err) {
            console.log("error updating post:", req.params.post_id);
          } else {
            console.log("Update post successful:", req.params.post_id);
          }
        });
      res.redirect('/api/posts')
    });

  // Delete Post
  app.route('/api/delPost')
    .post((req, res) => {
      console.log('Route:/api/delPost (post)');
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }
      let col_post = db.collection('posts');
      col_post.findOne({ _id: ObjectId(req.body.post_id) }, (err, post) => {
        if (post.author_id == sess.authUser.uid) {
          col_post.deleteOne({ _id: ObjectId(req.body.post_id) }, (err, r) => {
            if (err) { console.log("error deleting post:", req.body.post_id); }
          });
        } else {
          console.log("Not post owner error. Post not deleted");
        }
      });
      res.redirect('/api/posts');
    });

  // Add comment
  app.route('/api/addComment')
    .post((req, res) => {
      console.log('Route:/api/addComment');
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }
      let col_post = db.collection('posts');
      col_post.findOne({ _id: ObjectId(req.body.post_id) }, (err, post) => {
        let comment = {
          by_id: sess.authUser.uid,
          //by_username: sess.authUser.username,
          //by_avatar: sess.authUser.avatar,
          comment: req.body.comment,
          date: new Date()
        }
        post.comments.unshift(comment);
        col_post.updateOne({ _id: ObjectId(req.body.post_id) },
          { $set: { comments: post.comments } }, (err, r) => {
            if (err) {
              console.log("error updating post:", req.body.post_id);
            } else {
              console.log("Update post successful:", req.body.post_id);
              res.json({ status: 'ok' });
            }
          });
      });

    });

  // account page
  app.route('/api/account')
    .get((req, res) => {
      console.log('Route:/api/account ; Method: get');
      let col = db.collection('accounts');
      sess = req.session;
      if (!sess.authUser) { return res.redirect('/api/login'); }
      res.render('account.html', sess.authUser);
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
        }
        else {
          if (bcrypt.compareSync(req.body.v_passwd, r.password)) {
            // login successful
            sess = req.session;
            sess.authUser = {
              uid: r._id,
              email: r.email,
              username: r.username,
              avatar: r.avatar
            };
            sess.cookie.maxAge = 60 * 60 * 1000; // 60 min
            msg = JSON.stringify({ URL: "/api/posts" });
          } else {
            msg = JSON.stringify({ E: "Wrong password." });
          }
        }
        res.send(msg);
      });
    });

  // Change password
  app.post('/api/chgPasswd', (req, res) => {
    sess = req.session;
    let msg = '';
    let col = db.collection('accounts');
    if (!sess.authUser) {
      msg = JSON.stringify({ E: "Session Expired." });
      res.send(msg);
    } else {
      let hashPasswd = bcrypt.hashSync(req.body.v_passwd, 8);

      col.updateOne({ _id: ObjectId(sess.authUser.uid) },
        { $set: { password: hashPasswd } }, (err, r) => {
          if (err) {
            console.log("error updating account:", sess.authUser.email);
          } else {
            console.log("Update password successful. Account:", sess.authUser.email);
            msg = JSON.stringify({ S: "Update password successful." });
            res.send(msg);
          }
        });
    }
  });

  // Update Account (username, email)
  app.post('/api/acntUpdate', (req, res) => {
    sess = req.session;
    let msg = '';
    let col = db.collection('accounts');
    if (!sess.authUser) {
      msg = JSON.stringify({ E: "Session Expired." });
      res.send(msg);
    } else {

      col.updateOne({ _id: ObjectId(sess.authUser.uid) },
        {
          $set: {
            username: req.body.v_uname,
            email: req.body.v_email
          }
        }, (err, r) => {
          if (err) {
            console.log("error updating account:", sess.authUser.email);
          } else {
            if (sess.authUser.email != req.body.v_email) {
              sess.authUser.email = req.body.v_email;
            }

            console.log("Update account successful. Account:", sess.authUser.email);
            msg = JSON.stringify({ S: "Update successful." });
            res.send(msg);
          }
        });
    }
  });

  // register
  app.route('/api/register')
    .get((req, res) => {
      res.sendFile(process.cwd() + '/views/register.html');
    })
    .post((req, res) => {
      console.log('Route:/api/register ; Method: post');

      let col = db.collection('accounts');
      // username is for display purpose
      // email and password are used for login validation
      let hashPasswd = bcrypt.hashSync(req.body.v_passwd, 8);
      let user_obj = {
        username: req.body.v_uname,
        email: req.body.v_email,
        password: hashPasswd,
        avatar: 'default.jpg'
      }
      col.insertOne(user_obj, (err, r) => {
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
          // save tmpkey to DB. Because valid session is not established yet, use
          // email to look for account
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
            sess.authUser = {
              uid: r._id,
              email: r.email,
              username: r.username,
              avatar: r.avatar
            };
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
      return res.redirect('/');
    });

  // Image upload
  app.post('/api/upload', (req, res) => {
    sess = req.session;

    var photos = [];
    var form = new formidable.IncomingForm();
    var imgFor;

    // Tells formidable that there will be multiple files sent.
    form.multiples = true;
    // Upload directory for the images

    //form.uploadDir = path.join(__dirname, 'tmp_uploads');
    form.uploadDir = process.cwd() + '/tmp_uploads';

    // Invoked when a file has finished uploading.
    form.on('file', (fname, file) => {
      //console.log('name:',name)
      //console.log('file:',file)

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
        let new_loc = process.cwd() + '/uploads/' + fname + '/' + filename
        fs.rename(file.path, new_loc, (err) => {
          if (err) throw err;
        });


        // update avatar in session
        if (fname == 'avatar') {
          sess.authUser.avatar = filename;

          // update filename to DB
          let col = db.collection('accounts');
          col.updateOne({ _id: ObjectId(sess.authUser.uid) },
            { $set: { avatar: filename } }, (err, r) => {
              if (err) {
                console.log("error updating account:", sess.authUser.email);
              } else {
                console.log("Update avatar successful:", sess.authUser.email);
              }
            });
        }

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
      // console.log('photos(json):',photos)
    });
  });

};
