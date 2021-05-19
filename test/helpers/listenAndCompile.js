export default (app, compiler, done) => {
  let complete = 0;
  // wait until the app is listening and the done hook is called
  const progress = () => {
    complete += 1;
    if (complete === 2) {
      done();
    }
  };

  const listen = app.listen((error) => {
    if (error) {
      // if there is an error, don't wait for the compilation to finish
      return done(error);
    }

    return progress();
  });

  compiler.hooks.done.tap("wdm-test", () => progress());

  return listen;
};
