# Performance

## What the application does

1. **Everything is answered from memory.** A background job builds a snapshot (state / district /
   mandal / month / day cubes) and the page and clicks read from it. The database is touched only
   for VO / SHG / woman clicks, at most 4 at a time.
2. **Answers are built once per snapshot.** The page and every JSON answer are rendered and
   gzip-compressed on the first request, kept as ready bytes (`CeoResponseCache`, at most 96 MB,
   oldest dropped first, emptied on each new snapshot) and sent as they are to everyone else.
   A returning browser sends `If-None-Match` and gets an empty `304` (no render, no download).
3. JSON answers carry `Cache-Control: private, max-age=300` (the browser does not even ask for 5 min).
   The page uses `no-cache` + ETag: always checked, almost always `304`.
4. `app.js` / `app.css` are compressed once and cached by the browser for 30 days per `?v=` version.

Switches (JBoss `-D` options): `ceo.dash.cache=false` turns the response cache off,
`ceo.dash.json.maxage.seconds=N` changes the 300 seconds, `ceo.dash.gzip=false` turns compression off.

If the JSP ever writes something different for each visitor (a user name, a one-time token),
turn the cache off with `-Dceo.dash.cache=false`, or tell me and the page is left out of the cache.

## Recommended server settings (JBoss 5.0, Java 6) - to be tried on your server

`bin/run.conf` (Linux) or `bin/run.conf.bat` (Windows):

    -server -Xms1024m -Xmx2048m -XX:MaxPermSize=256m
    -XX:+UseConcMarkSweepGC -XX:+UseParNewGC -XX:+CMSParallelRemarkEnabled
    -Dsun.rmi.dgc.client.gcInterval=3600000 -Dsun.rmi.dgc.server.gcInterval=3600000
    -Djava.awt.headless=true

(use a smaller heap if the machine is small; the snapshot itself is tens of MB.)

`server/<profile>/deploy/jbossweb.sar/server.xml`, the HTTP connector:

    <Connector protocol="HTTP/1.1" port="8080" maxThreads="400" acceptCount="200"
               enableLookups="false" connectionTimeout="20000" URIEncoding="UTF-8"/>

`enableLookups="false"` stops a reverse-DNS lookup per request. Leave connector `compression` **off**:
the application already sends compressed bytes.

If a web server / proxy sits in front, let it pass `ETag` and `If-None-Match` and not compress again.

## Database pool

`deploy/sthreenidhi-ds.xml`: `max-pool-size` 10 is enough, because only 4 detail queries run at once
and the refresh uses one connection.
