#!/usr/local/bin/node
var Twit = require('twit')
const conf = require('./config')
var T = new Twit(conf.tokens)
const emo = require('./emoji.json')
var mongo = require('mongodb').MongoClient,
  assert = require('assert')
var url = 'mongodb://localhost:27017/tictac'
var db = null
var winners = null
var loser = null

mongo.connect(url, function(err, database) {
	if (err) throw err;
	db = database
	daily = db.collection('daily_record');
	// all_time = db.collection('all_time_record');
	daily.find().sort({wins:-1}).limit(3).toArray(function(err, result) {
	    if (err) throw err;
    	winners = result
    	tweet_leaderboard()
	})
})

function tweet_leaderboard(){
	if (winners.length==0)  {
		process.exit() 
		db.close()
	}
	txt = `🏅🏆Today's leaderboard🏆🏅\n`
	let i = 1
	for (winner of winners){
		txt+=`\n${emo[i]})@${winner._id} ➡ ${winner.wins} wins`
		i+=1
	}
	T.post('statuses/update',{status:txt}, function(err, data, response) {
		if (err) {
			console.log(data)
		}
		search_losers()
	})
}

function search_losers(){
	daily.find().sort({loses:-1}).limit(3).toArray(function(err, res) {
    	if (err) throw err;
    	losers = res
    	tweet_losers()
	})
}

function tweet_losers(){
	if (losers.lenght==0) {
		process.exit() 
		db.close()
	}
	txt = `🗑💩Today's biggest losers💩🗑\n 	😂👎`
	let i = 1
	for (loser of losers){
		txt+=`\n${emo[i]})@${loser._id} ➡ ${loser.loses} loses`
		i+=1
	}
	T.post('statuses/update',{status:txt}, function(err, data, response) {
		if (err) {
			console.log(data)
		}
		daily.drop(function(err, delOk) {
		    if (err) throw err;
		    if (delOk) console.log("daily droped")
			db.close()
			process.exit(0)
		})
	})
}