const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const hbs = require('express-handlebars');
const fileUpload = require('express-fileupload');
const db = require('./config/connection');

//Session required and Assigned to variable session
const session = require('express-session');

//Route Variable Assigning
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.engine('hbs',hbs.engine({extname:'hbs',defaultLayout:'layout',layoutsDir:__dirname+'/views/layout/',partialsDir:__dirname+'/views/partials/',
  helpers:{
    increment:function(value,option){
       return parseInt(value)+1;
    }
  }
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//Used for move files
app.use(fileUpload());

//session management
app.use(session({secret:"key",resave:false,saveUninitialized:false,cookie:{maxAge:800000}}))
app.use((req, res, next) => {
  res.set('Cache-Control','no-cache,private,no-store,must-revalidate,max-stale=0,post-check=0,pre-check=0')
  next()
})

//Database Connection
db.connect((err)=>{
  if(err) console.log("Conncetion Error");
  else console.log("Database Connected Successfully");
})

//Route Setting
app.use('/', usersRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
 
  res.render('error',{user:true});
  
  
  
  
});

module.exports = app;
