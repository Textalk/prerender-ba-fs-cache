var fs     = require('fs');
var path   = require('path');
var Url    = require('url');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var zlib  = require('zlib');



function BaFileCache(options) {
  if (!(this instanceof BaFileCache)) {
    return new BaFileCache(options);
  }

  // TODO: Check options so we got 'em all.
  options.baseDir = options.baseDir || '.';
  this.options = options;
}

/**
 * Serve a file from filestore. It will either fail with
 * callback is called with stat of file.
 * @param {string} url
 * @param {Request} req
 * @param {Response} res
 * @param {Function} callback function(err, stat){}
 */
BaFileCache.prototype.serve = function(url, req, res, callback) {

  this.parseUrl(url, function(parsed) {
    // Start serving the file
    var read = fs.createReadStream(parsed.file).on('error', callback);

    // Listen to on end of file. This is how we know the file exists.
    // It's more robust to handle fail then to check before.
    read.on('end', function() {
      // Check file ctime
      fs.stat(parsed.file, callback);
    });

    read.on('open', function() {
      // We save them gzipped so we need to check if the agent can handle that.
      res.setHeader('Content-Type', 'text/html;charset=UTF-8');
      if (!req.headers['accept-encoding'] || req.headers['accept-encoding'].indexOf('gzip') === -1) {
        res.writeHead(200);
        var gunzip = zlib.createGunzip();
        read.pipe(gunzip).pipe(res);

      } else {
        res.setHeader('Content-Encoding', 'gzip');
        res.writeHead(200);
        read.pipe(res);
      }
    });
  });

};

/**
 * Save to cache.
 * We store files by domain/sha1(url)-first-two-chars/sha1sum(url)
 * @param {string} url
 * @param {string} html
 * @param {Function} callback
 */
BaFileCache.prototype.save = function(url, html, callback) {

  this.parseUrl(url, function(parsed) {
    // Create folder needed
    mkdirp(parsed.dir, function(err) {
      // err is only if something goes wrong, if the path exists thats ok.
      if (err) {
        callback(err);
        return;
      }

      // To save space we gzip the html
      zlib.gzip(html, function(err, buffer) {
        if (err) {
          callback(err);
          return;
        }

        fs.writeFile(path.join(parsed.dir, parsed.hash), buffer, function(err) {
          if (err) {
            callback(err);
            return;
          }
          callback();
        });
      });
    });
  });
};

BaFileCache.prototype.parseUrl = function(url, callback) {
  var parsed = Url.parse(url);
  var that = this;
  // Create  a sha1 hash so we can use the first chars as subfolder name
  var shasum = crypto.createHash('sha1');
  shasum.end(url, function() {
    parsed.hash = shasum.read().toString('hex');
    parsed.dir = path.join(
      that.options.baseDir,
      parsed.hostname,
      parsed.hash[0] + parsed.hash[1]
    );
    parsed.file = path.join(parsed.dir, parsed.hash);
    callback(parsed);
  });
};

module.exports = BaFileCache;
