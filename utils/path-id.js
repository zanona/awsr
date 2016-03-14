function run(name, ids, next, tmpNext, src) {
    name   = name || '/';
    var id = ids[name || '/'], l, v;
    if (!next) {
        next = name.split('/');
        if (next[0] === '') { next[0] = '/'; }
        src = name;
    }

    if (id || name === '/') {
        tmpNext = tmpNext ? next.indexOf(tmpNext) : next.length;
        next = next.slice(tmpNext, next.lenth);
        return { id, name, next, src };
    }

    l    = name.lastIndexOf('/');
    v    = name.substr(0, l);
    tmpNext = name.replace(v + '/', '');

    if (l >= 0) {
        return run(v, ids, next, tmpNext, src);
    }
}

function test() {
    console.log(run('/user/experiences/{experienceId}/verify', {
        '/': '$$$$',
        '/user': '0000',
        '/user/experiences': '1111',
        '/user/experiences/{experienceId}': '2222',
        '/iuser/experiences/{experienceId}/verify': '3333'
    }));
}
module.exports = run;
