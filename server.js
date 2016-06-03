'use strict'

var express = require("express");
var path = require("path");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;
var fs = require('fs');
var constants = require('./constants');
var schedule = require('node-schedule');

var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded());

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(constants.MONGODB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Ensure indexes
  database.collection(constants.COL_USERS).createIndex({androidId:1},{unique:true});
  database.collection(constants.COL_CROSSWORD_SOLUTIONS).createIndex({terms:"text"});
  database.collection(constants.COL_CROSSWORD_SOLUTIONS).createIndex({text:1});
  database.collection(constants.COL_CROSSWORD_USAGE).createIndex({uid:1},{unique: true});
  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Cron job to remove
  var cron = schedule.scheduleJob('0 55 16 * * *', function() {
    db.collection(constants.COL_CROSSWORD_USAGE).remove({});
  });

  // Initialize the app.
  var server = app.listen(process.env.PORT || 3000, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// API ROUTES BELOW

// error handler
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}

app.get("/users", function(req, res) {
  res.status(200);
});

app.post("/users", function(req, res) {
  var newUser = req.body;
  newUser.createDate = new Date();

  if (!(req.body.androidId)) {
    handleError(res, "Invalid body", "AndroidId missing.", 400);
    return;
  }

  db.collection(constants.COL_USERS).insertOne(newUser, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to create new contact.");
    } else {
     res.status(201).json(doc.ops[0]);
    }
  });
});

app.get("/slack/messages", function(req, res) {
  db.collection(constants.COL_SLACK_MESSAGES).find({}).toArray(function(err, docs) {
    if (err) {
      handleError(res, err.message, "Failed to get slack messages.");
    } else {
      res.status(200).json(docs);
    }
  });
});

app.post("/slack/message/save", function(req, res) {
  var newSlackMessage = req.body;
    console.log(req);
  newSlackMessage.createDate = new Date();

  if (!(req.body.user_name || req.body.text || req.body.token)) {
    handleError(res, "Invalid body", "Not a valid request.", 400);
  }

  db.collection(constants.COL_SLACK_MESSAGES).insertOne(newSlackMessage, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to save message.");
    } else {
      res.json({
        response_type: "in_channel",
        text: "message by @" + req.body.user_name + " saved."
      });
    }
  });
});

app.get("/crossword/solve", function(req, res){
  if (!(req.query.text && req.query.pattern && req.query.uid)) {
    handleError(res, "Not a valid request", "Parameters missing");
  }
  var module = require("./controllers/crossword.js");
  module.crossword.getSolution(req, res, db, (err, data) => {
    if (err == 'limit reached') {
      res.status(400).json(JSON.stringify({message: 'Daily limit reached'}));
    } else if (err) {
      handleError(res, "Server is not responding", "Server is not responding", 500);
    } else {
      res.status(200).send(data.join("\n"));
    }
  });
});

