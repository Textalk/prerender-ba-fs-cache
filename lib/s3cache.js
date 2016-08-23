const crypto = require('crypto');
const zlib = require('zlib');
const util = require('util');
const aws = require('aws-sdk');

function BaS3Cache(options) {
  if (!(this instanceof BaS3Cache)) {
    return new BaS3Cache(options);
  }

  // TODO: Check options so we got 'em all.
  options.baseDir = options.baseDir || '.';
  options.bucket = options.bucket || process.env.S3_BUCKET_NAME;
  options.prefix = options.prefix || process.env.S3_PREFIX_KEY || 'prerender-ba-cache';
  this.options = options;

  // Set region, and keys, if any are specified.
  const config = {};
  if (options.region) {
    config.region = options.region;
  }
  if (options.accessKeyId) {
    config.accessKeyId = options.accessKeyId;
  }
  if (options.secretAccessKey) {
    config.secretAccessKey = options.secretAccessKey;
  }
  if (Object.keys(config).length > 0) {
    aws.config.update(config);
  }
  this.s3 = new aws.S3({ params: { Bucket: options.bucket } });
}

/**
 * Serve a file from s3.
 *
 * @param {string} url
 * @param {Request} req
 * @param {Response} res
 * @param {Function} callback function(err){}
 */
BaS3Cache.prototype.serve = function(url, req, res, callback) {
  const that = this;
  this.hashUrl(url, (hash) => {
    const key = that.options.prefix + '/' + hash;
    const awsReq = that.s3.getObject({
      Key: key,
    }, (err, obj) => {
      if (err) {
        // 404s etc
        return callback(err);
      }

      // Return last changed
      return callback(null, new Date(obj.LastModified));
    });

    // Content type is always html.
    res.setHeader('Content-Type', 'text/html;charset=UTF-8');
    let resTo = res;

    // Does the client support gzipped content?
    if (!req.headers['accept-encoding'] || req.headers['accept-encoding'].indexOf('gzip') === -1) {
      // Not? typical. Then we unzip.
      resTo = zlib.createGunzip();
      resTo.pipe(res);
    } else {
      res.setHeader('Content-Encoding', 'gzip');
    }

    // Wait for headers before we send anything.
    awsReq.on('httpHeaders', (statusCode) => {
      if (statusCode === 200) {
        res.writeHead(200);
        // All is OK. Let's send those chunks!
        awsReq.on('httpData', (chunk) => {
          resTo.write(chunk);
        }).on('httpDone', () => {
          resTo.end();
        });
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
BaS3Cache.prototype.save = function save(url, html, callback) {
  const that = this;
  this.hashUrl(url, (hash) => {
    const key = that.options.prefix + '/' + hash;

    // To save space we gzip the html
    zlib.gzip(html, (err, buffer) => {
      if (err) {
        callback(err);
        return;
      }
      that.s3.putObject({
        Key: key,
        ContentType: 'text/html;charset=UTF-8',
        StorageClass: 'REDUCED_REDUNDANCY',
        Body: buffer,
      }, callback);
    });
  });
};

BaS3Cache.prototype.hashUrl = (url, callback) => {
  // Create  a sha1 hash so we can use it as a key
  const shasum = crypto.createHash('sha1');
  shasum.end(url, () => {
    callback(shasum.read().toString('hex'));
  });
};

module.exports = BaS3Cache;
