var FileStore = require('./cache.js');

module.exports = function(options) {
  options = options || {};
  options.ttl = 1000 * 60 * 60 * 12;

  var cache = BaFileCache(options);
  console.log(cache);
  return {
      beforePhantomRequest: function(req, res, next) {
        if (req.method !== 'GET' || !req.prerender.url || req.prerender.url.indexOf('http') !== 0) {
          return next();
        }

        var now = Date.now();
        // We try to serve from cache, if that fails then we rebuild
        // or if it succeeds but ctime is older then ttl
        cache.serve(req.prerender.url, req, res, function(err, stat) {
          console.log(err, stat);
          if (!err || !(stat && stat.ctime)) {
            // Corner case, an error occured while sending
            // so we can't send again.
            req.prerender.dontSend = res.headersSent;
            console.log('No cache rendering, dontSend', req.prerender.dontSend);
            next(); // Render page and build.
            return;
          }

          // Is it time to rebuild?
          if (now - stat.ctime.getTime() > options.ttl) {
            console.log('ttl! rebuild');
            req.prerender.dontSend = true;
            next();
          }

          // If we get here we've served a cached page! yay! Now we celebrate by doing nothing.
        });
      },

      afterPhantomRequest: function(req, res, next) {
        // Don't cache anything that didn't result in a 200. This is to stop caching of 3xx/4xx/5xx status codes
        // Basic empty page test, just empty body and head + title and doctype is about 78
        // charachters so we check if we have at least 2000 chars.
        if (req.prerender.statusCode === 200 && req.prerender.documentHTML &&
          req.prerender.documentHTML.length > 2000) {
          console.log('Saving cached value', req.prerender.url);
          cache.save(req.prerender.url, req.prerender.documentHTML, function(err) {
            if (err) {
              console.log('Error while saving', err);
            } else {
              console.log('Saving done', req.prerender.url);
            }
          });
        } else {
          console.log(
            'Not saving', req.prerender.url,
            'Status code:', req.prerender.statusCode,
            'Length:', req.prerender.documentHTML &&
                req.prerender.documentHTML.length > 2000
          );
        }
        next();
      }
  };
};
