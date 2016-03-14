function push(API_ID, DEFINITION_PATH) {
    var fs     = require('fs'),
        co     = require('co'),
        yaml   = require('js-yaml'),
        req    = require('../utils/request').defaults({service: 'apigateway'}),
        pathId = require('../utils/path-id'),
        normalizeTemplate = require('../utils/normalizer'),
        definition,
        Q = [];

    function addCors(def) {
        Object.keys(def.paths).forEach((p) => {
            var op = def.paths[p];
            op.options = {
                responses: {
                    '200': {
                        headers: {
                            'Access-Control-Allow-Headers': { },
                            'Access-Control-Allow-Methods': { },
                            'Access-Control-Allow-Origin':  { }
                        }
                    }
                }
            };
        });
    }
    function performReq(method, path, body) {
        return req({
            method: method,
            path: `/restapis/${API_ID}/${path}`,
            body: body
        });
    }
    function request() {
        var cb,
            promise = new Promise((resolve) => { cb = resolve; });
        Q.push({args: arguments, cb});
        function err(error) {
            console.error('ERROR', error);
        }
        function nextBatch() {
            //2 per second
            var a = Q.shift(),
                b = Q.shift();
            if (a) { performReq.apply(null, a.args).then(a.cb).catch(err); }
            if (b) { performReq.apply(null, b.args).then(b.cb).catch(err); }
        }
        if (Q.length > 2) {
            console.log('QUEUEING');
            setTimeout(nextBatch, 100);
        } else {
            //console.log('NOT QUEUEING');
            nextBatch();
        }
        return promise;
    }
    function getResources() {
        return request('get', 'resources?limit=100');
    }
    function deleteResource(pathPart, idPath) {
        return request('delete', `resources/${idPath}`, { pathPart });
    }
    function createResource(pathPart, idPath) {
        return request('post', `resources/${idPath}`, { pathPart });
    }
    function createMethod(resourceId, method) {
        var path = `resources/${resourceId}/methods/${method.name}`;
        return request('put', path, {
            authorizationType: 'NONE',
            requestParameters: method.params
        });
    }
    function createMethodResponse(resourceId, method, statusCode) {
        var path = `resources/${resourceId}/methods/${method.name}`
                + `/responses/${statusCode}`;
        return request('put', path, {
            responseParameters: method.responses[statusCode]
        });
    }
    function createMethodIntegration(resourceId, method) {
        var path = `resources/${resourceId}`
                  + `/methods/${method.name}/integration`,
            body = {
                type: 'AWS',
                httpMethod: 'POST',
                credentials: null,
                uri: 'arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31'
                   + '/functions/arn:aws:lambda:eu-west-1:522588444553:function:api/invocations',
                requestTemplates: { 'application/json': '' }
            };
        body.requestTemplates['application/json'] = ` {
            "url": "$context.resourcePath",
            "method": "$context.httpMethod",
            "headers": {
              #set($items = $input.params().header)
              #foreach($key in $items.keySet())
                #set($value = $items.get($key))
                "$key": "$util.escapeJavaScript($value)"
                #if($foreach.hasNext),#end
              #end
            },
            "params": {
              #set($items = $input.params().path)
              #foreach($key in $items.keySet())
                #set($value = $items.get($key))
                "$key": "$util.escapeJavaScript($value)"
                #if($foreach.hasNext),#end
              #end
            },
            "query": {
              #set($items = $input.params.querystring())
              #foreach($key in $items.keySet())
                #set($value = $items.get($key))
                "$key": "$util.escapeJavaScript($value)"
                #if($foreach.hasNext),#end
              #end
            },
            "body" : $input.json('$')
          }`;
        if (method.name === 'OPTIONS') {
            body.type = 'MOCK';
            body.requestTemplates['application/json'] = '{"statusCode": 200}';
        }
        return request('put', path, body);
    }
    function createMethodIntegrationResponse(resourceId, method, statusCode) {
        var path = `resources/${resourceId}/methods/${method.name}`
                + `/integration/responses/${statusCode}`,
            t = {
                '200': {
                    pattern: null,
                    template: ''
                },
                '400': {
                    pattern: '(.|\\n)*4\\d{2}(.|\\n)*',
                    template: '$input.path("errorMessage")'
                },
                '500': {
                    pattern: '(.|\\n)*5\\d{2}(.|\\n)*',
                    template: '$input.path("errorMessage")'
                }
            }[statusCode],
            responseParameters = {};

        if (method.name === 'OPTIONS') {
            responseParameters = {
                'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key'",
                'method.response.header.Access-Control-Allow-Methods': "'*'",
                'method.response.header.Access-Control-Allow-Origin': "'*'"
            };
        }

        return request('put', path, {
            selectionPattern: t.pattern,
            responseParameters,
            responseTemplates: { 'application/json': t.template }
        });
    }
    function getResourceIds(resources) {
        var ids = {};
        resources = resources._embedded.item;
        resources = resources.join ? resources : [resources];
        resources.forEach((r) => ids[r.path] = r.id );
        return ids;
    }

    function* createMethodForPath(method, path) {
        //var q = [];
        yield createMethod(path.id, method);
        yield createMethodIntegration(path.id, method);
        //create responses for all statuses available in response
        var responses, st;
        responses = Object.keys(method.responses);
        for (st = 0; st < responses.length; st += 1) {
            yield createMethodResponse(path.id, method, responses[st]);
            yield createMethodIntegrationResponse(
                path.id,
                method,
                responses[st]
            );
        }
    }
    function* createMethodsForPath(path, operations) {
        var keys = Object.keys(operations),
            method,
            methodName;
        //has to be async, simultaneous requests
        while ((methodName = keys.shift())) {
            method = operations[methodName];
            method.name = methodName.toUpperCase();
            yield createMethodForPath(method, path);
        }
        return true;
    }

    function* deleteAllResources(ids) {
        var queue = [],
            paths = [],
            idsCopy = Object.assign({}, ids);
        Object.keys(idsCopy).forEach((path) => {
            if (path === '/') { return; }
            delete ids[path];
            var p = path.split(/(?!^)\//)[0];
            if (paths.indexOf(p) >= 0) { return; }
            paths.push(p);
        });
        paths.forEach((path) => {
            console.log('PUSH DELETE');
            queue.push(deleteResource(path, idsCopy[path]));
            console.log('POST PUSH DELETE');
        });
        yield queue;
    }
    function* createRandomResources(baseId) {
        var ids = 'ABDCEFGHIJLMNOPQ'.split(''),
            queue = [],
            i;
        for (i = 0; i < ids.length; i += 1) {
            //console.log(`Creating resource ${ids[i]}`);
            queue.push(createResource(ids[i], baseId));
        }
        yield queue;
    }

    function* createAllResources(paths, ids) {
        var path, resource, next;
        while((path = paths.shift())) {
            path = pathId(path, ids);
            while ((next = path.next.shift())) {
                resource  = yield createResource(next, path.id);
                path.name = resource.path;
                path.id   = resource.id;
                ids[path.name] = path.id;
            }
            yield createMethodsForPath(path, definition[path.name]);
        }
    }
    function wait(ms) {
        return new Promise((resolve) => {
            console.log('waiting', ms);
            setTimeout(resolve, ms);
        });
    }

    function *init() {
        console.time('ps');
        addCors(definition);
        definition = normalizeTemplate(definition);
        var paths = Object.keys(definition).sort(),
            ids = getResourceIds(yield getResources());

        yield* deleteAllResources(ids);
        console.log('DELETED ALL');

        //yield wait(100);
        //yield* createRandomResources(ids['/']);
        //console.log('created all');
        //paths = ['/user/experiences/{experienceId}/verification'];
        yield createAllResources(paths, ids);

        console.log('finishing up');
        console.timeEnd('ps');
    }

    function bootstrap() {
        fs.readFile(DEFINITION_PATH, (_, d) => {
            yaml.safeLoadAll(d.toString(), (doc) => {
                definition = doc;
                co(init).catch((err) => {
                    console.log('ERROR', err, err.stack);
                });
            });
        });
    }
    bootstrap();
}

exports.push = push;
sync('0d214ixkz2', '/Users/zanona/Desktop/icontract-api/swagger.yaml');
