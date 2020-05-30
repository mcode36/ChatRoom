/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

const expect = require('chai').expect;
const shortid = require("shortid");

// mongoose
const mongoose = require('mongoose');
mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);

const Schema = mongoose.Schema;
//const ObjectId = Schema.ObjectId;
const ObjectId = mongoose.Types.ObjectId;

//  _id, text, created_on(date&time), bumped_on(date&time, starts same as created_on), reported(boolean), delete_password, & replies(array).
const threadsSchema = new Schema({
  text: { type: String, required: true },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  reported: Boolean,
  delete_password: { type: String, required: true },
  replycount: { type: Number, default: 0 },
  replies: [] // replies: _id, text, created_on, delete_password, & reported
});

module.exports = (app) => {
  /// route for threads
  app.route('/api/threads/:board')
    .post((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema); // use board as collection's name
      const docInst = new Threads({
        text: req.body.text,
        reported: false,
        delete_password: req.body.delete_password
      });

      docInst.save((err, data) => {
        if (err) throw err;
        //console.log('insert:', data);
        res.redirect(`http://localhost:3000/b/${board}`)
      });

    })

    // API test: http://localhost:3000/api/threads/general
    .get((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);

      // ref: https://mongoosejs.com/docs/queries.html
      const callback = (err, data) => {
        if (err) throw err;
        // console.log('records found:', data.length);
        
        let return_array = data.map((d) => {
          let new_d = JSON.parse(JSON.stringify(d));
          new_d.replies = [];
          let number_of_replies = Math.min(3,d.replies.length)
          for(let i=0;i<number_of_replies;i++) { new_d.replies.push(d.replies.pop());}
          // console.log(new_d.replies);
          delete new_d.delete_password;
          delete new_d.reported;
          // console.log('new_d',new_d)
          return new_d;
        })

        res.send(return_array);
      }
      Threads.find({})
        .sort({ bumped_on: 'desc' })
        .limit(10)
        .exec(callback);
    })

    .put((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);
      const Replies = 
      Threads.findByIdAndUpdate(
        req.body.thread_id,
        { reported: true },
        (err, data) => {
          if (err) throw err;
          //console.log('update successful.',data)
          res.send('success')
        });
    })

    .delete((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);
      Threads.findById(req.body.thread_id, (err, data) => {
        if (err) throw err;
        if (req.body.delete_password == data.delete_password) {
          Threads.deleteOne({ _id: data._id }, (err, data2) => { 
            if (err) throw err;
            // console.log('data2 deleted:',data2)
            res.send('success');
          });
        } else {
          res.send('incorrect password');
        }
      });
    });

  /// route for replies
  app.route('/api/replies/:board')
    .post((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);
      // input Fields : 'board' 'thread_id' 'text' 'delete_password'
      let thread_id = req.body.thread_id;
      Threads.findById(thread_id, (err, data) => {
        if (err) throw err;
        let db_replies = JSON.parse(JSON.stringify(data.replies));
        let current_time = new Date();
        //console.log('before:',db_replies,'type:',typeof db_replies)
        let new_reply = {
          _id: shortid.generate(),
          text: req.body.text,
          created_on: current_time,
          delete_password: req.body.delete_password,
          reported: false
        };
        db_replies.push(new_reply);
        //console.log('new_reply:',new_reply);
        //console.log('after:',db_replies);
        Threads.findByIdAndUpdate(
          thread_id,
          { $set: { replies: db_replies, 
            replycount: db_replies.length,
            bumped_on: current_time } 
          },
          (err, data) => {
            if (err) throw err;
            //console.log(data)
            res.redirect(`http://localhost:3000/b/${board}/${thread_id}`)
          });
      });
    })

    // /api/replies/{board}?thread_id={thread_id}
    .get((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);
      let thread_id = req.query.thread_id;
      // console.log('thread_id',thread_id)
      Threads.findById(thread_id, (err, data) => {
        if (err) throw err;
        let new_data = JSON.parse(JSON.stringify(data));
        delete new_data.delete_password;
        delete new_data.reported;
        let replies = JSON.parse(JSON.stringify(new_data.replies));
        let new_replies = replies.map((reply) => {
          delete reply.delete_password;
          delete reply.reported;
          return reply;
        });
        new_data.replies = new_replies;
        // console.log('new_data:',new_data);
        res.send(new_data);
      });
    })

    .put((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);
      let thread_id        = req.body.thread_id;
      let reply_id         = req.body.reply_id;
      let return_msg       = 'unknown error updating reply';
      
      Threads.findById(thread_id, (err, data) => {
        if (err) throw err;
        let replies = JSON.parse(JSON.stringify(data.replies));
        let changed = false;

        let new_replies = replies.map((reply) => {
          if (reply_id == reply._id) {
            reply.reported = true;
            changed = true;
          }
          return reply;
        });

        if (changed) {
          Threads.findByIdAndUpdate(
            thread_id,
            { $set: { replies: new_replies } },
            (err, data) => {
              if (err) throw err;
            });
          return_msg = 'success';
        }
        res.send(return_msg);
      });
    })

    // input: thread_id, reply_id, & delete_password
    .delete((req, res) => {
      const board = req.params.board;
      const Threads = mongoose.model(board, threadsSchema);

      let thread_id        = req.body.thread_id;
      let reply_id         = req.body.reply_id;
      let delete_password  = req.body.delete_password;
      let return_msg       = 'unknown error deleting reply';
      
      Threads.findById(thread_id, (err, data) => {
        if (err) throw err;
        let replies = JSON.parse(JSON.stringify(data.replies));
        let changed = false;
        let new_replies = replies.map((reply) => {
          if ( reply_id == reply._id) {
            if (delete_password == reply.delete_password) {
              reply.text = '[deleted]';
              changed = true;
              return_msg = 'success';
            } else {
              return_msg = 'incorrect password'; 
            }
          }
          return reply;
        })
        if (changed) {
          Threads.findByIdAndUpdate(
            thread_id,
            { $set: { replies: new_replies } },
            (err, data) => {
              if (err) throw err;
            });
        }
        res.send(return_msg)
      });
    });

    /// backdoors, for debug purposes
    app.get('/api/cleanAll',(req, res) => {
      const Threads = mongoose.model('test', threadsSchema);
      Threads.deleteMany({ }, function (err) {
        if (err) throw err;
        res.send('Successfully delete all records in tests')
      });
    });

};
