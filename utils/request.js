'use strict';
const req  = require('https').request,
      aws4 = require('aws4');
function run(opts) {
  //EXPAND DEFAULTOPTS SO IT'S NOT OVERWRITTEN ACCESS METHOD CALLS
  const defaults = JSON.parse(JSON.stringify(run.defaultOpts)) || {};

  if (!defaults.region)  defaults.region  = process.env.AWS_DEFAULT_REGION;
  if (!defaults.headers) defaults.headers = {'Content-Type': 'application/x-amz-json-1.0'};

  //MERGING DEFAULTS AND OPTS
  Object.assign(opts, defaults);

  if (opts.service === 'sts') {
    delete opts.service;
    opts.host = `sts.${opts.region}.amazonaws.com`;
  }

  if (opts.body)   opts.body   = JSON.stringify(opts.body);
  if (opts.method) opts.method = opts.method.toUpperCase();

  opts = aws4.sign(opts);
  return new Promise((resolve, reject) => {
    req(opts, ((res) => {
      let chunk = '';
      res.on('data', (c) => chunk += c);
      res.on('end', ((_) => {

        try {
          chunk = JSON.parse(chunk);
        } catch (_err) { chunk = chunk; }

        if (!res.statusCode.toString().match(/2\d\d/)) {
          return reject({request: opts, response: chunk});
        }

        resolve(chunk);
      }));
    })).end(opts.body);
  });
}
run.defaults = ((defaultOpts) => {
  run.defaultOpts = defaultOpts;
  return run;
});
module.exports = run;
