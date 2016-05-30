var request = require('request');
var cheerio = require('cheerio');
var constants = require('../constants');

var crossword = {

  getSolution: function(req, res, db, done) {
    var text = req.query.text;
    var pattern = this._parsePattern(req.query.pattern);
    var qs = {c0:text, p0:pattern};

    this._checkDB(qs, db, (e, r) => {
      if (e) {
        done(e);
      } else if (r) {
      // database entry exists
        done(null, r.solutions);
      } else {
      // scrape from URL list
        var j = constants.CROSSWORD_URLS.length;
        for (i=0;i<j;i++) {
          var url = constants.CROSSWORD_URLS[i];
          this._scrape(url, qs, (e, r) => {
            db.collection(constants.COL_CROSSWORD_SOLUTIONS).update(
            {clue: qs.c0},
            {"$push":
              {pattern: qs.p0},
             // adding to global solutions array
             "$addToSet":
              {solutions: {"$each": r}}
            },
            {upsert: true}
            );
            done(null, r);
          });
        }
      }
    });
  },

  _parsePattern: function(pattern) {
    upper = pattern.toUpperCase();
    singleSymbol = upper.replace(/[_?!*#$]/g,"_");
    underscored = singleSymbol.replace(/([0-9])/g, function(x) {
      return "_".repeat(x);
    });
    parsed = underscored.replace(/_+/g, function(x){
      return x.length;
    });
    return parsed;
  },

  _checkDB: function(qs, db, done) {
    db.collection(constants.COL_CROSSWORD_SOLUTIONS).findOne({
      clue: qs.c0,
      pattern: qs.p0
    }, function(err, doc) {
      if (err) {
        done(err);
      }
      else {
        done(null, doc);
      }
    });
  },

  _scrape: function(url, qs, done) {
    var results = [];
    request({
      url:url,
      qs:qs
    }, (e, r, b) => {
      if (e || r.statusCode == '404') {
        done(e);
      }
      $ = cheerio.load(b);
      var rows = $('#myform table table[cellpadding=6]').find('tr');
      var index = 0;
      rows.each(function(i, elem) {
        // only return rows with stars
        var result = {};
        if ($(this).find('img').length > 0) {
          result.text = $(this).find('a').text();
          result.count = 5 - $(this).find('img[width=11]').length;
          results[index] = result;
          index++;
        }
      });
      done(null, results);
    });
    return;
  },

  getUsage: function(req,res) {
    console.log(false);
  }
};

module.exports = {crossword: crossword}
