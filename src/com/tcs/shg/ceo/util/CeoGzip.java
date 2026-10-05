/*
 * CEO Loan Intelligence Dashboard
 * Sends the dashboard's own answers (the page, the JSON calls, app.js and app.css) gzip-compressed
 * when the browser accepts it. A fresh open drops from about 1.3 MB to about 0.3 MB.
 * -Dceo.dash.gzip=false switches it off without a new build.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.ceo.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.util.zip.GZIPOutputStream;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;

public final class CeoGzip {
    // below this size compressing costs more than it saves
    private static final int MIN_BYTES = 1024;

    private CeoGzip() { }

    public static boolean enabled() {
        String p = System.getProperty("ceo.dash.gzip");
        return p == null || !"false".equalsIgnoreCase(p.trim());
    }

    public static boolean accepted(HttpServletRequest request) {
        if (!enabled()) return false;
        String ae = request.getHeader("Accept-Encoding");
        return ae != null && ae.toLowerCase().indexOf("gzip") >= 0;
    }

    public static byte[] gzip(byte[] body) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.max(512, body.length / 4));
        GZIPOutputStream gz = new GZIPOutputStream(out);
        gz.write(body);
        gz.close();
        return out.toByteArray();
    }

    // writes a finished body in one piece, compressed when the browser accepts it and it is worth it
    public static void send(HttpServletRequest request, HttpServletResponse response, byte[] body) throws IOException {
        response.addHeader("Vary", "Accept-Encoding");
        byte[] out = body;
        if (body.length >= MIN_BYTES && accepted(request)) {
            out = gzip(body);
            response.setHeader("Content-Encoding", "gzip");
        }
        response.setContentLength(out.length);
        ServletOutputStream os = response.getOutputStream();
        os.write(out);
        os.flush();
    }

    /*
     * Holds back everything a handler or the JSP writes, then sends it compressed from finish().
     * Status codes and headers still go straight to the real response; sendError() commits it,
     * and finish() then leaves it alone.
     */
    public static final class Buffered extends HttpServletResponseWrapper {
        private final HttpServletRequest request;
        private final ByteArrayOutputStream buf = new ByteArrayOutputStream(64 * 1024);
        private PrintWriter writer;
        private ServletOutputStream stream;
        private int status = HttpServletResponse.SC_OK;
        private String contentType;

        public Buffered(HttpServletRequest request, HttpServletResponse response) {
            super(response);
            this.request = request;
        }

        public ServletOutputStream getOutputStream() throws IOException {
            if (writer != null) throw new IllegalStateException("getWriter() has already been called");
            if (stream == null) {
                stream = new ServletOutputStream() {
                    public void write(int b) { buf.write(b); }
                    public void write(byte[] b, int off, int len) { buf.write(b, off, len); }
                };
            }
            return stream;
        }

        public PrintWriter getWriter() throws IOException {
            if (stream != null) throw new IllegalStateException("getOutputStream() has already been called");
            if (writer == null) {
                String enc = getCharacterEncoding();
                writer = new PrintWriter(new OutputStreamWriter(buf, enc == null ? "ISO-8859-1" : enc));
            }
            return writer;
        }

        // the real length is only known once the body is complete
        public void setContentLength(int len) { }

        public void setStatus(int sc) { status = sc; super.setStatus(sc); }
        public void setStatus(int sc, String msg) { status = sc; super.setStatus(sc, msg); }
        public void sendError(int sc) throws IOException { status = sc; super.sendError(sc); }
        public void sendError(int sc, String msg) throws IOException { status = sc; super.sendError(sc, msg); }
        public void sendRedirect(String location) throws IOException { status = HttpServletResponse.SC_FOUND; super.sendRedirect(location); }
        public void setContentType(String type) { contentType = type; super.setContentType(type); }

        // what the handler wrote, for the response cache
        public int statusCode() { return status; }
        public String contentType() { return contentType; }
        public byte[] body() {
            if (writer != null) writer.flush();
            return buf.toByteArray();
        }

        public void flushBuffer() {
            if (writer != null) writer.flush();
        }

        public void resetBuffer() {
            super.resetBuffer();
            if (writer != null) writer.flush();
            buf.reset();
        }

        public void reset() {
            super.reset();
            if (writer != null) writer.flush();
            buf.reset();
        }

        public void finish() throws IOException {
            if (writer != null) writer.flush();
            HttpServletResponse real = (HttpServletResponse) getResponse();
            if (real.isCommitted()) return;
            send(request, real, buf.toByteArray());
        }
    }
}
