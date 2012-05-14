/*!
 * Pageshift
 * Copyright © 2012 David Bushell | BSD & MIT license | http://dbushell.com/
 */

window.Pageshift = (function(window, document, undefined)
{

    var log = function(obj)
    {
        if (typeof console === 'object' && typeof console.log === 'function') {
            console.log(obj);
        }
    };

    var body = document.body,
        head = document.head || document.getElementsByTagName('head')[0],

        metaTypes = 'description keywords'.split(' '),
        linkTypes = 'alternate appendix archives author canonical contents copyright feed first glossary help index last license next pingback prev publisher search section sidebar start subsection tag up'.split(' '),

        div = document.createElement('div'),
        testProp = function(props) {
            for (var p in props) {
                if (div.style[p] !== undefined && (document.documentMode === undefined || document.documentMode > 8)) {
                    return { css: p, endEvent: props[p] };
                }
            }
            return undefined;
        },

        transition = testProp({
            'transition'        : 'transitionend',
            'WebkitTransition'  : 'webkitTransitionEnd',
            'MozTransition'     : 'transitionend',
            'msTransition'      : 'MsTransitionEnd',
            'OTransition'       : 'oTransitionEnd'
        }),

        getComputedStyle = window.getComputedStyle,
        XMLHttpRequest   = window.XMLHttpRequest,
        localStorage     = window.localStorage,

        app = {

            el           : null,
            effect       : 'slide',

            // increment to expire active bookmarklets
            bookmarklet  : 1,

            onclick      : null, // before a click event is hijacked on an internal link
            onrequest    : null, // before a page request/transition is started
            oncomplete   : null, // after a page transition is complete
            onerror      : null  // after a page fails to load
        },

        pages = { },
        expires = 1 * 60 * 1000,
        scripts = null,
        rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        host = window.location.host;

    if (!document.querySelector || !getComputedStyle || !XMLHttpRequest || !transition) {
        log('Pageshift feature detection failed.');
        return null;
    }

    var _key = function(url)
    {
        return 'pageshift-' + window.btoa(unescape(encodeURIComponent(url))).replace(/[^a-z0-9]/gi, '');
    };

    var _addClass = function(el, cn)
    {
        if (typeof cn !== 'string') {
            for (var n in cn) {
                _addClass(el, cn[n]);
            }
            return;
        }
        if ((' ' + el.className + ' ').indexOf(cn) === -1) {
            el.className = (el.className === '') ? cn : el.className + ' ' + cn;
        }
    };

    var _removeClass = function(el, cn)
    {
        if (typeof cn !== 'string') {
            for (var n in cn) {
                _removeClass(el, cn[n]);
            }
            return;
        }
        el.className = (' ' + el.className + ' ').replace(cn, '');
    };

    var _scrollToTop = function()
    {
        var offset = window.pageYOffset || 0;
        if (!app.interval) {
            app.interval = { start: offset, fn: setInterval(_scrollToTop, 10) };
        } else {
            if (!offset) {
                clearInterval(app.interval.fn);
                return app.interval = null;
            }
            var y = offset - (((app.interval.start - offset) / 7) + 1);
            window.scrollTo(0, (y < 0) ? 0 : y);
        }
    };

    var _onClick = function(e)
    {
        var el = e.target;
        while (el) {
            if (el.nodeName.toLowerCase() === 'a') {
                break;
            }
            el = el.parentNode;
        }
        if (!el || el.getAttribute('target') === '_blank') {
            return;
        }
        var href = el.getAttribute('href');
        if (href.indexOf('http://' + host) === 0 || href.match(/^(\.)*\//gi)) {
            if (typeof app.onclick === 'function' && app.onclick(e) === false) {
                return;
            }
            e.preventDefault();
            app.request(href.replace('http://' + host, ''));
        }
    };

    var _onPopState = function(e)
    {
        if (e.state && e.state.hasOwnProperty('url')) {
            for (var key in pages) {
                if (!pages[key].loaded && !pages[key].cancelled) {
                    pages[key].cancelled = true;
                }
            }
            app.request(e.state.url, { pushState: false });
        }
    };

    var _onTransitionEnd = function(e)
    {
        app.el.style.overflow = 'visible';
        var all = app.el.querySelectorAll('.pageshift-body'),
            old = all[0],
            el  = all[1];
        old.parentNode.removeChild(old);
        el.removeEventListener(transition.endEvent, _onTransitionEnd);
        el.className = 'pageshift-body';
        if (typeof app.oncomplete === 'function') {
            app.oncomplete();
        }
    };

    var _onLoad = function(page)
    {

        var time = (new Date().getTime() / 1000) - page.time,
            delay = 250 - (time * 1000),
            effect = page.options.effect,
            html = localStorage ? localStorage.getItem(page.key) : page.html,
            temp = document.createElement('div'),
            i, meta, el;

        temp.innerHTML = html;

        if ((meta = temp.querySelector('title'))) {
            document.title = meta.innerText;
        }

        // remove old page specific meta data
        meta = head.querySelectorAll('link,meta');
        for (i = 0; i < meta.length; i++) {
            if ((meta[i].nodeName.toLowerCase() === 'link' && linkTypes.indexOf(meta[i].getAttribute('rel')) !== -1) ||
                (meta[i].nodeName.toLowerCase() === 'meta' && metaTypes.indexOf(meta[i].getAttribute('name')) !== -1))
            {
                meta[i].parentNode.removeChild(meta[i]);
            }
        }

        // add new page specific meta data
        meta = temp.querySelectorAll('link,meta');
        for (i = 0; i < meta.length; i++) {
            if ((meta[i].nodeName.toLowerCase() === 'link' && linkTypes.indexOf(meta[i].getAttribute('rel')) !== -1) ||
                (meta[i].nodeName.toLowerCase() === 'meta' && metaTypes.indexOf(meta[i].getAttribute('name')) !== -1))
            {
                head.appendChild(meta[i]);
            }
        }

        // create the new body
        el = temp.querySelector('[data-pageshift="new"]');
        el.setAttribute('data-pageshift', effect);

        // swap styles with body element
        el.style.backgroundColor = getComputedStyle(body, null).getPropertyValue('background-color');
        body.className = el.className || '';
        el.className = 'pageshift-body pageshift-' + effect + '-enter';

        app.el.style.overflow = 'hidden';
        app.el.appendChild(el);
        el.addEventListener(transition.endEvent, _onTransitionEnd, null);

        setTimeout(function() {
            if (page.options.pushState === true) {
                history.pushState({ key: page.key, url: page.url }, '', page.url);
            }
            _addClass(document.querySelector('.pageshift-body'), 'pageshift-' + effect + '-exit');
            _addClass(el, 'pageshift-' + effect + '-in');
        }, delay > 0 ? delay : 0);

        if (localStorage) {
            clearTimeout(page.timeout);
            page.timeout = setTimeout(function() {
                localStorage.removeItem(page.key);
                delete pages[page.key];
            }, expires);
        }

    }; // _onLoad

    app.request = function(url, options)
    {
        if (!app.el || (typeof app.onrequest === 'function' && app.onrequest(url, options) === false)) {
            return;
        }

        var key  = _key(url),
            now  = new Date().getTime() / 1000,
            opt  = options || { };

        opt.pushState = (opt.pushState !== undefined) ? opt.pushState : true;
        opt.effect    = opt.effect || app.effect;

        _scrollToTop();

        _addClass(document.querySelector('.pageshift-body'), 'pageshift-' + opt.effect + '-out');

        // get HTML from storage if previously loaded
        if (localStorage && pages.hasOwnProperty(key) && pages[key].loaded) {
            pages[key].time = now;
            pages[key].options = opt;
            pages[key].cancelled = false;
            _onLoad(pages[key]);
            return;
        }

        // or create a new page object
        pages[key] = {
            key       : key,
            url       : url,
            xhr       : new window.XMLHttpRequest(),
            time      : now,
            options   : opt,
            cancelled : false,
            loaded    : false
        };

        // load HTML with XMLHTTPRequest
        pages[key].xhr.open('GET', url, true);
        pages[key].xhr.onload = function(e)
        {
            pages[key].loaded = true;
            if (pages[key].cancelled) {
                return;
            }
            if (pages[key].xhr.readyState === 4) {
                var html = pages[key].xhr.responseText.replace(rscript, '').replace('<body', '<div data-pageshift="new"').replace('</body>', '</div>');
                if (localStorage) {
                    localStorage.setItem(key, html);
                } else {
                    pages[key].html = html;
                }
                _onLoad(pages[key]);
            }
            delete pages[key].xhr;
        };
        pages[key].xhr.onerror = pages[key].xhr.onabort = function(e)
        {
            if (typeof app.onerror === 'function') {
                app.onerror(e);
            }
            _removeClass(document.querySelector('.pageshift-body'), 's-out');
            delete pages[key].xhr;
        };
        pages[key].xhr.send();

    }; // app.request

    app.init = function()
    {
        if (app.el) {
            return;
        }

        log('Pageshift initalised.');

        window.addEventListener('click', _onClick, null);
        window.addEventListener('popstate', _onPopState, null);

        scripts = body.querySelectorAll('script');
        for (var i = 0; i < scripts; i++) {
            scripts[i].parentNode.removeChild(scripts[i]);
        }

        body.innerHTML = '<div id="pageshift"><div class="pageshift-body">' + body.innerHTML + '</div></div>';

        app.el = document.querySelector('#pageshift');
        app.el.querySelector('.pageshift-body').style.backgroundColor = getComputedStyle(body, null).getPropertyValue('background-color');

    }; // app.init

    return app;

})(window, window.document);
