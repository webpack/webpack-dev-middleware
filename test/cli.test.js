'use strict';

const testBin = require('./helpers/test-bin');

describe('CLI', () => {
  it('is testing default settings', (done) => {
    testBin('')
      .then((output) => {
        // existing settings by default
        expect(output.stdout.includes("logLevel: 'info'")).toEqual(true);
        expect(output.stdout.includes('logTime: false')).toEqual(true);
        expect(
          output.stdout.includes('watchOptions: { aggregateTimeout: 200 }')
        ).toEqual(true);
        expect(output.stdout.includes('writeToDisk: false')).toEqual(true);

        // non-existing settings by default
        expect(output.stdout.includes("methods: 'POST'")).toEqual(false);
        expect(
          output.stdout.includes("methods: [ 'POST', 'PUT', 'GET' ]")
        ).toEqual(false);
        expect(
          output.stdout.includes("headers: { 'X-Custom-Header': 'yes'")
        ).toEqual(false);
        expect(output.stdout.includes("index: 'index2.html'")).toEqual(false);
        expect(output.stdout.includes('lazy: true')).toEqual(false);
        expect(
          output.stdout.includes("publicPath: '/public/index.js'")
        ).toEqual(false);
        expect(output.stdout.includes('serverSideRender: true')).toEqual(false);
        done();
      })
      .catch(done);
  });

  it('--methods (single method)', (done) => {
    testBin('--methods POST')
      .then((output) => {
        expect(output.stdout.includes("methods: 'POST'")).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--methods (multiple methods)', (done) => {
    testBin('--methods POST --methods PUT --methods GET')
      .then((output) => {
        expect(
          output.stdout.includes("methods: [ 'POST', 'PUT', 'GET' ]")
        ).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--headers', (done) => {
    testBin('--headers.X-Custom-Header yes')
      .then((output) => {
        expect(
          output.stdout.includes("headers: { 'X-Custom-Header': 'yes'")
        ).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--index', (done) => {
    testBin('--index index2.html')
      .then((output) => {
        expect(output.stdout.includes("index: 'index2.html'")).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--lazy', (done) => {
    testBin('--lazy')
      .then((output) => {
        expect(output.stdout.includes('lazy: true')).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--logLevel', (done) => {
    testBin('--logLevel debug')
      .then((output) => {
        expect(output.stdout.includes("logLevel: 'debug'")).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--logTime', (done) => {
    testBin('--logTime')
      .then((output) => {
        expect(output.stdout.includes('logTime: true')).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--publicPath', (done) => {
    testBin('--publicPath /public/index.js')
      .then((output) => {
        expect(
          output.stdout.includes("publicPath: '/public/index.js'")
        ).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--serverSideRender', (done) => {
    testBin('--serverSideRender')
      .then((output) => {
        expect(output.stdout.includes('serverSideRender: true')).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--watchOptions', (done) => {
    testBin('--watchOptions.aggregateTimeout 500')
      .then((output) => {
        expect(
          output.stdout.includes('watchOptions: { aggregateTimeout: 500 }')
        ).toEqual(true);
        done();
      })
      .catch(done);
  });

  it('--writeToDisk', (done) => {
    testBin('--writeToDisk')
      .then((output) => {
        expect(output.stdout.includes('writeToDisk: true')).toEqual(true);
        done();
      })
      .catch(done);
  });
});
