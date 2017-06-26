console.log("Twitter bot running...")

var Twit = require('twit')
const conf = require('./config')
const emo = require('./emoji.json')
const inputs = require('./inputs')
const lines = require('./lines')
var T = new Twit(conf.tokens)
var stream = T.stream('user')

var mongo = require('mongodb').MongoClient,
  assert = require('assert')
var url = 'mongodb://localhost:27017/tictac'
var db = null
var games = null
var daily = null
var all_time = null
// var service_off = false

mongo.connect(url, function(err, database) {
	if (err) throw err;
	db = database
	games = db.collection('games')
	daily = db.collection('daily_record');
	all_time = db.collection('all_time_record');
	start_twitter()
  })

function start_twitter(){
	stream.on('tweet',handle_tweet)
}

function handle_msg

function handle_tweet(msg){
	if (msg.user.screen_name==conf.my_user) return
	var tweet_id = msg.id_str;
	// if(service_off){
	// 	tweet_it(`⚠: Service is temporary offline due to maintenance. Sorry for the inconveniences.\n@${msg.user.screen_name}`,tweet_id)
	// 	return
	// }
	// if (msg.user.screen_name==conf.admin){
	// 	if (msg.text.toLowerCase().contains('off')) {
	// 		service_off=true
	// 		return
	// 	}else if(msg.text.toLowerCase().contains('on')){
	// 		service_off=false
	// 		return
	// 	}
	// }
	if (msg.entities.user_mentions.length==1){
		tweet_it(`Hello, @${msg.user.screen_name}!👋\n▶Would you like to play Tic-Tac-Toe with someone?😏\nJust mention him!`, tweet_id);
	}else if(msg.entities.user_mentions.length==2){
		var receiver = (msg.entities.user_mentions[0].screen_name != conf.my_user) ? msg.entities.user_mentions[0].screen_name : msg.entities.user_mentions[1].screen_name 
		var sender = msg.user.screen_name
		//order alphabetically to use as id
		id = (receiver < sender) ? `${sender}_${receiver}` : `${receiver}_${sender}`
		//check if there is an entry 
		games.findOne({_id:id}, function(err, result) {
		    if (err) {
		    	error("gms_mong_entry_id", tweet_id, receiver, sender)
				return null
			}
		    if (result==null){
		    	games.insertOne({_id:id, game:[0,0,0,0,0,0,0,0,0], lines:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}, turn:receiver, accepted:1}, function(err, res) {
				    if (err) {
				    	error('gms_acc_1_challenge',tweet_id,receiver,sender)
				    }else{
				    	board = format_board([1,-1,1,-1,1,-1,-1,-1,1])
				    	tweet_it(`Hey @${receiver}!👋\n@${sender} has challenged you to a Tic-Tac-Toe game!🔥${board}\n▶Do you accept it? \nReply: [yes/no]`,tweet_id)
				    }
				})
		    }else{
		    	switch (result.accepted){
		    		case 1:{
		    			//check if its actually the other player
		    			if (sender!=result.turn) {return}
		    			//receiver accepts game
		    			var first = Math.random() >= 0.5 ? receiver : sender
		    			var acc = get_acceptance(msg.text)
		    			if(acc){
		    				games.updateOne({_id:id}, {game:[0,0,0,0,0,0,0,0,0], lines:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}, turn:first, mark:1, accepted:2}, function(err, res) {
							    if (err) {
							    	error("gms_acc_2_accepted",tweet_id,receiver,sender)
							    }else{
							    	board = format_board(result.game)
							    	symbol = result.mark == 1 ? emo.x : emo.o
		    						tweet_it(`🚨🔥Let's play!🔥🚨\n➡@${first}[${symbol}] goes first!\n▶Reply with a number of the board: ${board} \n@${receiver} @${sender}`,tweet_id)
							    }
						  	})
		    			}
		    			else if(acc!=null){
		    				games.deleteOne({_id:id}, function(err, obj) {
							    if (err) {
							    	error('gms_acc_0_del',receiver,sender)
							    }else{
							    	tweet_it(`▶@${sender} refused the challenge. 🐔🐓👎🙄 \n@${receiver}`, tweet_id);
							    }
							})	
		    			}
		    			else{
		    				// Acceptance different from yes or no
		    				warning("Reply to the challenge with yes or no, please.",tweet_id,sender)
		    			}
		    			break
		    		}
		    		case 2:{
		    			win=false
		    			if (sender!=result.turn){
		    				warning("Not your turn.",tweet_id, sender)
		    			 	return //check if challenged user is the one replying
		    			}
		    			//users playing
		    			res = get_response(msg.text)
		    			if (res!=null) {
		    				if(result.game[res-1] == 0){
		    					result.game[res-1] = result.mark //make move on board
		    					for (l in lines[res]){ //remove/update possible winning lines
		    						if (lines[res][l] in result.lines) { //if the line is still there...
		    							if ( result.lines[lines[res][l]]!=0 && ((result.lines[lines[res][l]]<0) != (result.mark<0)) ) { //if line was already played, delete it
		    								delete result.lines[lines[res][l]]
		    							}else{
		    								result.lines[lines[res][l]] += result.mark	//update line
		    								if (result.lines[lines[res][l]]==3 || result.lines[lines[res][l]]==-3) {
		    									win=true
												break //breaks for
		    								}
		    							}
		    						}
		    					}
		    					if (win) {
		    						games.updateOne({_id:id},{game:[0,0,0,0,0,0,0,0,0], lines:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}, turn:'', accepted:0}, function(err, res_mong) {
									    if (err) {
									    	error('gms_acc_0_win',tweet_id,receiver,sender)
									    	return
									    }else{
									    	//register winner (daily and all_time)
									    	register_record(sender,1)
									    	register_record(receiver,0)
									    	board = format_board(result.game)
									    	tweet_it(`🏆@${sender}🏆 is the WINNER!\n🎉👏💪🎊${board}\nWant to play again? \nBoth need to reply: [yes/no] \n@${receiver}`,tweet_id)
									    }
									})
		    					}
		    					else if (Object.keys(result.lines).length==0) {
		    						games.updateOne({_id:id},{game:[0,0,0,0,0,0,0,0,0], lines:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}, turn:'', accepted:0}, function(err, res_mong) {
									    if (err) {
									    	error('gms_acc_0_draw',tweet_id,receiver,sender)
									    }else{
									    	board = format_board(result.game)
									    	tweet_it(`💈Looks like it's a DRAW!💈😤 ${board}\n▶Want to play again?😏\nBoth need to reply: [yes/no] \n@${receiver} @${sender}`,tweet_id)
									    }
									})
		    					}else{
		    						var newMark = result.mark == 1 ? -1 : 1
		    						games.updateOne({_id:id},{game:result.game, lines:result.lines, turn:receiver, mark:newMark, accepted:2}, function(err, res_mong) {
									    if (err) {
									    	error('gms_acc_2_play',tweet_id,receiver,sender)
									    }else{
									    	var board = format_board(result.game)
									    	symbol = newMark == 1 ? emo.x : emo.o
									    	tweet_it(`🔥@${sender} plays square ${emo[res]}🔥\n▶@${receiver}[${symbol}], it's your turn... ${board}`,tweet_id)
									    }
									})
		    					}		
		    				} else{
		    					warning(`That square is already taken [${sender}].`,tweet_id,sender,receiver)
		    				}
		    			}else{
		    				warning('Please reply with a valid square',tweet_id,sender,receiver)
		    			}
		    			break
		    		}
		    		default:{
		    			//anothe game
		    			acc = get_acceptance(msg.text)
		    			if (acc) {
			    			//accepted another game
			    			games.updateOne({_id:id},{game:[0,0,0,0,0,0,0,0,0], lines:{1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}, turn:receiver, mark:1, accepted:1}, function(err, res) {
							    if (err) {
							    	error('gms_acc_1_first',tweet_id,receiver,sender)
							    }else{
							    	var board = format_board(result.game)
							    	tweet_it(`🎮@${sender} wants to play again!🎮\n▶Waiting for @${receiver}... 👀\nReply: [yes/no]`,tweet_id)
							    }
							})
		    			}else if(acc==false){
		    				games.deleteOne({_id:id}, function(err, obj) {
							    if (err) {
							    	error('gms_acc_0_del',receiver,sender)
							    }else{
							    	tweet_it(`▶@${sender} refused the challenge. 🐔🐓👎🙄\n@${receiver}`, tweet_id);
							    }
							})
		    			}	
		    			break
		    		}
		    	}
		    }
		})
	}
}

function register_record(id,option){
	if (option==1) { //win
		daily_record.findOne({_id:id}, function(err, result) {
			if (err) {}
			else if(result!=null){
				daily.updateOne({_id:id},{wins:result.wins+1,loses:result.loses}, function(err, res_mong) {
				})
			}else{
				daily.insertOne({_id:id, wins:1, loses:0}, function(err, res) {
				})
			}
		})
		all_time.findOne({_id:id}, function(err, result) {
			if (err) {}
			else if(result!=null){
				all_time.updateOne({_id:id},{wins:result.wins+1,loses:result.loses}, function(err, res_mong) {
				})
			}else{
				all_time.insertOne({_id:id, wins:1, loses:0}, function(err, res) {
				})
			}
		})
	}else{// lose
		daily_record.findOne({_id:id}, function(err, result) {
			if (err) {}
			else if(result!=null){
				daily.updateOne({_id:id},{wins:result.wins,loses:result.loses+1}, function(err, res_mong) {
				})
			}else{
				daily.insertOne({_id:id, wins:0, loses:1}, function(err, res) {
				})
			}
		})
		all_time.findOne({_id:id}, function(err, result) {
			if (err) {}
			else if(result!=null){
				all_time.updateOne({_id:id},{wins:result.wins,loses:result.loses+1}, function(err, res_mong) {
				})
			}else{
				all_time.insertOne({_id:id, wins:0, loses:1}, function(err, res) {
				})
			}
		})
	}
}

function tweet_it(txt, tweet_id=null){
	obj = {
		status: txt
	}
	if (tweet_it!=null) obj.in_reply_to_status_id = tweet_id
	T.post('statuses/update', obj, function(err, data, response) {
		if (err) {
			console.log(data)
		}
		else{
			//sent
		}
	})
}

function get_acceptance(txt){
	txt = txt.toLowerCase()
	if (txt.includes("yes")) {
		return true
	}else if (txt.includes("no")){
		return false
	}
	return null
}

function get_response(txt){
	txt = txt.toLowerCase()
	for (let inp in inputs){
		if (txt.includes(inp)) {
			return inputs[inp]
		}
	}
	return null
}

function format_board(game){
	let s = "\n|"
	for (var x = 0; x < 9; x++) {
		if (x==3 || x==6) s+="\n|"
		switch (game[x]){
			case 1:{
				s+=`${emo.x}|`
				break
			}
			case -1:{
				s+=`${emo.o}|`
				break
			}
			default:{
				s+=`${emo[x+1]}|`
				break
			}
		}
	}
	return s
}

function error(code, tweet_id,receiver,sender){
	tweet_it(`😓: Something went wrong. Please contact the administrator. \nError code: ${code} \n@${receiver} @${sender}`, tweet_id)
}

function warning(txt,tweet_id,sender,receiver=null){
	s=`⚠ Warning: ${txt} \n@${sender}`
	s+= receiver!=null ? ` @${receiver}` : ''
	tweet_it(s,tweet_id)
}

function exit(){
	db.close()
	process.exit()
}
