var Twit = require('twit')
const conf = require('./config')
var T = new Twit(conf.tokens)
i=0
tweets = null
T.get('statuses/user_timeline', { screen_name: conf.my_user, count: 100 }, function(err, data, response) {
  tweets=data
  handle()
})

function handle(){
	if(i<tweets.length-1){
		console.log(tweets[i].id_str)
		borrar(tweets[i].id_str)
		i+=1
	}
}

function borrar(tweet_id){
	T.post('statuses/destroy/:id', { id:tweet_id}, function (err, data, response) {
	  if(err){
	  	console.log(data)
	  }else{
	  	console.log("DELETED: "+data.text)
	  }
	  handle()
	})
}