'use strict';

const express     = require('express');
const session     = require('express-session');
const bodyParser  = require('body-parser');
const helmet      = require('helmet');


var apiRoutes     = require('./routes/api.js');

// App setup
const SECRET_KEY = 'Pjd*j$ljs^jdgQhgdlP0%';

var app = express();
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/uploads', express.static(process.cwd() + '/uploads'));

app.use(session({secret: SECRET_KEY, saveUninitialized: true, resave: true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// helmet
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.dnsPrefetchControl());
app.use(helmet.referrerPolicy({ policy: 'same-origin' }))

// Routing for API 
apiRoutes(app);

    
//404 Not Found Middleware
app.use((req, res, next) => {
  res.status(404)
    .type('text')
    .send('Not Found');
});

//Start our server and tests!

app.listen(process.env.PORT,  () => {
  console.log("Listening on port " + process.env.PORT);
  if(process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout( () => {
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
