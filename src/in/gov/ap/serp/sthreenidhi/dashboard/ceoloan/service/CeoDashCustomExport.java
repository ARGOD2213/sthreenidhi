/*
 * CEO Loan Intelligence Dashboard
 * "Custom Excel": the user picks what to group by, where, which months and which columns; this class
 * builds that table from the in-memory snapshot (cubes), so it answers in milliseconds and never
 * touches the database. Used for the preview (JSON) and for the .xls download.
 *
 * Every input is checked against a whitelist or a strict pattern here; nothing is concatenated into SQL.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.service;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

import org.apache.poi.hssf.usermodel.HSSFSheet;

import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashCube;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashboardSnapshot;

public final class CeoDashCustomExport {

    private CeoDashCustomExport() { }

    // at most a few of these run at the same time; each is a few milliseconds of memory work
    private static final Semaphore SLOTS = new Semaphore(4);
    private static final int MAX_DISTRICTS = 40;
    private static final int MAX_MANDAL_KEYS = 400;
    private static final int MAX_PROJECT_MANDALS = 60;
    private static final int MAX_ROWS = 5000;

    public static final String[] GROUPS = { "DISTRICT", "MANDAL", "PROJECT", "MONTH", "OFFICER", "AGM", "DGM" };

    // key, label, kind (n = number, p = percent, ok for groups: B = every group, M = needs mandals (not project/month), O = overdue)
    private static final String[][] COLS = {
        { "loans",       "Loans given",                   "n", "B" },
        { "given",       "Amount given (Rs)",             "n", "B" },
        { "avg",         "Average loan (Rs)",             "n", "B" },
        { "open",        "Active loans",                  "n", "B" },
        { "closed",      "Closed loans",                  "n", "B" },
        { "txns",        "Repayments",                    "n", "B" },
        { "collected",   "Collected (Rs)",                "n", "B" },
        { "upi",         "UPI (Rs)",                      "n", "B" },
        { "pos",         "POS (Rs)",                      "n", "B" },
        { "auto",        "Auto-debit (Rs)",               "n", "B" },
        { "manual",      "Manual / cash (Rs)",            "n", "B" },
        { "onlinePct",   "Paid online %",                 "p", "B" },
        { "cashPct",     "Paid in cash %",                "p", "B" },
        { "target",      "Target (Rs, for the months chosen)", "n", "M" },
        { "achPct",      "Target achieved %",             "p", "M" },
        { "odAmt",       "Overdue (Rs)",                  "n", "O" },
        { "odLoans",     "Loans in arrears",              "n", "O" },
        { "odPct",       "Loans in arrears % of open",    "p", "O" },
        { "atRisk",      "Balance at risk (Rs)",          "n", "O" },
        { "outstanding", "Total outstanding (Rs)",        "n", "O" },
        { "parPct",      "Balance at risk % of outstanding", "p", "O" }
    };

    private static final String[] DEFAULT_COLS = { "loans", "given", "open", "closed", "txns", "collected", "onlinePct" };

    public static final class Result {
        public String group;
        public String[] head;
        public final List rows = new ArrayList();      // Object[]
        public Object[] total;
        public String[] trendHead;
        public final List trendRows = new ArrayList(); // Object[]
        public final List info = new ArrayList();      // String[2]
        public final List notes = new ArrayList();     // String
        public int rowCount;
    }

    // ---------------------------------------------------------------------------------------------

    public static Result run(CeoDashboardSnapshot snap, Map p) throws Exception {
        if (snap == null) throw new CeoDashboardService.NotReadyException();
        if (!SLOTS.tryAcquire(10, TimeUnit.SECONDS)) throw new CeoDashboardService.BusyException();
        try {
            return build(snap, p);
        } finally {
            SLOTS.release();
        }
    }

    private static Result build(CeoDashboardSnapshot snap, Map p) {
        CeoDashCube cube = snap.getCube();
        if (cube == null) throw new IllegalArgumentException("the data is not ready yet");
        Result res = new Result();

        // ---- inputs
        String group = str(p.get("group")).toUpperCase();
        if (group.length() == 0) group = "DISTRICT";
        if (!in(GROUPS, group)) throw new IllegalArgumentException("unknown grouping");
        res.group = group;

        String from = month("fromMonth", str(p.get("fromMonth")));
        String to = month("toMonth", str(p.get("toMonth")));
        if (from.compareTo(to) >= 0) throw new IllegalArgumentException("the last month must come after the first month");
        if (!cube.covers(from, to)) {
            throw new IllegalArgumentException("choose months between " + cube.getFirstMonth() + " and the month before " + cube.getEndMonth());
        }

        Set districts = idSet("districts", str(p.get("districts")), MAX_DISTRICTS, "[0-9A-Za-z]{1,6}");
        Set mandalKeys = idSet("mandals", str(p.get("mandals")), MAX_MANDAL_KEYS, "[0-9A-Za-z]{1,6}\\|[0-9A-Za-z]{1,6}");
        String project = str(p.get("project"));
        if (project.length() > 0 && !project.matches("[0-9A-Za-z]{1,10}")) throw new IllegalArgumentException("bad project");
        if (project.length() == 0) project = null;
        if ("MONTH".equals(group) && project != null) throw new IllegalArgumentException("the month view cannot be filtered by project");

        boolean odReady = CeoDashExport.isOverdueReady(snap);
        boolean groupHasMandals = !"PROJECT".equals(group) && !"MONTH".equals(group);
        List cols = new ArrayList();
        String[] want = str(p.get("cols")).length() == 0 ? DEFAULT_COLS : str(p.get("cols")).split(",");
        Set seen = new HashSet();
        int dropped = 0;
        for (int i = 0; i < want.length; i++) {
            String k = want[i].trim();
            String[] def = col(k);
            if (def == null) throw new IllegalArgumentException("unknown column " + k);
            if (!seen.add(k)) continue;
            if ("O".equals(def[3]) && !(odReady && groupHasMandals)) { dropped++; continue; }
            if ("M".equals(def[3]) && !groupHasMandals) { dropped++; continue; }
            cols.add(def);
        }
        if (cols.isEmpty()) throw new IllegalArgumentException("choose at least one column");
        if (dropped > 0) {
            res.notes.add(dropped + " chosen column(s) are not available for this grouping and were left out"
                    + (!odReady ? " (overdue figures are not ready)" : ""));
        }

        String sortKey = str(p.get("sort"));
        boolean asc = "asc".equalsIgnoreCase(str(p.get("dir")));
        int top = 0;
        if (str(p.get("top")).length() > 0) {
            try { top = Integer.parseInt(str(p.get("top"))); } catch (NumberFormatException e) { throw new IllegalArgumentException("bad row limit"); }
            if (top < 0 || top > MAX_ROWS) throw new IllegalArgumentException("row limit must be between 0 and " + MAX_ROWS);
        }
        boolean wantTrend = "1".equals(str(p.get("trend"))) && project == null;
        String title = clean(str(p.get("title")), 80);

        // ---- the mandals in scope
        List ms = snap.getMandals();
        List scope = new ArrayList();
        for (int i = 0; i < ms.size(); i++) {
            Map m = (Map) ms.get(i);
            String did = str(m.get("districtId")), key = did + "|" + str(m.get("mandalId"));
            if (!mandalKeys.isEmpty() ? !mandalKeys.contains(key) : (!districts.isEmpty() && !districts.contains(did))) continue;
            scope.add(m);
        }
        if (scope.isEmpty()) throw new IllegalArgumentException("nothing matches the districts / mandals chosen");

        Map districtName = new HashMap();
        for (int i = 0; i < snap.getDistricts().size(); i++) {
            Map d = (Map) snap.getDistricts().get(i);
            districtName.put(str(d.get("id")), nice(str(d.get("name"))));
        }

        double share = targetShare(snap, from, to);

        // ---- rows: one bucket per group key
        Map buckets = new LinkedHashMap();   // key -> Bucket
        if ("PROJECT".equals(group)) {
            projectBuckets(cube, buckets, scope, districts, mandalKeys, from, to, project);
        } else if ("MONTH".equals(group)) {
            monthBuckets(cube, buckets, scope, from, to);
        } else {
            Map byMandal = cube.aggregate(CeoDashCube.MANDAL, null, null, from, to, project);
            for (int i = 0; i < scope.size(); i++) {
                Map m = (Map) scope.get(i);
                String did = str(m.get("districtId")), key = did + "|" + str(m.get("mandalId"));
                String gk, name, c1 = "", c2 = "";
                if ("DISTRICT".equals(group)) { gk = did; name = name(districtName, did); }
                else if ("MANDAL".equals(group)) { gk = key; name = nice(str(m.get("name"))); c1 = name(districtName, did); }
                else if ("OFFICER".equals(group)) {
                    String u = str(m.get("officerUserId"));
                    gk = u.length() > 0 ? u : "~none"; name = u.length() > 0 ? nice(str(m.get("officerName"))) : "No officer mapped";
                    c1 = u; c2 = nice(str(m.get("officerRole")));
                } else if ("AGM".equals(group)) {
                    String u = str(m.get("agmUserId"));
                    gk = u.length() > 0 ? u : "~none"; name = u.length() > 0 ? nice(str(m.get("agmName"))) : "AGM not mapped"; c1 = u;
                } else {
                    String u = str(m.get("dgmUserId"));
                    gk = u.length() > 0 ? u : "~none"; name = u.length() > 0 ? nice(str(m.get("dgmName"))) : "DGM not mapped"; c1 = u;
                }
                Bucket b = (Bucket) buckets.get(gk);
                if (b == null) { b = new Bucket(name, c1, c2); buckets.put(gk, b); }
                double[] a = (double[]) byMandal.get(key);
                if (a != null) b.add(a);
                b.addOverdue(m, odReady);
                b.target += num(m.get("targetAmount")) * 10000000d * share;
                b.hasTarget = b.hasTarget || (share > 0 && project == null);   // the target is not split by project
            }
        }

        // ---- drop empty rows, compute the table
        String[] head = headFor(group, cols);
        res.head = head;
        int fixed = fixedCount(group);
        List table = new ArrayList();
        for (Iterator it = buckets.values().iterator(); it.hasNext();) {
            Bucket b = (Bucket) it.next();
            if (b.isEmpty()) continue;
            table.add(b);
        }
        sortBuckets(table, group, cols, sortKey, asc);
        if (top > 0 && table.size() > top) table = new ArrayList(table.subList(0, top));
        if (table.size() > MAX_ROWS) table = new ArrayList(table.subList(0, MAX_ROWS));

        Bucket total = new Bucket("Total", "", "");
        for (int i = 0; i < table.size(); i++) {
            Bucket b = (Bucket) table.get(i);
            Object[] row = new Object[head.length];
            row[0] = Double.valueOf(i + 1);
            b.fixedCells(group, row);
            for (int c = 0; c < cols.size(); c++) row[fixed + c] = b.value(((String[]) cols.get(c))[0]);
            res.rows.add(row);
            total.merge(b);
        }
        Object[] trow = new Object[head.length];
        trow[1] = "Total";
        for (int c = 0; c < cols.size(); c++) trow[fixed + c] = total.value(((String[]) cols.get(c))[0]);
        res.total = trow;
        res.rowCount = res.rows.size();

        // ---- optional month-by-month sheet for the same scope
        if (wantTrend) {
            Set keys = new HashSet();
            for (int i = 0; i < scope.size(); i++) {
                Map m = (Map) scope.get(i);
                keys.add(str(m.get("districtId")) + "|" + str(m.get("mandalId")));
            }
            double[][] mm = cube.monthlyFor(keys);
            String[] months = cube.monthList();
            res.trendHead = new String[] { "Month", "Loans given", "Amount given (Rs)", "Repayments", "Collected (Rs)", "Paid online %" };
            for (int i = 0; i < months.length; i++) {
                if (months[i].compareTo(from) < 0 || months[i].compareTo(to) >= 0) continue;
                double[] a = mm[i];
                double online = a[CeoDashCube.POS_AMOUNT] + a[CeoDashCube.UPI_AMOUNT] + a[CeoDashCube.AUTO_AMOUNT];
                res.trendRows.add(new Object[] { monthLabel(months[i]), Double.valueOf(a[CeoDashCube.LOANS]), Double.valueOf(a[CeoDashCube.DISBURSED]),
                        Double.valueOf(a[CeoDashCube.TXNS]), Double.valueOf(a[CeoDashCube.REPAID]), pct(online, a[CeoDashCube.REPAID]) });
            }
        }

        // ---- about
        List names = new ArrayList();
        for (Iterator it = districts.iterator(); it.hasNext();) names.add(name(districtName, (String) it.next()));
        Collections.sort(names);
        res.info.add(new String[] { "Report", title.length() > 0 ? title : "CEO Loan Intelligence - custom report" });
        res.info.add(new String[] { "Grouped by", groupLabel(group) });
        res.info.add(new String[] { "Districts", districts.isEmpty() ? "All districts" : join(names) });
        res.info.add(new String[] { "Mandals", mandalKeys.isEmpty() ? "All mandals of the districts above" : mandalKeys.size() + " chosen mandals" });
        res.info.add(new String[] { "Months", monthLabel(from) + " to " + monthLabel(lastMonth(to)) });
        res.info.add(new String[] { "Project", project == null ? "All Stree Nidhi projects" : cube.projectName(project) });
        StringBuffer cl = new StringBuffer();
        for (int c = 0; c < cols.size(); c++) { if (c > 0) cl.append(", "); cl.append(((String[]) cols.get(c))[1]); }
        res.info.add(new String[] { "Columns", cl.toString() });
        res.info.add(new String[] { "Rows", String.valueOf(res.rowCount) });
        if (groupHasMandals && odReady) {
            res.info.add(new String[] { "Overdue", "Overdue columns are today's arrears of open loans (as on the data date below); they do not change with the months chosen" });
        }
        if (share > 0 && groupHasMandals && project == null) {
            res.info.add(new String[] { "Target", "Financial-year target spread evenly over 12 months and counted for the months chosen that fall in FY " + snap.getFyLabel() });
        }
        res.info.add(new String[] { "Scope", "Stree Nidhi projects only (LOAN_TYPE = SN); payment modes: UPI = Phi PAYMENT SERVICE, POS = PAYTM PAYMENT SERVICE, Auto-debit = SHG AUTO DEBIT PROCESS, rest = manual" });
        res.info.add(new String[] { "Data as on", new SimpleDateFormat("dd-MM-yyyy HH:mm").format(new Date(snap.getBuiltAtMillis())) });
        res.info.add(new String[] { "Downloaded", new SimpleDateFormat("dd-MM-yyyy HH:mm").format(new Date()) });
        return res;
    }

    // ---------------------------------------------------------------------------------------------
    // buckets

    private static final class Bucket {
        final String name, c1, c2;
        final double[] m = new double[CeoDashCube.MEASURES];
        final double[] od = new double[5];   // statusLoans, overdueLoans, overdueAmount, outstanding, atRisk
        double target;
        boolean hasTarget;
        boolean hasOd;

        Bucket(String name, String c1, String c2) { this.name = name; this.c1 = c1; this.c2 = c2; }

        void add(double[] a) { for (int i = 0; i < m.length; i++) m[i] += a[i]; }

        void addOverdue(Map mandal, boolean ready) {
            if (!ready) return;
            hasOd = true;
            od[0] += num(mandal.get("statusLoans")); od[1] += num(mandal.get("overdueLoans"));
            od[2] += num(mandal.get("overdueAmount")); od[3] += num(mandal.get("outstanding"));
            od[4] += num(mandal.get("overdueOutstanding"));
        }

        void merge(Bucket o) {
            add(o.m);
            for (int i = 0; i < od.length; i++) od[i] += o.od[i];
            target += o.target;
            hasTarget = hasTarget || o.hasTarget;
            hasOd = hasOd || o.hasOd;
        }

        boolean isEmpty() { return m[CeoDashCube.LOANS] == 0 && m[CeoDashCube.TXNS] == 0 && od[1] == 0 && od[0] == 0; }

        void fixedCells(String group, Object[] row) {
            row[1] = name;
            if ("MANDAL".equals(group)) row[2] = c1;
            else if ("OFFICER".equals(group)) { row[2] = c1; row[3] = c2; }
            else if ("AGM".equals(group) || "DGM".equals(group)) row[2] = c1;
        }

        Object value(String key) {
            double collected = m[CeoDashCube.REPAID];
            double online = m[CeoDashCube.POS_AMOUNT] + m[CeoDashCube.UPI_AMOUNT] + m[CeoDashCube.AUTO_AMOUNT];
            if ("loans".equals(key)) return Double.valueOf(m[CeoDashCube.LOANS]);
            if ("given".equals(key)) return Double.valueOf(m[CeoDashCube.DISBURSED]);
            if ("avg".equals(key)) return m[CeoDashCube.LOANS] > 0 ? Double.valueOf(m[CeoDashCube.DISBURSED] / m[CeoDashCube.LOANS]) : null;
            if ("open".equals(key)) return Double.valueOf(m[CeoDashCube.OPEN]);
            if ("closed".equals(key)) return Double.valueOf(m[CeoDashCube.CLOSED]);
            if ("txns".equals(key)) return Double.valueOf(m[CeoDashCube.TXNS]);
            if ("collected".equals(key)) return Double.valueOf(collected);
            if ("upi".equals(key)) return Double.valueOf(m[CeoDashCube.UPI_AMOUNT]);
            if ("pos".equals(key)) return Double.valueOf(m[CeoDashCube.POS_AMOUNT]);
            if ("auto".equals(key)) return Double.valueOf(m[CeoDashCube.AUTO_AMOUNT]);
            if ("manual".equals(key)) return Double.valueOf(Math.max(0, collected - online));
            if ("onlinePct".equals(key)) return pct(online, collected);
            if ("cashPct".equals(key)) return pct(Math.max(0, collected - online), collected);
            if ("target".equals(key)) return hasTarget && target > 0 ? Double.valueOf(target) : null;
            if ("achPct".equals(key)) return hasTarget && target > 0 ? pct(m[CeoDashCube.DISBURSED], target) : null;
            if (!hasOd) return null;
            if ("odAmt".equals(key)) return Double.valueOf(od[2]);
            if ("odLoans".equals(key)) return Double.valueOf(od[1]);
            if ("odPct".equals(key)) return pct(od[1], od[0]);
            if ("atRisk".equals(key)) return Double.valueOf(od[4]);
            if ("outstanding".equals(key)) return Double.valueOf(od[3]);
            if ("parPct".equals(key)) return pct(od[4], od[3]);
            return null;
        }
    }

    private static void projectBuckets(CeoDashCube cube, Map buckets, List scope, Set districts, Set mandalKeys,
                                       String from, String to, String project) {
        List calls = new ArrayList();      // String[]{district, mandal or null}
        if (mandalKeys.isEmpty() && districts.isEmpty()) {
            calls.add(new String[] { null, null });
        } else if (mandalKeys.isEmpty()) {
            for (Iterator it = districts.iterator(); it.hasNext();) calls.add(new String[] { (String) it.next(), null });
        } else {
            if (mandalKeys.size() > MAX_PROJECT_MANDALS) {
                throw new IllegalArgumentException("for the project view choose at most " + MAX_PROJECT_MANDALS
                        + " mandals, or choose whole districts");
            }
            for (Iterator it = mandalKeys.iterator(); it.hasNext();) {
                String k = (String) it.next();
                int bar = k.indexOf('|');
                calls.add(new String[] { k.substring(0, bar), k.substring(bar + 1) });
            }
        }
        for (int i = 0; i < calls.size(); i++) {
            String[] c = (String[]) calls.get(i);
            Map sums = cube.aggregate(CeoDashCube.PROJECT, c[0], c[1], from, to, project);
            for (Iterator it = sums.entrySet().iterator(); it.hasNext();) {
                Map.Entry e = (Map.Entry) it.next();
                String k = (String) e.getKey();
                Bucket b = (Bucket) buckets.get(k);
                if (b == null) { b = new Bucket(cube.projectName(k), k, ""); buckets.put(k, b); }
                b.add((double[]) e.getValue());
            }
        }
    }

    private static void monthBuckets(CeoDashCube cube, Map buckets, List scope, String from, String to) {
        Set keys = new HashSet();
        for (int i = 0; i < scope.size(); i++) {
            Map m = (Map) scope.get(i);
            keys.add(str(m.get("districtId")) + "|" + str(m.get("mandalId")));
        }
        double[][] mm = cube.monthlyFor(keys);
        String[] months = cube.monthList();
        for (int i = 0; i < months.length; i++) {
            if (months[i].compareTo(from) < 0 || months[i].compareTo(to) >= 0) continue;
            Bucket b = new Bucket(monthLabel(months[i]), months[i], "");
            b.add(mm[i]);
            buckets.put(months[i], b);
        }
    }

    private static void sortBuckets(List table, final String group, List cols, String sortKey, final boolean asc) {
        if ("MONTH".equals(group)) {
            Collections.sort(table, new Comparator() {
                public int compare(Object a, Object b) { return ((Bucket) a).c1.compareTo(((Bucket) b).c1); }
            });
            return;
        }
        String k = sortKey;
        boolean byName = "name".equals(k);
        if (!byName) {
            boolean ok = false;
            for (int i = 0; i < cols.size(); i++) { if (((String[]) cols.get(i))[0].equals(k)) ok = true; }
            if (!ok) k = ((String[]) cols.get(0))[0];
        }
        final String key = k;
        final boolean nameSort = byName;
        Collections.sort(table, new Comparator() {
            public int compare(Object a, Object b) {
                Bucket x = (Bucket) a, y = (Bucket) b;
                if (nameSort) return asc ? x.name.compareToIgnoreCase(y.name) : y.name.compareToIgnoreCase(x.name);
                Object vx = x.value(key), vy = y.value(key);
                boolean nx = !(vx instanceof Number), ny = !(vy instanceof Number);
                if (nx || ny) {                       // rows with no value always go last
                    if (nx && ny) return x.name.compareToIgnoreCase(y.name);
                    return nx ? 1 : -1;
                }
                int c = Double.compare(((Number) vx).doubleValue(), ((Number) vy).doubleValue());
                if (c == 0) return x.name.compareToIgnoreCase(y.name);
                return asc ? c : -c;
            }
        });
    }

    // ---------------------------------------------------------------------------------------------
    // output

    public static byte[] excel(Result r) throws Exception {
        CeoDashExport.Book b = new CeoDashExport.Book();
        HSSFSheet sh = b.sheet("Report", r.head);
        for (int i = 0; i < r.rows.size(); i++) b.row(sh, i + 1, (Object[]) r.rows.get(i), i % 2 == 1);
        b.totalRow(sh, r.rows.size() + 1, r.total);
        if (r.trendHead != null) {
            HSSFSheet t = b.sheet("Month by month", r.trendHead);
            for (int i = 0; i < r.trendRows.size(); i++) b.row(t, i + 1, (Object[]) r.trendRows.get(i), i % 2 == 1);
        }
        String[][] info = new String[r.info.size() + r.notes.size()][];
        int n = 0;
        for (int i = 0; i < r.info.size(); i++) info[n++] = (String[]) r.info.get(i);
        for (int i = 0; i < r.notes.size(); i++) info[n++] = new String[] { "Note", (String) r.notes.get(i) };
        b.info(info);
        return b.bytes();
    }

    public static String fileBase(Result r) { return "CEO_Custom_" + r.group.substring(0, 1) + r.group.substring(1).toLowerCase(); }

    // first rows only, for the preview in the panel
    public static String previewJson(Result r, int maxRows) {
        StringBuffer sb = new StringBuffer("{\"status\":\"ok\",\"count\":").append(r.rowCount).append(",\"head\":[");
        for (int i = 0; i < r.head.length; i++) { if (i > 0) sb.append(','); sb.append(CeoDashboardService.q(r.head[i])); }
        sb.append("],\"rows\":[");
        int n = Math.min(maxRows, r.rows.size());
        for (int i = 0; i < n; i++) { if (i > 0) sb.append(','); cells(sb, (Object[]) r.rows.get(i)); }
        sb.append("],\"total\":");
        cells(sb, r.total);
        sb.append(",\"notes\":[");
        for (int i = 0; i < r.notes.size(); i++) { if (i > 0) sb.append(','); sb.append(CeoDashboardService.q((String) r.notes.get(i))); }
        sb.append("]}");
        return sb.toString();
    }

    private static void cells(StringBuffer sb, Object[] row) {
        sb.append('[');
        for (int i = 0; i < row.length; i++) {
            if (i > 0) sb.append(',');
            Object v = row[i];
            if (v == null) sb.append("null");
            else if (v instanceof Number) sb.append(BigDecimal.valueOf(((Number) v).doubleValue()).setScale(2, BigDecimal.ROUND_HALF_UP).toPlainString());
            else sb.append(CeoDashboardService.q(v.toString()));
        }
        sb.append(']');
    }

    // ---------------------------------------------------------------------------------------------
    // helpers

    private static String[] headFor(String group, List cols) {
        String[] fixedHead;
        if ("MANDAL".equals(group)) fixedHead = new String[] { "#", "Mandal", "District" };
        else if ("OFFICER".equals(group)) fixedHead = new String[] { "#", "Manager", "Login", "Role" };
        else if ("AGM".equals(group)) fixedHead = new String[] { "#", "AGM", "Login" };
        else if ("DGM".equals(group)) fixedHead = new String[] { "#", "DGM", "Login" };
        else if ("PROJECT".equals(group)) fixedHead = new String[] { "#", "Project" };
        else if ("MONTH".equals(group)) fixedHead = new String[] { "#", "Month" };
        else fixedHead = new String[] { "#", "District" };
        String[] head = new String[fixedHead.length + cols.size()];
        System.arraycopy(fixedHead, 0, head, 0, fixedHead.length);
        for (int c = 0; c < cols.size(); c++) head[fixedHead.length + c] = ((String[]) cols.get(c))[1];
        return head;
    }

    private static int fixedCount(String group) {
        if ("OFFICER".equals(group)) return 4;
        if ("MANDAL".equals(group) || "AGM".equals(group) || "DGM".equals(group)) return 3;
        return 2;
    }

    private static String groupLabel(String g) {
        if ("DISTRICT".equals(g)) return "District";
        if ("MANDAL".equals(g)) return "Mandal";
        if ("PROJECT".equals(g)) return "Project";
        if ("MONTH".equals(g)) return "Month";
        if ("OFFICER".equals(g)) return "Manager (mandal officer)";
        return g;
    }

    // share of the FY target that belongs to the chosen months (months of the FY inside the range / 12)
    private static double targetShare(CeoDashboardSnapshot snap, String from, String to) {
        String fyFrom = snap.getFyStart().substring(0, 7), fyTo = snap.getFyEnd().substring(0, 7);
        String a = from.compareTo(fyFrom) > 0 ? from : fyFrom;
        String b = to.compareTo(fyTo) < 0 ? to : fyTo;
        if (a.compareTo(b) >= 0) return 0;
        int n = (Integer.parseInt(b.substring(0, 4)) - Integer.parseInt(a.substring(0, 4))) * 12
              + (Integer.parseInt(b.substring(5, 7)) - Integer.parseInt(a.substring(5, 7)));
        return n / 12.0;
    }

    private static String[] col(String key) {
        for (int i = 0; i < COLS.length; i++) { if (COLS[i][0].equals(key)) return COLS[i]; }
        return null;
    }

    private static String month(String name, String v) {
        if (!v.matches("\\d{4}-(0[1-9]|1[0-2])")) throw new IllegalArgumentException(name + " must be yyyy-MM");
        return v;
    }

    private static String lastMonth(String exclusiveEnd) {
        int y = Integer.parseInt(exclusiveEnd.substring(0, 4)), m = Integer.parseInt(exclusiveEnd.substring(5, 7)) - 1;
        if (m == 0) { y--; m = 12; }
        return y + "-" + (m < 10 ? "0" : "") + m;
    }

    private static String monthLabel(String ym) {
        String[] n = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
        return n[Integer.parseInt(ym.substring(5, 7)) - 1] + " " + ym.substring(0, 4);
    }

    private static Set idSet(String name, String csv, int max, String pattern) {
        Set out = new java.util.LinkedHashSet();
        if (csv.length() == 0) return out;
        String[] parts = csv.split(",");
        if (parts.length > max) throw new IllegalArgumentException("too many values in " + name);
        for (int i = 0; i < parts.length; i++) {
            String v = parts[i].trim();
            if (!v.matches(pattern)) throw new IllegalArgumentException("bad value in " + name);
            out.add(v);
        }
        return out;
    }

    private static boolean in(String[] list, String v) {
        for (int i = 0; i < list.length; i++) { if (list[i].equals(v)) return true; }
        return false;
    }

    private static String name(Map names, String id) {
        String n = (String) names.get(id);
        return n != null ? n : id;
    }

    // DB names are upper case; show them as words
    private static String nice(String s) {
        String t = s.trim().toLowerCase();
        StringBuffer b = new StringBuffer(t.length());
        boolean up = true;
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            b.append(up ? Character.toUpperCase(c) : c);
            up = c == ' ' || c == '(' || c == '.' || c == '-' || c == '/';
        }
        return b.toString();
    }

    private static String clean(String s, int max) {
        String t = s.replaceAll("[\\p{Cntrl}<>\"]", " ").trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String join(List l) {
        StringBuffer sb = new StringBuffer();
        for (int i = 0; i < l.size(); i++) { if (i > 0) sb.append(", "); sb.append(l.get(i)); }
        return sb.toString();
    }

    private static Double pct(double part, double whole) {
        return whole > 0 ? Double.valueOf(Math.round(part / whole * 1000) / 10.0) : null;
    }

    private static double num(Object o) {
        if (o instanceof Number) return ((Number) o).doubleValue();
        return 0;
    }

    private static String str(Object o) { return o == null ? "" : o.toString().trim(); }
}
