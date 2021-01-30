var express  = require('express');
var app      = express();
var fs       = require('fs');
var fsx       = require('fs-extra');
var server = require('http').createServer(app);
var options = {
  key: fs.readFileSync('cert/deepblack_info.key.pem'),
  cert: fs.readFileSync('cert/deepblack_info.crt.pem'),
  ca: fs.readFileSync('cert/RootChain/rsa-dv.chain-bundle.pem')
};
var serverHttps = require('https').createServer(options, app);
var io = require('socket.io').listen(serverHttps);
var router   = express.Router();
var path     = require('path');
var passport = require('passport');
var session  = require('express-session');
var redis = require("redis");
var RedisStore = require('connect-redis')(session);
var client  = redis.createClient(6379);
var clients = [];
var flash    = require('connect-flash');
var async    = require('async');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser   = require('cookie-parser');
var LocalStrategy = require('passport-local').Strategy;
var nodemailer = require('nodemailer');
var formidable = require('formidable');
var util     = require('util');
var contentDisposition = require('content-disposition');
var mongoose = require('mongoose');
var mongojs = require('mongojs');
var trade = mongojs('goose',['save']);
var balance = mongojs('goose',['check']);
var form = mongojs('goose',['post']);
var msg = mongojs('goose',['chat']);
var money = mongojs('goose',['account']);
var saving = mongojs('goose',['history']);
var lotto = mongojs('goose',['pick']);
var comments = mongojs('goose',['comment']);
var upload = mongojs('goose',['uploads']);
var comment = mongojs('goose',['comments']);//gallery
var countImg = mongojs('goose',['imageCount']);
var list = mongojs('goose',['calendar']);
var host = "52.78.182.1";
var date = require('date-utils');
var request = require('request-promise');



var bcrypt = require("bcrypt-nodejs");
var userSchema = mongoose.Schema({
  email: {type:String, required:true, unique:true},
  nickname: {type:String, required:true},
  password: {type:String, required:true},
  class : {type:String},
  channel : {type:String},
  chat : {type:String},
  createdAt: {type:Date, default:Date.now}
});
userSchema.pre("save", function (next){
    var user = this;
    if(!user.isModified("password")){
      return next();
    } else{
      user.password = bcrypt.hashSync(user.password);
      user.class = "user";
      user.channel = "none";
      user.chat = "none";
      return next();
  }
});
userSchema.methods.authenticate = function (password) {
  var user = this;
  return bcrypt.compareSync(password,user.password);
};
var User = mongoose.model('user',userSchema);
mongoose.connect("mongodb://localhost/goose");
var db = mongoose.connection;
db.once("open",function () {
  console.log("DB connected!");
});
db.on("error",function (err) {
  console.log("DB ERROR :", err);
});
app.set("view engine", 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cookieParser());
app.use(methodOverride("_method"));
app.use(flash());
app.use(session({
  store: new RedisStore({ host: 'localhost', port: 6379, client: client}),
  secret:'goose',
  resave:false,
  saveUninitialized:true,
  cookie:{
    maxAge:365*24*60*60*1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());
function requireHTTPS(req,res,next){
  if(!req.secure){
    return res.redirect('https://'+req.get('host')+req.url);
  }
  next();
}
app.use(requireHTTPS);
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});
passport.use('local-login',
  new LocalStrategy({
      usernameField : 'email',
      passwordField : 'password',
      passReqToCallback : true
    },
    function(req, email, password, done) {
      User.findOne({ 'email' :  email }, function(err, user) {
        if (err) return done(err);

        if (!user){
            req.flash("email", req.body.email);
            return done(null, false, req.flash('loginError', 'No user found.'));
        }
        if (!user.authenticate(password)){
            req.flash("email", req.body.email);
            return done(null, false, req.flash('loginError', 'Password does not Match.'));
        }
        return done(null, user);
      });
    }
  )
);


app.get('/', function(req, res){
  balance.check.find({},function(er,bal){
    if(er) return res.json({success:false, message:er});
    if (bal) {
      trade.save.find({}).sort({'_id': -1}).limit(100,function (err,data) {
        if(err) return res.json({success:false, message:err});
        if(data){
          res.render("main/index", {user:req.user,data:data,bal:bal});
          console.log(bal);
        }else {
          res.render("main/index", {user:req.user,data:"nothing",bal:bal});
        }
      });
    }else {
      trade.save.find({}).sort({'_id': -1}).limit(100,function (err,data) {
        if(err) return res.json({success:false, message:err});
        if(data){
          res.render("main/index", {user:req.user,data:data,bal:"nothing"});
        }else {
          res.render("main/index", {user:req.user,data:"nothing",bal:"nothing"});
        }
      });
    }
  });

});


app.get('/login', function (req,res) {
  res.render('login/login',{user:req.user, email:req.flash("email")[0], loginError:req.flash('loginError')});
});
app.post('/login', function (req,res,next){
    req.flash("email");
    if(req.body.email.length === 0 || req.body.password.length === 0){
      req.flash("email", req.body.email);
      req.flash("loginError","Please enter both email and password.");
      res.redirect('/login');
    } else{
      next();
    }
  }, passport.authenticate('local-login', {
    successRedirect : '/',
    failureRedirect : '/login',
    failureFlash : true
  })
);
app.get('/logout', isLoggedIn, function(req, res) {
    var update = {};
    update.channel="none";
    if(update.channel){
      User.findByIdAndUpdate(req.user._id,update,{multi:false},function(err,dat){
        if(err) return res.json({success:false, message:err});
      });
    }
    req.logout();
    res.redirect('/');
});
app.get('/signup', function(req,res){
  res.render('login/new', { user:req.user,
                            formData: req.flash('formData')[0],
                            emailError: req.flash('emailError')[0],
                            nicknameError: req.flash('nicknameError')[0],
                            passwordError: req.flash('passwordError')[0]
                          }
  );
});
app.post('/signup', checkUserRegValidation, function(req,res,next){
  User.create(req.body.user, function (err,user) {
    if(err) {
      req.flash("emailError","- Try Again");
      res.redirect('/signup');
    } else{
      res.redirect('/login');
      }
  });
});


app.use(function(req,res){
  res.render("main/404", {user:req.user});
});
function isLoggedIn(req, res, next){
  if (req.isAuthenticated()){
    return next();
  }
  res.redirect('/');
}
function checkUserRegValidation(req, res, next) {
  var isValid = true;
  async.waterfall(
    [function(callback) {
      User.findOne({email: req.body.user.email, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err,user){
          if(user){
            isValid = false;
            req.flash("emailError","- This email is already resistered.");
          }
          callback(null, isValid);
        }
      );
    }, function(isValid, callback) {
      User.findOne({nickname: req.body.user.nickname, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err,user){
          if(user){
            isValid = false;
            req.flash("nicknameError","- This nickname is already resistered.");
          }
          callback(null, isValid);
        }
      );
    }], function(err, isValid) {
      if(err) return res.json({success:"false", message:err});
      if(isValid){
        return next();
      } else{
        req.flash("formData",req.body.user);
        res.redirect("back");
      }
    }
  );
};
server.listen(80, function(){
  console.log('Http Server On!');
});
serverHttps.listen(443, function(){
  console.log('Https Server On!');
});
