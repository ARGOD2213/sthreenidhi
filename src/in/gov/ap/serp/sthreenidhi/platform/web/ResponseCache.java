/*
 * CEO Loan Intelligence Dashboard
 * Shared by all dashboards (keys start with the dashboard's own prefix). Keeps finished answers (the page and the JSON calls) as ready-to-send bytes, plain and gzip,
 * so the same answer is never rendered or compressed twice for one snapshot. Also answers
 * "If-None-Match" with 304 so a returning browser downloads nothing.
 * Java 6 compatible.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.platform.web;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public final class ResponseCache {
    // bounded by total bytes (plain + gzip), oldest-used entries go first; a new snapshot empties it
    private static final long MAX_TOTAL_BYTES = 96L * 1024L * 1024L;
    public  static final int  MAX_BODY_BYTES  = 4 * 1024 * 1024;
    private static final int  MIN_GZIP_BYTES  = 1024;

    private static final LinkedHashMap MAP = new LinkedHashMap(128, 0.75f, true);
    private static long totalBytes = 0L;

    private ResponseCache() { }

    public static final class Entry {
        final byte[] raw;
        final byte[] gz;
        final String contentType;
        final String etag;

        Entry(byte[] raw, byte[] gz, String contentType, String etag) {
            this.raw = raw; this.gz = gz; this.contentType = contentType; this.etag = etag;
        }

        long size() { return raw.length + (gz == null ? 0 : gz.length); }
    }

    public static boolean enabled() {
        return !"false".equalsIgnoreCase(System.getProperty("ceo.dash.cache", "true").trim());
    }

    public static synchronized Entry get(String key) { return (Entry) MAP.get(key); }

    public static synchronized void put(String key, Entry e) {
        Entry old = (Entry) MAP.put(key, e);
        if (old != null) totalBytes -= old.size();
        totalBytes += e.size();
        java.util.Iterator it = MAP.values().iterator();
        while (totalBytes > MAX_TOTAL_BYTES && it.hasNext()) {
            Entry victim = (Entry) it.next();
            if (victim == e) continue;
            totalBytes -= victim.size();
            it.remove();
        }
    }

    // drops one dashboard's entries (keys start with its prefix) and leaves the others alone
    public static synchronized void clearPrefix(String prefix) {
        java.util.Iterator it = MAP.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry e = (Map.Entry) it.next();
            if (((String) e.getKey()).startsWith(prefix)) {
                totalBytes -= ((Entry) e.getValue()).size();
                it.remove();
            }
        }
    }

    public static Entry build(byte[] raw, String contentType, String etag) throws IOException {
        byte[] gz = raw.length >= MIN_GZIP_BYTES ? GzipSupport.gzip(raw) : null;
        return new Entry(raw, gz, contentType, etag);
    }

    // short, stable validator made from the cache key (64-bit FNV-1a)
    public static String etagOf(String key) {
        long h = 0xcbf29ce484222325L;
        for (int i = 0; i < key.length(); i++) {
            h ^= key.charAt(i);
            h *= 0x100000001b3L;
        }
        return "\"" + Long.toHexString(h) + "\"";
    }

    // true when the browser already holds exactly this version
    public static boolean notModified(HttpServletRequest request, String etag) {
        String inm = request.getHeader("If-None-Match");
        if (inm == null || etag == null) return false;
        return inm.indexOf(etag) >= 0 || "*".equals(inm.trim());
    }

    public static void sendNotModified(HttpServletResponse response, String etag, String cacheControl) {
        response.setStatus(HttpServletResponse.SC_NOT_MODIFIED);
        response.setHeader("ETag", etag);
        response.setHeader("Cache-Control", cacheControl);
        response.addHeader("Vary", "Accept-Encoding");
    }

    public static void send(HttpServletRequest request, HttpServletResponse response, Entry e, String cacheControl)
            throws IOException {
        response.setContentType(e.contentType != null ? e.contentType : "text/html;charset=UTF-8");
        response.setHeader("ETag", e.etag);
        response.setHeader("Cache-Control", cacheControl);
        response.addHeader("Vary", "Accept-Encoding");
        byte[] out = e.raw;
        if (e.gz != null && GzipSupport.accepted(request)) {
            out = e.gz;
            response.setHeader("Content-Encoding", "gzip");
        }
        response.setContentLength(out.length);
        ServletOutputStream os = response.getOutputStream();
        os.write(out);
        os.flush();
    }
}
