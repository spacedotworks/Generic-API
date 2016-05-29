var request = require('request');
var cheerio = require('cheerio');
var constants = require('../constants');

var crossword = {

  getSolution: function(req, res, done) {
    var text = req.query.text;
    var pattern = req.query.pattern;
    var qs = {c0:text, p0:pattern};
    var j = constants.CROSSWORD_URLS.length;
    for (i=0;i<j;i++) {
      var url = constants.CROSSWORD_URLS[i];
      this._scrape(url, qs, (e, r) => {
        done(null, r);
      });
    }

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
          result.count = $(this).find('img').length;
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
