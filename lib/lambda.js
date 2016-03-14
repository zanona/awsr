/*jslint node:true*/
var request = require('../utils/request').defaults({ service: 'lambda' });
function push(zipPath, fnName) {
    var fs = require('fs');
    request({
        method: 'put',
        path: `/2015-03-31/functions/${fnName}/code`,
        body: { ZipFile: fs.readFileSync(zipPath, 'base64') }
    }).then(console.log).catch(console.error);
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
exports.invoke = invoke;
