var request = require('request');
var cheerio = require('cheerio');
var constants = require('../constants');

var crossword = {

  getSolution: function(req, res, db, done) {
    var uid = req.query.uid;
    var text = req.query.text;
    var pattern = this._parsePattern(req.query.pattern);
    var qs = {c0:text, p0:pattern};
    this._getUsage(db, uid, (e, r) => {
      if (e || r == 0) {
        return done('limit reached');
      };
      this._checkDB(qs, db, (e, r) => {
        if (e) {
          return done(e);
        } else if (r) {
        // database entry exists
          return done(null, r);
        } else {
        // scrape from URL list
          var j = constants.CROSSWORD_URLS.length;
          var i = 0;
          var url = constants.CROSSWORD_URLS;
          this._scrape(url[i], qs, (e, qr) => {
            if (e) {
              this._scrape(url[i+1], qs, (q, qr) => {
                if (e) {
                  return done('please try again');
                } else {
                  this._writeQuery(db, qs);
                  this._writeSolution(db, qs, qr);
                  return done(null, qr);
                }
              });
            } else {
              done(null, qr);
              this._writeQuery(db, qs);
              this._writeSolution(db, qs, qr);
              return;
            }
          });
        }
      });
    });
  },

  _writeSolution: function(db, qs, results) {
    let result;
    while (result = results.pop()) {
      db.collection(constants.COL_CROSSWORD_SOLUTIONS).update(
        {
          text: result,
        },
        {
          $addToSet: {
            terms: qs.c0
          }
        },
        {
          upsert: true,
          multi:true,
        }
      , (e, r) => {
      });
    }
  },

  _writeQuery: function(db, qs) {
    db.collection(constants.COL_CROSSWORD_QUERIES).update(
      {
        clue: qs.c0
      },
      {
        $addToSet: {
          pattern: qs.p0
        }
      },
      {
        upsert: true,
      }
    , (e, r) => {
    });
  },

  _parsePattern: function(pattern) {
    let singleSymbol = pattern.replace(/[_?!*#$]/g,".");
    let dotted = singleSymbol.replace(/([0-9]+)/g, function(x) {
      return ".".repeat(x);
    });
    let parsed = dotted.toUpperCase();
    return parsed;
  },

  _checkDB: function(qs, db, done) {
    db.collection(constants.COL_CROSSWORD_QUERIES).findOne({
      clue: qs.c0,
      pattern: qs.p0
    }, (err, doc) => {
      if (err || doc == null) {
        return done(err);
      }
      if (doc) {
        db.collection(constants.COL_CROSSWORD_SOLUTIONS).find({
          text: new RegExp('^' + qs.p0 + '$'),
          $text: {$search: qs.c0},
        }).toArray((e, doc) =>{
          let results = [];
          doc.forEach(function(row) {
            results.push(row.text);
          })
          return done(null, results);
        });
      }
      //done(null, null);
    });
  },

  _scrape: function(url, qs, done) {
    var results = [];
    request({
      url:url,
      qs:qs
    }, (e, r, b) => {
      if (e || r.statusCode == '404') {
        return done(e);
      }
      $ = cheerio.load(b);
      var rows = $('#myform table table[cellpadding=6]').find('tr');
      rows.each(function(i, elem) {
        if ($(this).find('img').length > 0) {
          results.push($(this).find('a').text());
        }
      });
      done(null, results);
    });
  },

  _getUsage: function(db, uid, done) {
    if (uid == constants.CROSSWORD_PRO_UID) {
      return done(null, 1);
    }
    db.collection(constants.COL_CROSSWORD_USAGE).update(
    {
      uid: uid,
      count: {
        $lt: 18
      }
    },
    {
      $inc: {
        count: 1
      }
    },
    {
      upsert: true
    }, (e, r) => {
      if (e) {
        done(e)
      } else {
        done(null, r.result.n);
      }
    });
  }
};

module.exports = {crossword: crossword}
