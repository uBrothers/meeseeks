var express  = require('express');
var app      = express();
var server = require('http').createServer(app);
var path     = require('path');
var contentDisposition = require('content-disposition');
var bodyParser     = require('body-parser');
var moment = require('moment');
var flash    = require('connect-flash');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser   = require('cookie-parser');
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

app.set("view engine", 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(flash());

app.get('/', function(req, res){
    var trade_log = db.query('SELECT * FROM trade_log ORDER BY date DESC');
    res.render("main/index",{data:trade_log, moment:moment});
});

server.listen(80, function(){
  console.log('Http Server On!');
});
