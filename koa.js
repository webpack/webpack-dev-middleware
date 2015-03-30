var expressMiddleware = require('./middleware');

function middleware(doIt, req, res) {
  var originalEnd = res.end;

  return function(done) {
    res.end = function() {
      originalEnd.apply(this, arguments);
      done(null, 0);
    };
    doIt(req, res, function() {
      done(null, 1);
    })
  }
}

module.exports = function(compiler, option) {
  var doIt = expressMiddleware(compiler, option);
  return function* (next) {
    var ctx = this;
    var req = this.req;
    var runNext = yield middleware(doIt, req, {
      end: function(content) {
        ctx.body = content;
      },
      setHeader: function() {
        ctx.set.apply(ctx, arguments);
      }
    });
    if (runNext) {
      yield* next;
    }
  };
};