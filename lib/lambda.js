var request = require('../utils/request').defaults({ service: 'lambda' }),
    fs = require('fs');

function getFunctionVersion(fnName) {
  return request({
    method: 'get',
    path:  `/2015-03-31/functions/${fnName}`
  }).then((r) => r.Configuration.Version);
}
function deleteAlias(alias, fnName) {
  return request({
    method: 'delete',
    path:  `/2015-03-31/functions/${fnName}/aliases/${alias}`
  });
}
function updateAlias(alias, fnName, version) {
  return request({
    method: 'put',
    path:  `/2015-03-31/functions/${fnName}/aliases/${alias}`,
    body: { FunctionVersion: version }
  }).catch(() => {
    return request({
      method: 'post',
      path:  `/2015-03-31/functions/${fnName}/aliases`,
      body: {
        Name: alias,
        FunctionVersion: version
      }
    });
  });
}
function updateVersion(fnName) {
  return request({
    method: 'POST',
    path:  `/2015-03-31/functions/${fnName}/versions`
  }).then((r) => r.Version);
}
function pushLambda(fnName, data, path) {
  return request({
    method: 'put',
    path:  `/2015-03-31/functions/${fnName}/code`,
    body:   { ZipFile: data || fs.readFileSync(path, 'base64') }
  });
}

function push(zipPath, zipData, fnName, alias) {
  /*
  request({
    method: 'put',
    path:  `/2015-03-31/functions/${fnName}/configuration`,
    body:   { Timeout: 3 }
  })
  */
  pushLambda(fnName, zipData, zipPath).then((r) => {
    if (alias) {
      return updateVersion(fnName).then((version) => updateAlias(alias, fnName, version));
    } else {
      return r;
    }
  }).then(console.log).catch(console.error);
}
function manageAlias(fnName, alias, shouldDelete) {
  if (shouldDelete) {
    return deleteAlias(alias, fnName);
  } else {
    return getFunctionVersion(fnName).then((version) => {
      return updateAlias(alias, fnName, version);
    });
  }
}

function invoke(ARN, fnName) {
  var id = ARN.split(':').reverse()[0];
  request({
    method: 'post',
    path: `/2015-03-31/functions/${fnName}/policy/`,
    body: {
      Action:      'lambda:InvokeFunction',
      Principal:   'apigateway.amazonaws.com',
      SourceArn:   ARN,
      StatementId: `${id}_${fnName}` //unique name for permission
    }
  }).then(console.log).catch(console.error);
}
exports.push = push;
exports.alias = manageAlias;
exports.invoke = invoke;
