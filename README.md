Prerender BA filesystem cache
=============================


This is a cache plugin for [prerender](https://github.com/prerender/prerender).

Its a simple file cache or AWS S3 cache but with one quirk, *it will always serve a cached page*
regardless of its TTL. But if the cached file is older than the TTL it will be updated *after*
it's sent the old answer.

Note that the cache is never purged, to do that you simple need to remove the files, there are
several other scrips and programs that can remove files older than a certain limit if you need to.

The cache saves a gzipped version of the page (if the request can't handle compression its unpacked
before transfer) on disk, the filename is a sha1 hash of the entire URL and is saved

`<domain>/<first-two-chars-of-hash>/<sha1-hash-of-entire-url>`

In the case of S3 the name is `<prefix>/<sha1-hash-of-entire-url>`.


### Usage file cache

Order of prerender plugins is important, probably best to keep it last in the list.

```js
server.use(require('prerender-ba-fs-cache')({
  cache: 'file',
  ttl: 1000*60*60*5,
  baseDir: '/tmp'
}));
```

### Options
-------
| Name    |  Purpose         |
|---------|------------------|
| cache   | 'file' for file cache |
| ttl     | If the cached file is older than this, then start rendering the page *after* cached file is served |
| baseDir | Path to where the cached files should be stored |


### Usage S3 cache

Order of prerender plugins is important, probably best to keep it last in the list.

```js
server.use(require('prerender-ba-fs-cache')({
  cache: 'S3',
  bucket: 'my-awesome-bucket',
  ttl: 1000*60*60*5,
  prefix: 'file-name-prefix'
  region: 'eu-west-1',
  accessKeyId: '...or set key in ENV variable, config file etc. See aws-sdk docs',
  secretAccessKey: '...same here'.
}));
```

### Options
-------
| Name    |  Purpose         |
|---------|------------------|
| cache   | 'S3' for AWS S3 cache |
| ttl     | If the cached file is older than this, then start rendering the page *after* cached file is served |
| bucket | Name of bucket to use |
| prefix | Prefix to use |
| region | Wich region to use |
| accessKeyId | Aws accessKeyId. Can also be set in  an ENV variable, config file etc. See aws-sdk docs', |
| secretAccessKey | Aws secret. Can also be set in  an ENV variable, config file etc. See aws-sdk docs', |
