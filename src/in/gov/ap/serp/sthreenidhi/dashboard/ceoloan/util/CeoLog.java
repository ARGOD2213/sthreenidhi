/*
 * CEO Loan Intelligence Dashboard
 * Console logging for the dashboard; every line starts with [CEO-DASH].
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util;

import java.text.SimpleDateFormat;
import java.util.Date;

public final class CeoLog {
    private static final ThreadLocal<SimpleDateFormat> TS = new ThreadLocal<SimpleDateFormat>() {
        protected SimpleDateFormat initialValue() { return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS"); }
    };

    private CeoLog() { }

    private static String stamp() { return TS.get().format(new Date()); }

    public static void info(String msg) {
        System.out.println("[CEO-DASH][" + stamp() + "][INFO] " + msg);
    }
    public static void warn(String msg) {
        System.out.println("[CEO-DASH][" + stamp() + "][WARN] " + msg);
    }
    public static void error(String msg) {
        System.err.println("[CEO-DASH][" + stamp() + "][ERROR] " + msg);
    }
    public static void error(String msg, Throwable t) {
        System.err.println("[CEO-DASH][" + stamp() + "][ERROR] " + msg);
        if (t != null) { t.printStackTrace(System.err); }
    }
    public static void debug(String msg) {
        System.out.println("[CEO-DASH][" + stamp() + "][DEBUG] " + msg);
    }
}
