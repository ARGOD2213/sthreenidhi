/*
 * Sthreenidhi platform
 * One place where a dashboard servlet asks "may this request in?" and answers "no" the same way
 * every time. Parameter names: exp, sig (signed link) and t (page -> data calls).
 * Java 6 compatible.
 */
package in.gov.ap.serp.sthreenidhi.platform.security;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public final class AccessGuard {
    private AccessGuard() { }

    private static String p(HttpServletRequest r, String name) {
        String v = r.getParameter(name);
        return v == null ? "" : v.trim();
    }

    // the signed link a person opens (purpose "view") or an administrator uses ("admin")
    public static boolean linkOk(HttpServletRequest r, String dashboard, String purpose) {
        return LinkToken.verifyLink(dashboard, purpose, p(r, "exp"), p(r, "sig"));
    }

    // the token the page sends with its data calls
    public static boolean apiOk(HttpServletRequest r, String dashboard) {
        return LinkToken.verifyApiToken(dashboard, p(r, "t"));
    }

    public static void denyPage(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("text/html;charset=UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Link expired</title></head>"
            + "<body style=\"font-family:sans-serif;margin:48px\"><h3>This link is not valid or has expired.</h3>"
            + "<p>Please open the dashboard again from the official site.</p></body></html>");
    }

    public static void denyJson(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-store");
        response.getWriter().write("{\"status\":\"error\",\"message\":\"Session expired. Please open the dashboard link again.\"}");
    }
}
