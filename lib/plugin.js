const util = require('util');
const BaS3Cache = require('./s3cache');
const BaFileCache = require('./cache');

module.exports = function BaPlugin(options) {
  options = options || {};
  options.ttl = options.ttl || 1000 * 60 * 60 * 12;

  let cache;
  if (options.cache === 'S3') {
    util.log('Using S3 cache');
    cache = new BaS3Cache(options);
  } else {
    util.log('Using file cache');
    cache = new BaFileCache(options);
  }

  return {
    beforePhantomRequest(req, res, next) {
      if (
        req.method !== 'GET' ||
        !req.prerender.url ||
        req.prerender.url.indexOf('http') !== 0 ||
        req.prerender.skipCache
      ) {
        return next();
      }

      const now = Date.now();
      // We try to serve from cache, if that fails then we rebuild
      // or if it succeeds but ctime is older then ttl
      cache.serve(req.prerender.url, req, res, (err, ctime) => {
        if (err || !(ctime)) {
          // Corner case, an error occured while sending
          // so we can't send again.
          req.prerender.dontSend = res.headersSent;
          util.log('No cache for ' + req.prerender.url);
          next(); // Render page and build.
          return;
        }

        // Is it time to rebuild?
        const lifetime = now - ctime.getTime();
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

    beforeSend(req, res, next) {
      if (req.method !== 'GET' || !req.prerender.url || req.prerender.url.indexOf('http') !== 0) {
        return next();
      }
      // Don't cache anything that didn't result in a 200. This is to stop caching of 3xx/4xx/5xx
      // status codes. Basic empty page test, just empty body and head + title and doctype is
      // about 78 charachters so we check if we have at least 2000 chars.
      if (req.prerender.statusCode === 200 && req.prerender.documentHTML &&
        req.prerender.documentHTML.length > 2000) {
        cache.save(req.prerender.url, req.prerender.documentHTML, (err) => {
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
    },
  };
};
