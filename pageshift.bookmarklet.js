javascript: ((function () {

    var v = 1;

    if (window.Pageshift) {
        alert('Pageshift already initalised.');
        return;
    }

    window.Pageshift = { };

    var a = document.createElement('link');
    a.setAttribute('rel', 'stylesheet');
    a.setAttribute('href', 'http://dbushell.com/pageshift/pageshift.css?r=' + Math.random());
    document.getElementsByTagName('head')[0].appendChild(a);

    a = document.createElement('script');
    a.setAttribute('type', 'text/javascript');
    a.setAttribute('charset', 'UTF-8');
    a.setAttribute('src', 'http://dbushell.com/pageshift/pageshift.js?r=' + Math.random());
    document.documentElement.appendChild(a);

    a.onload = a.onreadystatechange = function ()
    {
        var rs = a.readyState;
        if (! rs || rs === 'loaded' || rs === 'complete') {
            a.onload = a.onreadystatechange = null;
            setTimeout(function() {
                if (v !== window.Pageshift.bookmarklet) {
                    alert('This bookmarklet is out of date!');
                }
                window.Pageshift.init();
            }, 50);
        }
    };

})());
