#!/usr/bin/env node
var program = require('commander');
program.version(require('../package.json').version);
program
    .command('apigateway:push <definition>')
    .description('Push API Gateway providing a Swagger definition')
    .option('-i --id <id>', 'The API ID')
    .action(function (definition, options) {
        require('../lib/apigateway').push(options.id, definition);
    });
program
    .command('lambda:push <file>')
    .description('Push JS or ZIP file with AWS Lambda')
    .option('-f --fn <function-name>', 'Lambda Function Name')
    .action(function (file, options) {
        require('../lib/lambda').push(file, options.fn);
    });
program
    .command('lambda:approve <arn>')
    .description('Approve lambda invocation from source ARN')
    .option('-f --fn <function-name>', 'Lambda Function Name')
    .action(function (arn, options) {
        require('../lib/lambda').approve(arn, options.fn);
    });
program
    .command('sts:assume <aws_id:role>')
    .description('Assume new role based on persmission')
    .action(function (cmd) {
        require('../lib/sts').assume.apply(null, cmd.split(':'));
    });

program.parse(process.argv);
