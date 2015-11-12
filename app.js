/** Main app for server to start a small REST API for tweets
 * The included ./blackbox/store.js gives you access to a "database" which contains
 * already tweets with id 101 and 102, as well as users with id 103 and 104.
 * On each restart the db will be reset (it is only in memory).
 * Best start with GET http://localhost:3000/tweets to see the JSON for it
 *
 * @author Johannes Konert, Sophie Wirth, Lena Meßmer
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

/** Because of the n:1 relationship between tweets and accounts a normal GET/PUT Request would fail,
 * due to endless recursion when looking up the objects. So the JSON rep methods replace the actual account
 * object in the tweet to just an id, etc.
* */

/** Takes a tweet and gives back it's JSON representation.
 *
 * @param {object} tweet
 * @returns {object} JSONrep of tweet
 */
function tweetJSON(tweet) {
    return Object.assign({}, tweet, {
        href: "http://localhost:3000/tweets/" + tweet.id,
        account: tweet.account.id,
        accounthref: "http://localhost:3000/accounts/" + tweet.account.id
    });
}

/** Takes an account and gives back it's JSON representation.
 *
 * @param {object} account
 * @returns {object} JSONrep of account
 */
function accountJSON(account) {
    return Object.assign({}, account, {
        tweetshref: "http://localhost:3000/accounts/" + account.id + "/tweets",
        tweets: tweetCollectionJSON(account.tweets),
        href: "http://localhost:3000/accounts/" + account.id
    });
}

/** Takes a tweet collection and gives back it's JSON representation.
 *
 * @param {Array} tweets
 * @returns {Array} JSONrep of tweets
 */
function tweetCollectionJSON(tweets) {
    return tweets.map(tweetJSON);
}

/** Takes an account collection and gives back it's JSON representation.
 *
 * @param {Array} accounts
 * @returns {Array} JSONrep of accounts
 */
function accountCollectionJSON(accounts) {
    return accounts.map(accountJSON);
}

app.get('/tweets', function(req,res,next) {
    var tweets = store.select('tweets');
    res.json(tweetCollectionJSON(tweets));
});

app.post('/tweets', function(req,res,next) {
    var tweet = req.body;
    /**
     * JSON rep of tweet just has an id for account, to prevent endless recursion,
     * so the tweet that is created in store has to be given the actual account object
     */
    tweet.account = store.select('accounts', tweet.account);
    var id = store.insert('tweets', tweet); // TODO check that the element is really a tweet!
    var storedTweet = store.select('tweets', id);
    // set code 201 "created" and send the item back
    res.status(201).json(tweetJSON(storedTweet));
});


app.get('/tweets/:id', function(req,res,next) {
    var tweet = store.select('tweets', req.params.id);
    res.json(tweetJSON(tweet));
});

app.delete('/tweets/:id', function(req,res,next) {
    store.remove('tweets', req.params.id);
    res.status(200).end();
});

app.put('/tweets/:id', function(req,res,next) {
    store.replace('tweets', req.params.id, req.body);
    res.status(200).end();
});

app.get('/accounts', function(req,res,next) {
    var accounts = store.select('accounts');
    res.json(accountCollectionJSON(accounts));
});

app.post('/accounts', function(req,res,next) {
    var id = store.insert('accounts', req.body); // TODO check that the element is really a tweet!
    // set code 201 "created" and send the item back
    var account = store.select('accounts', id);
    res.status(201).json(accountJSON(account));
});


app.get('/accounts/:id', function(req,res,next) {
    var account = store.select('accounts', req.params.id);
    res.json(accountJSON(account));
});

app.delete('/accounts/:id', function(req,res,next) {
    store.remove('accounts', req.params.id);
    res.status(200).end();
});

app.get('/accounts/:id/tweets', function(req,res,next) {
    var account = store.select('accounts', req.params.id);
    res.json(tweetCollectionJSON(account.tweets));
});

app.put('/accounts/:id', function(req,res,next) {
    store.replace('accounts', req.params.id, req.body);
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