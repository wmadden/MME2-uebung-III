/** Main app for server to start a small REST API for tweets
 * The included ./blackbox/store.js gives you access to a "database" which contains
 * already tweets with id 101 and 102, as well as users with id 103 and 104.
 * On each restart the db will be reset (it is only in memory).
 * Best start with GET http://localhost:3000/tweets to see the JSON for it
 *
 * @author Johannes Konert
 * @licence CC BY-SA 4.0
 *
 */
"use strict";

// node module imports
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');

// own modules imports
var store = require('./blackbox/store.js');


// creating the server application
var app = express();

// Middleware ************************************
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// logging
app.use(function(req, res, next) {
    console.log('Request of type '+req.method + ' to URL ' + req.originalUrl);
    next();
});

// API-Version control. We use HTTP Header field Accept-Version instead of URL-part /v1/
app.use(function(req, res, next){
    // expect the Accept-Version header to be NOT set or being 1.0
    var versionWanted = req.get('Accept-Version');
    if (versionWanted !== undefined && versionWanted !== '1.0') {
        // 406 Accept-* header cannot be fulfilled.
        res.status(406).send('Accept-Version cannot be fulfilled').end();
    } else {
        next(); // all OK, call next handler
    }
});

// request type application/json check
app.use(function(req, res, next) {
    if (['POST', 'PUT'].indexOf(req.method) > -1 &&
        !( /application\/json/.test(req.get('Content-Type')) )) {
        // send error code 415: unsupported media type
        res.status(415).send('wrong Content-Type');  // user has SEND the wrong type
    } else if (!req.accepts('json')) {
        // send 406 that response will be application/json and request does not support it by now as answer
        // user has REQUESTED the wrong type
        res.status(406).send('response of application/json only supported, please accept this');
    }
    else {
        next(); // let this request pass through as it is OK
    }
});


// Routes ***************************************

function JSONrepSingleElem(type, id){
    var element = store.select(type, id);
    var newElement = Object.assign({}, element);
    if (type == 'accounts') {
        newElement.tweets = [];
        for (var i = 0; i < element.tweets.length; i++)
        newElement.tweets.push(
            JSONrepSingleElem('tweets', element.tweets[i].id)
        );
    }
    if (type == 'tweets') {
        newElement.account = element.account.id;
    }
    return newElement;
}

function JSONrepCollection(type){
    var newElem = [];
    var elements = store.select(type);
    for(var i = 0; i < elements.length; i++){
        newElem.push(JSONrepSingleElem(type, elements[i].id));

    }
    return newElem;
}


app.get('/tweets', function(req,res,next) {
    res.json(JSONrepCollection('tweets'));
});

app.post('/tweets', function(req,res,next) {
    var tweet = req.body;
    tweet.account = store.select('accounts', tweet.account);
    var id = store.insert('tweets', tweet); // TODO check that the element is really a tweet!
    // set code 201 "created" and send the item back
    res.status(201).json(JSONrepSingleElem('tweets', id));
});


app.get('/tweets/:id', function(req,res,next) {
    res.json(JSONrepSingleElem('tweets', req.params.id));
});

app.delete('/tweets/:id', function(req,res,next) {
    store.remove(req.params.id);
    res.status(200).end();
});

app.put('/tweets/:id', function(req,res,next) {
    store.replace('tweets', req.params.id, req.body);
    res.status(200).end();
});

app.get('/accounts', function(req,res,next) {
    res.json(JSONrepCollection('accounts'));
});

app.post('/accounts', function(req,res,next) {
    var id = store.insert('accounts', req.body); // TODO check that the element is really a tweet!
    // set code 201 "created" and send the item back
    res.status(201).json(JSONrepSingleElem('accounts', id));
});


app.get('/accounts/:id', function(req,res,next) {
    res.json(JSONrepSingleElem('accounts', req.params.id));
});

app.delete('/accounts/:id', function(req,res,next) {
    store.remove('accounts', req.params.id);
    res.status(200).end();
});


// TODOs
// TODO: some HTTP  error responses in case not found
// TODO generate for each entity on response the proper href: .. property

// CatchAll for the rest (unfound routes/resources ********

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers (express recognizes it by 4 parameters!)

// development error handler
// will print stacktrace as JSON response
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        console.log('Internal Error: ', err.stack);
        res.status(err.status || 500);
        res.json({
            error: {
                message: err.message,
                error: err.stack
            }
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        error: {
            message: err.message,
            error: {}
        }
    });
});


// Start server ****************************
app.listen(3000, function(err) {
    if (err !== undefined) {
        console.log('Error on startup, ',err);
    }
    else {
        console.log('Listening on port 3000');
    }
});