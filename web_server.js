var http = require('http');
var server = http.createServer();
var mysql = require('sync-mysql');
var db = new mysql({
	host:'localhost',
	user:'root',
	password:'password',
	database:'meeseeks'
});

if(db){
	console.log("Database Connected to 'meeseeks'");
}

var trade_log

server.addListener('request', function(request, response){
	console.log('requested...');
	console.log(trade_log);
	response.writeHead(200, {'Content-Type':'text/plain'});
	response.write('Hello nodejs');
	response.end();
});

server.addListener('connection', function(socket){
	console.log('connected...');

	trade_log = db.query('SELECT * FROM trade_log');
});

server.listen(8888);
