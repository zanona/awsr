var request = require('../utils/request').defaults({service: 'sts'});
function assume(AWS_ID, roleName) {
    request({
        method: 'post',
        path: '/?Version=2011-06-15'
             + '&Action=AssumeRole'
             + '&RoleSessionName=cross-dev'
             + `&RoleArn=arn:aws:iam::${AWS_ID}:role/${roleName}`
             + '&DurationSeconds=3600'
    }).then((res) => {
        var key     = res.match(/<AccessKeyId>(.+)<\/AccessKeyId>/)[1],
            secret  = res.match(/<SecretAccessKey>(.+)<\/SecretAccessKey>/)[1],
            session = res.match(/<SessionToken>(.+)<\/SessionToken>/)[1];
        console.log(`export AWS_ACCESS_KEY_ID="${key}"`);
        console.log(`export AWS_SECRET_ACCESS_KEY="${secret}"`);
        console.log(`export AWS_SESSION_TOKEN="${session}"`);
    }).catch(console.error);
}
exports.assume = assume;
