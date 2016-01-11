var path = require('path');
var express = require('express');
var webpack = require('webpack');
var config = require(path.join(__dirname, 'webpack.config'));

var app = this.app = new express();
var compiler = webpack(config);
var devMiddleware = require('webpack-dev-middleware')(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath
})

app.use(this.middleware = devMiddleware);

app.use(require('webpack-hot-middleware')(compiler));

app.get('*', function(req, res) {
  /*eslint-disable */
  var index = this.middleware.fileSystem.readFileSync(path.join(config.output.path, 'index.html'));
  /*eslint-enable */
  res.end(index);
}.bind(this));

app.listen(3001, 'localhost', function(err) {
  if (err) {
    console.log('err');
    return;
  }

  console.log('Listening at http://localhost:3001');
});
