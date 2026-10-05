/*
 * Sthreenidhi platform
 * Signed, expiring access for the open dashboard links. No login, no session, works from any
 * other website or language because it is only an HMAC-SHA256.
 *
 *   LINK   the other site opens   .../CeoLoanIntelligence?action=page&exp=<unix seconds>&sig=<hex>
 *          sig = hex( HMAC_SHA256( secret, dashboard + "|" + purpose + "|" + exp ) )
 *          purpose is "view" for people and "admin" for status details / refresh.
 *          exp must be in the future and not further away than sthreenidhi.token.link.max.seconds.
 *
 *   API    the page itself gets a token "t" (same for everyone in a time slot, so the page can be
 *          cached) and sends it with every data call:  ...?action=drill&...&t=<hex>
 *          t = hex( HMAC_SHA256( secret, "api|" + dashboard + "|" + slot ) ),
 *          slot = now / sthreenidhi.token.api.slot.seconds ; the current and the previous slot are accepted.
 *
 * The secret is set once on the server: -Dsthreenidhi.token.secret=... . Without a secret the
 * dashboards are OPEN (everything allowed) and a warning is logged at start-up.
 * Java 6 compatible.
 */
package in.gov.ap.serp.sthreenidhi.platform.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class LinkToken {
    public static final String PURPOSE_VIEW  = "view";
    public static final String PURPOSE_ADMIN = "admin";

    private static final long DEFAULT_LINK_MAX_SECONDS = 3600L;
    private static final long DEFAULT_API_SLOT_SECONDS = 4L * 3600L;
    private static final long CLOCK_SKEW_SECONDS = 60L;

    private LinkToken() { }

    private static String secret() {
        String s = System.getProperty("sthreenidhi.token.secret");
        return s == null ? "" : s.trim();
    }

    // true when a secret is configured, i.e. links must be signed
    public static boolean enabled() {
        return secret().length() > 0;
    }

    private static long longProp(String name, long def) {
        String p = System.getProperty(name);
        if (p == null || p.trim().length() == 0) return def;
        try {
            long v = Long.parseLong(p.trim());
            return v > 0 ? v : def;
        } catch (Exception e) { return def; }
    }

    public static long linkMaxSeconds() { return longProp("sthreenidhi.token.link.max.seconds", DEFAULT_LINK_MAX_SECONDS); }
    public static long apiSlotSeconds() { return longProp("sthreenidhi.token.api.slot.seconds", DEFAULT_API_SLOT_SECONDS); }

    // ---- links ----

    public static String signLink(String secret, String dashboard, String purpose, long expSeconds) {
        return hmacHex(secret, dashboard + "|" + purpose + "|" + expSeconds);
    }

    public static boolean verifyLink(String dashboard, String purpose, String exp, String sig) {
        if (!enabled()) return true;
        if (exp == null || sig == null || exp.length() == 0 || exp.length() > 12 || sig.length() == 0) return false;
        long e;
        try { e = Long.parseLong(exp); } catch (Exception ex) { return false; }
        long now = System.currentTimeMillis() / 1000L;
        if (e < now - CLOCK_SKEW_SECONDS) return false;                    // expired
        if (e > now + linkMaxSeconds() + CLOCK_SKEW_SECONDS) return false; // too far ahead
        return sameHex(signLink(secret(), dashboard, purpose, e), sig);
    }

    // ---- page -> data calls ----

    private static String apiFor(String dashboard, long slot) {
        return hmacHex(secret(), "api|" + dashboard + "|" + slot);
    }

    // the token the page is given ("" when the dashboards are open)
    public static String apiToken(String dashboard) {
        if (!enabled()) return "";
        return apiFor(dashboard, System.currentTimeMillis() / 1000L / apiSlotSeconds());
    }

    public static boolean verifyApiToken(String dashboard, String token) {
        if (!enabled()) return true;
        if (token == null || token.length() == 0) return false;
        long slot = System.currentTimeMillis() / 1000L / apiSlotSeconds();
        return sameHex(apiFor(dashboard, slot), token) || sameHex(apiFor(dashboard, slot - 1), token);
    }

    // ---- helpers ----

    private static String hmacHex(String key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes("UTF-8"), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes("UTF-8"));
            StringBuffer sb = new StringBuffer(raw.length * 2);
            for (int i = 0; i < raw.length; i++) {
                int v = raw[i] & 0xff;
                if (v < 16) sb.append('0');
                sb.append(Integer.toHexString(v));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failed: " + e);
        }
    }

    // compares without stopping at the first different character
    private static boolean sameHex(String a, String b) {
        if (a == null || b == null) return false;
        String x = a.toLowerCase(), y = b.toLowerCase();
        int diff = x.length() ^ y.length();
        int n = Math.min(x.length(), y.length());
        for (int i = 0; i < n; i++) diff |= x.charAt(i) ^ y.charAt(i);
        return diff == 0;
    }
}
