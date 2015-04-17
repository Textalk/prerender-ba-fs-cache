Prerender BA filesystem cache
=============================


This is a cache plugin for [prerender](https://github.com/prerender/prerender).

Its a simple file cache but with one quirk, *it will always serve a cached page* regardless of
its TTL. But if the cached file is older than the TTL it will be updated *after* it's sent the old
answer.

Note that the cache is never purged, to do that you simple need to remove the files, there are
several other scrips and programs that can remove files older than a certain limit if you need to.


The cache saves a gzipped version of the page (if the request can't handle compression its unpacked
before transfer) on disk, the filename is a sha1 hash of the entire URL and is saved

`<domain>/<first-two-chars-of-hash>/<sha1-hash-of-entire-url>`

### Usage


Order of prerender plugins is important, probably best to keep it last in the list.

```js
server.use(require('prerender-ba-fs-cache')({
  ttl: 1000*60*60*5,
  baseDir: '/tmp'
}));
```

### Options
-------
| Name    |  Purpose         |
|---------|------------------|
| ttl     | If the cached file is older than this, then start rendering the page *after* cached file is served |
| baseDir | Path to where the cached files should be stored |



### TODO:

* Tests
* option for checking if content is correct before storing it in cache, currently it checks
  if the rendered page is more than 2000 chars to avoid caching blank pages. 
