'use strict';

/* 
Project Page: 
Live App: 
*/

const express     = require('express');
const bodyParser  = require('body-parser');
const expect      = require('chai').expect;
const cors        = require('cors');
const helmet = require('helmet');

// var apiRoutes         = require('./routes/api.js');
// var fccTestingRoutes  = require('./routes/fcctesting.js');
// var runner            = require('./test-runner');

var app = express();

app.use('/public', express.static(process.cwd() + '/public'));

app.use(cors({origin: '*'})); //For FCC testing purposes only

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
app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port " + process.env.PORT);
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
