/*
 * Sthreenidhi platform
 * Financial year helpers (1 April - 31 March).
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.platform.util;

import java.util.Calendar;
import java.util.Date;

public final class FiscalYear {
    private FiscalYear() { }

    public static int startYearOfLabel(String fyLabel) {
        if (fyLabel == null) throw new IllegalArgumentException("FY label required");
        String s = fyLabel.trim();
        int dash = s.indexOf('-');
        if (dash <= 0) throw new IllegalArgumentException("Bad FY label: " + fyLabel);
        return Integer.parseInt(s.substring(0, dash));
    }

    public static String labelFromStartYear(int y) {
        int y2 = (y + 1) % 100;
        String suffix = (y2 < 10 ? "0" : "") + y2;
        return y + "-" + suffix;
    }

    public static String fyStart(int startYear)         { return startYear + "-04-01"; }
    public static String fyEndExclusive(int startYear)  { return (startYear + 1) + "-04-01"; }

    public static String currentFyLabel(Date when) {
        Calendar c = Calendar.getInstance();
        c.setTime(when);
        int m = c.get(Calendar.MONTH) + 1;
        int y = c.get(Calendar.YEAR);
        int startYear = (m >= 4) ? y : (y - 1);
        return labelFromStartYear(startYear);
    }
}
