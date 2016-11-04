#!/usr/bin/env node

var program = require('commander'),
    stdin = '';

program.version(require('./package.json').version);
program
    .command('apigateway:push <definition>')
    .description('Push API Gateway providing a Swagger definition')
    .option('-i --id <id>', 'The API ID')
    .action(function (definition, options) {
        require('./lib/apigateway').push(options.id, definition);
    });
program
    .command('lambda:push [file]')
    .description('Push JS or ZIP file with AWS Lambda.')
    .description('Accepts base64 zip file as STDIN as well')
    .option('-f --fn <function-name>', 'Lambda Function Name')
    .option('-a --alias [alias]', 'Version Alias')
    .action(function (filePath, options) {
      var fileData;
      if (stdin) fileData = stdin;
      if (!filePath && !fileData) return console.error('Missing zip file');
      const alias = typeof options.alias === 'string' ? options.alias : void 0;
      require('./lib/lambda').push(filePath, fileData, options.fn, alias);
    });
program
    .command('lambda:alias <alias>')
    .description('Alias latest version of a lambda function')
    .option('-f --fn <function-name>', 'Lambda Function Name')
    .option('-d --delete', 'Should delete alias')
    .action(function (alias, options) {
      require('./lib/lambda').alias(options.fn, alias, options.delete);
    });
program
    .command('lambda:approve <arn>')
    .description('Approve lambda invocation from source ARN')
    .option('-f --fn <function-name>', 'Lambda Function Name')
    .action(function (arn, options) {
        require('./lib/lambda').approve(arn, options.fn);
    });
program
    .command('sts:assume <aws_id:role>')
    .description('Assume new role based on persmission')
    .action(function (cmd) {
        require('./lib/sts').assume.apply(null, cmd.split(':'));
    });

if (process.stdin.isTTY) {
    program.parse(process.argv);
}
else {
    process.stdin.on('readable', function() {
        var chunk = this.read();
        if (chunk !== null) {
            stdin += chunk;
        }
    });
    process.stdin.on('end', function() {
        program.parse(process.argv);
    });
}
