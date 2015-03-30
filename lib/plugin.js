var util = require('util');
var BaFileCache = require('./cache.js');

module.exports = function(options) {
  options = options || {};
  options.ttl = 1000 * 60 * 60 * 12;

  var cache = BaFileCache(options);
  return {
      beforePhantomRequest: function(req, res, next) {
        if (req.method !== 'GET' || !req.prerender.url || req.prerender.url.indexOf('http') !== 0) {
          return next();
        }

        var now = Date.now();
        // We try to serve from cache, if that fails then we rebuild
        // or if it succeeds but ctime is older then ttl
        cache.serve(req.prerender.url, req, res, function(err, stat) {
          if (err || !(stat && stat.ctime)) {
            // Corner case, an error occured while sending
            // so we can't send again.
            req.prerender.dontSend = res.headersSent;
            util.log('No cache for ' + req.prerender.url);
            next(); // Render page and build.
            return;
          }

          // Is it time to rebuild?
          var lifetime = now - stat.ctime.getTime();
          if (lifetime > options.ttl) {
            util.log('Cache exists, but ttl is older. Serving and rebuilding ' + req.prerender.url);
            req.prerender.dontSend = true;
            next();
          } else {
            util.log('Cache exists, Serving ' + req.prerender.url);
          }

          // If we get here we've served a cached page! yay! Now we celebrate by doing nothing.
        });
      },

      beforeSend: function(req, res, next) {
        // Don't cache anything that didn't result in a 200. This is to stop caching of 3xx/4xx/5xx status codes
        // Basic empty page test, just empty body and head + title and doctype is about 78
        // charachters so we check if we have at least 2000 chars.
        if (req.prerender.statusCode === 200 && req.prerender.documentHTML &&
          req.prerender.documentHTML.length > 2000) {
          cache.save(req.prerender.url, req.prerender.documentHTML, function(err) {
            if (err) {
              util.log('Error while saving page' + util.inspect(err, {colors: true}));
            } else {
              util.log('Saved page in cache ' + req.prerender.url);
            }
          });
        } else {
          util.log(
            'Not saving page ' + req.prerender.url +
            ' Status code: ' + req.prerender.statusCode +
            (req.prerender.documentHTML ? ' Length: ' + req.prerender.documentHTML.length : '')
          );
        }

        // Don't continue sending unless we really need to.
        if (!req.prerender.dontSend) {
          next();
        }
      }
  };
};
