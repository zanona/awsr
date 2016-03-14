function run(template) {
    function getReference(ref) {
        // Only accepts same file 1st level references for now
        loc = ref.replace('#/', '').split('/');
        return template[loc[0]][loc[1]];
    }
    function convertToAWSParam(p, paramsObj) {
        var loc;
        if (p.$ref) {
            p = getReference(p.$ref);
            return convertToAWSParam(p, paramsObj);
        }
        if (!p.in.match(/header|query/)) { return; }
        loc = p.in === 'query' ? 'querystring' : 'header';
        return paramsObj[`method.request.${loc}.${p.name}`] = !!p.required;
    }
    function getParams(path, defaultParams) {
        var mergedParams = Object.assign({}, defaultParams);
        if (path.parameters) {
            path.parameters.forEach((p) => {
                convertToAWSParam(p, mergedParams);
            });
        }
        return mergedParams;
    }
    function getHeaders(path) {
        var params = {};
        if (path.headers) {
            Object.keys(path.headers).forEach((headerName) => {
                params[`method.response.header.${headerName}`] = false;
            });
        }
        return params;
    }
    function getResponses(path) {
        var responses = {};
        path.responses['500'] = { description: 'Internal Server Error' };
        if (path.responses) {
            Object.keys(path.responses).forEach((name) => {
                responses[name] = getHeaders(path.responses[name], 'headers');
            });
        }
        return responses;
    }

    var resources = {};

    Object.keys(template.paths).sort().forEach((pathName) => {
        var path = template.paths[pathName],
            defaultParams = getParams(path);
        resources[pathName] = {};

        if (template.consumes) {
            defaultParams['method.request.header.Content-Type'] = true;
        }

        Object.keys(path).forEach((methodName) => {
            if (methodName.match(/parameters/)) { return; }
            var params    = getParams(path[methodName], defaultParams),
                responses = getResponses(path[methodName]);
            resources[pathName][methodName] = { params, responses };
        });
    });
    return resources;
}
module.exports = run;
