var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/tictac";

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  db.createCollection("games", function(err, res) {
    if (err) throw err;
    console.log("Table games created!");
    db.close();
  });
  db.createCollection("daily_record", function(err, res) {
    if (err) throw err;
    console.log("Table daily_record created!");
    db.close();
  });
  db.createCollection("all_time_record", function(err, res) {
    if (err) throw err;
    console.log("Table all_time_record created!");
    db.close();
  });
});