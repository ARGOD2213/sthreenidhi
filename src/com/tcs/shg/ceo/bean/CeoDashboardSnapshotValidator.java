/*
 * CEO Loan Intelligence Dashboard
 * Checks a new snapshot before it goes live: totals from separate queries must agree
 * (0.5 % allowed for NOLOCK reads) and payment modes must make sense.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.ceo.bean;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.tcs.shg.ceo.util.CeoLog;

public final class CeoDashboardSnapshotValidator {
    private static final double TOLERANCE = 0.005;

    private CeoDashboardSnapshotValidator() { }

    public static String validate(CeoDashboardSnapshot snap) {
        if (snap == null) return "snapshot is null";
        List districts = snap.getDistricts();
        Map  totals    = snap.getTotals();

        if (districts.isEmpty()) return "no districts";
        Set ids = new HashSet();
        for (int i = 0; i < districts.size(); i++) {
            Map d = (Map) districts.get(i);
            if (!ids.add(d.get("id"))) return "duplicate district " + d.get("id");
            if (str(d.get("slug")).length() == 0) CeoLog.warn("District " + d.get("id") + " has no map slug");
        }
        if (snap.getMandals().isEmpty()) return "no mandals";

        String[] nonNegative = { "loanCount", "disbursed", "repayTxns", "repaid", "targetAmount", "activeMembers" };
        for (int k = 0; k < nonNegative.length; k++) {
            if (num(totals.get(nonNegative[k])) < 0) return "negative total " + nonNegative[k];
        }
        if (num(totals.get("activeMembers")) == 0) return "zero active members";

        List fyMonths = new java.util.ArrayList();
        String from = snap.getFyStart().substring(0, 7), to = snap.getFyEnd().substring(0, 7);
        for (int i = 0; i < snap.getMonthly().size(); i++) {
            Map m = (Map) snap.getMonthly().get(i);
            String mon = str(m.get("month"));
            if (mon.compareTo(from) >= 0 && mon.compareTo(to) < 0) fyMonths.add(m);
        }
        if (snap.getMonths().size() != 24) return "trend window has " + snap.getMonths().size() + " months, expected 24";

        String r;
        if ((r = reconcile("monthly loanCount", sum(fyMonths, "loanCount"), totals.get("loanCount"))) != null) return r;
        if ((r = reconcile("monthly disbursed", sum(fyMonths, "disbursed"), totals.get("disbursed"))) != null) return r;
        if ((r = reconcile("monthly repaid",    sum(fyMonths, "repaid"),    totals.get("repaid")))    != null) return r;
        if ((r = reconcile("daily loanCount",   sum(snap.getDaily(), "loanCount"), totals.get("loanCount"))) != null) return r;
        if ((r = reconcile("daily repaid",      sum(snap.getDaily(), "repaid"),    totals.get("repaid")))    != null) return r;

        CeoDashCube cube = snap.getCube();
        if (cube == null) return "no analytic cube";
        String cubeTo = to.compareTo(cube.getEndMonth()) < 0 ? to : cube.getEndMonth();
        if (!cube.covers(from, cubeTo)) return "cube window " + cube.getFirstMonth() + ".." + cube.getEndMonth() + " misses the FY";
        double[] c = (double[]) cube.aggregate(CeoDashCube.TOTAL, null, null, from, cubeTo, null).get("ALL");
        if (c == null) c = new double[CeoDashCube.MEASURES];
        if ((r = reconcile("cube loanCount", c[CeoDashCube.LOANS],     totals.get("loanCount"))) != null) return r;
        if ((r = reconcile("cube disbursed", c[CeoDashCube.DISBURSED], totals.get("disbursed"))) != null) return r;
        if ((r = reconcile("cube repaid",    c[CeoDashCube.REPAID],    totals.get("repaid")))    != null) return r;
        if ((r = modesSane(cube.aggregate(CeoDashCube.DISTRICT, null, null, from, cubeTo, null))) != null) return r;
        CeoDashCube dc = snap.getDayCube();
        if (dc == null) return "no day cube";
        double[] dsum = (double[]) dc.aggregate(CeoDashCube.TOTAL, null, null, snap.getFyStart(), snap.getFyEnd(), null).get("ALL");
        if (dsum == null) dsum = new double[CeoDashCube.MEASURES];
        if (snap.getPurposeCube() == null) return "no activity cube";
        if (!snap.getFyMandal().containsKey(snap.getFyLabel())) return "no FY mandal facts";
        if ((r = reconcile("day cube loanCount", dsum[CeoDashCube.LOANS],  totals.get("loanCount"))) != null) return r;
        if ((r = reconcile("day cube repaid",    dsum[CeoDashCube.REPAID], totals.get("repaid")))    != null) return r;
        if ((r = reconcile("mandal loanCount",  sum(snap.getMandals(), "loanCount"), totals.get("loanCount"))) != null) return r;
        if ((r = reconcile("mandal repaid",     sum(snap.getMandals(), "repaid"),    totals.get("repaid")))    != null) return r;

        double mt = sum(snap.getMandals(), "targetAmount");
        double dt = num(totals.get("targetAmount"));
        if (Math.abs(mt - dt) > Math.max(1.0, dt * TOLERANCE)) {
            CeoLog.warn("Mandal targets " + mt + " != district targets " + dt + " (mandal id format?)");
        }

        CeoLog.info("Snapshot validation PASSED fy=" + snap.getFyLabel()
                + " districts=" + districts.size() + " mandals=" + snap.getMandals().size());
        return null;
    }

    private static String reconcile(String what, double part, Object totalObj) {
        double total = num(totalObj);
        if (Math.abs(part - total) <= Math.max(1.0, Math.abs(total) * TOLERANCE)) return null;
        return what + " " + part + " does not reconcile with district total " + total;
    }

    // no negative mode figures, and online never more than collected
    private static String modesSane(Map byDistrict) {
        for (Iterator it = byDistrict.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry e = (Map.Entry) it.next();
            double[] m = (double[]) e.getValue();
            double online = m[CeoDashCube.POS_AMOUNT] + m[CeoDashCube.UPI_AMOUNT] + m[CeoDashCube.AUTO_AMOUNT];
            double onlineTxns = m[CeoDashCube.POS_TXNS] + m[CeoDashCube.UPI_TXNS] + m[CeoDashCube.AUTO_TXNS];
            for (int i = CeoDashCube.POS_AMOUNT; i <= CeoDashCube.AUTO_TXNS; i++) {
                if (m[i] < 0) return "district " + e.getKey() + " has a negative payment-mode figure";
            }
            if (online > m[CeoDashCube.REPAID] * (1 + TOLERANCE) + 1.0)
                return "district " + e.getKey() + " online " + online + " > collected " + m[CeoDashCube.REPAID];
            if (onlineTxns > m[CeoDashCube.TXNS] * (1 + TOLERANCE) + 1.0)
                return "district " + e.getKey() + " online payments " + onlineTxns + " > payments " + m[CeoDashCube.TXNS];
        }
        return null;
    }

    private static double sum(List rows, String field) {
        double s = 0;
        for (int i = 0; i < rows.size(); i++) s += num(((Map) rows.get(i)).get(field));
        return s;
    }

    private static double num(Object o) {
        if (o instanceof BigDecimal) return ((BigDecimal) o).doubleValue();
        if (o instanceof Number) return ((Number) o).doubleValue();
        return 0;
    }

    private static String str(Object o) { return o == null ? "" : o.toString(); }
}
