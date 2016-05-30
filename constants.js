function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

define("CROSSWORD_URLS", [
  '',
]);
define("MONGODB_URI", "");
define("COL_USERS", "users");
define("COL_EARTHQUAKE", "earthquake");
define("COL_SLACK_MESSAGES", "slackMessages");
define("COL_CROSSWORD_SOLUTIONS", "crosswordSolutions");
