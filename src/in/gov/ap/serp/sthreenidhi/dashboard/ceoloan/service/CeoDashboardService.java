/*
 * CEO Loan Intelligence Dashboard
 * Answers the drill-down calls: from the in-memory cubes when possible, otherwise one
 * small query for that scope only. Answers are cached until the next snapshot.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.service;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao.CeoLoanIntelligenceDAO;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao.CeoLoanIntelligenceDAOImpl;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashCube;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashboardSnapshot;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.cache.CeoDashCache;
import in.gov.ap.serp.sthreenidhi.platform.util.FiscalYear;

public final class CeoDashboardService {
    public static final class NotReadyException extends Exception {
        private static final long serialVersionUID = 1L;
        public NotReadyException() { super("Dashboard data is still loading."); }
    }

    public static final class BusyException extends Exception {
        private static final long serialVersionUID = 1L;
        public BusyException() { super("Many detailed lists are being opened right now. Please try again in a minute."); }
    }

    // at most 4 detail queries on SNBSAP at once (-Dceo.dash.drill.max.concurrent)
    private static final Semaphore SQL_SLOTS = new Semaphore(maxConcurrent(), true);
    private static final int SLOT_WAIT_SECONDS = 20;

    private static int maxConcurrent() {
        String v = System.getProperty("ceo.dash.drill.max.concurrent");
        try { int n = Integer.parseInt(v == null ? "" : v.trim()); return n > 0 ? n : 4; }
        catch (Exception e) { return 4; }
    }

    private ArrayList limited(String what, String g, String d, String m, String v, String s,
                              String from, String to, String p) throws Exception {
        if (!SQL_SLOTS.tryAcquire(SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) throw new BusyException();
        try {
            return "member".equals(what) ? dao.getMemberDetail(g) : dao.drill(g, d, m, v, s, from, to, p);
        } finally {
            SQL_SLOTS.release();
        }
    }

    // 24 months for the state, a district or a list of mandals - from memory
    public String trend(String districtId, String mandals) throws Exception {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) throw new NotReadyException();
        CeoDashCube cube = snap.getCube();
        if (cube == null) throw new NotReadyException();
        String d = clean(districtId), list = clean(mandals);
        String key = snap.getBuiltAtMillis() + "|trend|" + d + "|" + list;
        String json = (String) CACHE.get(key);
        if (json != null) return json;

        java.util.Set keys = null;
        if (list != null || d != null) {
            keys = new java.util.HashSet();
            if (list != null) {
                String[] parts = list.split(",");
                if (parts.length > 1000) throw new IllegalArgumentException("too many mandals");
                for (int i = 0; i < parts.length; i++) {
                    String k = parts[i].trim();
                    if (!k.matches("[0-9A-Za-z]{1,6}\\|[0-9A-Za-z]{1,6}")) throw new IllegalArgumentException("bad mandal key");
                    keys.add(k);
                }
            } else {
                if (!d.matches("[0-9A-Za-z]{1,6}")) throw new IllegalArgumentException("bad districtId");
                List ms = snap.getMandals();
                for (int i = 0; i < ms.size(); i++) {
                    Map r = (Map) ms.get(i);
                    if (d.equals(str(r.get("districtId")))) keys.add(d + "|" + str(r.get("mandalId")));
                }
            }
        }
        String[] months = cube.monthList();
        double[][] a = cube.monthlyFor(keys);
        StringBuffer sb = new StringBuffer("{\"months\":[");
        for (int i = 0; i < months.length; i++) {
            double[] x = a[i];
            if (i > 0) sb.append(',');
            sb.append("{\"month\":\"").append(months[i]).append('"')
              .append(",\"loanCount\":").append((long) x[CeoDashCube.LOANS])
              .append(",\"disbursed\":").append(money(x[CeoDashCube.DISBURSED]))
              .append(",\"repayTxns\":").append((long) x[CeoDashCube.TXNS])
              .append(",\"repaid\":").append(money(x[CeoDashCube.REPAID]))
              .append(",\"posAmount\":").append(money(x[CeoDashCube.POS_AMOUNT]))
              .append(",\"upiAmount\":").append(money(x[CeoDashCube.UPI_AMOUNT]))
              .append(",\"autoAmount\":").append(money(x[CeoDashCube.AUTO_AMOUNT]))
              .append('}');
        }
        sb.append("],\"payModes\":").append(CeoLoanIntelligenceDAOImpl.PAY_MODES).append('}');
        json = sb.toString();
        CACHE.put(key, json);
        return json;
    }

    private static final Object KEYED_LOCK = new Object();

    // cash entered per staff login for a period; one SNBSAP scan per snapshot, then served from the cache
    public String cashKeyedBy(String from, String to) throws Exception {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) throw new NotReadyException();
        checkDate("from", from);
        checkDate("to", to);
        if (from.compareTo(to) >= 0) throw new IllegalArgumentException("from must be before to");
        String key = snap.getBuiltAtMillis() + "|keyed|" + from + "|" + to;
        String json = (String) CACHE.get(key);
        if (json != null) return json;
        synchronized (KEYED_LOCK) {
            json = (String) CACHE.get(key);
            if (json != null) return json;
            ArrayList rows;
            if (!SQL_SLOTS.tryAcquire(SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) throw new BusyException();
            try { rows = dao.getCashKeyedBy(from, to); } finally { SQL_SLOTS.release(); }
            StringBuffer sb = new StringBuffer("{\"rows\":[");
            for (int i = 0; i < rows.size(); i++) {
                Map r = (Map) rows.get(i);
                if (i > 0) sb.append(',');
                sb.append("{\"login\":").append(q(str(r.get("CREATED_BY"))))
                  .append(",\"txns\":").append(lng(r.get("TXN_COUNT")))
                  .append(",\"amount\":").append(money(num(r.get("AMOUNT"))))
                  .append(",\"first\":").append(q(str(r.get("FIRST_DATE"))))
                  .append(",\"last\":").append(q(str(r.get("LAST_DATE")))).append('}');
            }
            json = sb.append("]}").toString();
            CACHE.put(key, json);
            return json;
        }
    }

    public ArrayList shgMemberLoans(String shgId) throws Exception {
        if (!SQL_SLOTS.tryAcquire(SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) throw new BusyException();
        try { return dao.getShgMemberLoans(shgId); } finally { SQL_SLOTS.release(); }
    }

    private static final int MAX_CACHED = 5000;
    private static final Map CACHE = Collections.synchronizedMap(new LinkedHashMap(512, 0.75f, true) {
        private static final long serialVersionUID = 1L;
        protected boolean removeEldestEntry(Map.Entry eldest) { return size() > MAX_CACHED; }
    });

    private final CeoLoanIntelligenceDAO dao;

    public CeoDashboardService(CeoLoanIntelligenceDAO dao) { this.dao = dao; }

    // cube first, then the day cube, then one bounded query
    public String drill(String group, String districtId, String mandalId, String voId, String shgId,
                        String from, String to, String project) throws Exception {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) throw new NotReadyException();

        String g = upper(group);
        String d = clean(districtId), m = clean(mandalId), v = clean(voId), s = clean(shgId), p = clean(project);
        checkDate("from", from);
        checkDate("to", to);
        if (from.compareTo(to) >= 0) throw new IllegalArgumentException("from must be before to");
        String scope = s != null ? "SHG" : v != null ? "VO" : m != null ? "MANDAL" : d != null ? "DISTRICT" : "STATE";

        String fy = null;
        if (from.endsWith("-04-01") && to.endsWith("-04-01")
                && Integer.parseInt(to.substring(0, 4)) == Integer.parseInt(from.substring(0, 4)) + 1) {
            fy = FiscalYear.labelFromStartYear(Integer.parseInt(from.substring(0, 4)));
        }
        boolean upToMandal = "STATE".equals(scope) || "DISTRICT".equals(scope) || "MANDAL".equals(scope);

        if ("PURPOSE".equals(g) && fy != null && p == null && upToMandal && snap.getPurposeCube() != null
                && snap.getPurposeCube().covers(from.substring(0, 7), to.substring(0, 7))) {
            return fromCube(snap, snap.getPurposeCube(), CeoDashCube.PROJECT, d, m,
                            from.substring(0, 7), to.substring(0, 7), null, null);
        }

        CeoDashCube cube = snap.getCube();
        boolean wholeMonths = from.endsWith("-01") && to.endsWith("-01");
        String fm = from.substring(0, 7), tm = to.substring(0, 7);
        if (cube != null && tm.compareTo(cube.getEndMonth()) > 0 && fm.compareTo(cube.getEndMonth()) < 0) tm = cube.getEndMonth();
        boolean cubeGroup =
               ("DISTRICT".equals(g) && "STATE".equals(scope))
            || ("MANDAL".equals(g)   && ("STATE".equals(scope) || "DISTRICT".equals(scope)))
            || (("PROJECT".equals(g) || "CATEGORY".equals(g)) && upToMandal);
        if (cube != null && wholeMonths && cubeGroup && cube.covers(fm, tm)) {
            return fromCube(snap, cube, g, d, m, fm, tm, p, p == null ? fy : null);
        }

        CeoDashCube days = snap.getDayCube();
        boolean dayGroup = ("DISTRICT".equals(g) && "STATE".equals(scope))
            || ("MANDAL".equals(g) && ("STATE".equals(scope) || "DISTRICT".equals(scope)));
        if (days != null && dayGroup && p == null && days.covers(from, to)) {
            return fromCube(snap, days, g, d, m, from, to, null, null);
        }

        String key = snap.getBuiltAtMillis() + "|" + g + "|" + d + "|" + m + "|" + v + "|" + s + "|" + from + "|" + to + "|" + p;
        String json = (String) CACHE.get(key);
        if (json == null) {
            ArrayList rows = limited("drill", g, d, m, v, s, from, to, p);
            attachOverdue(snap, rows, g, d, m, v, s);
            json = sqlJson(rows, d);
            CACHE.put(key, json);
        }
        return json;
    }

    private static String fromCube(CeoDashboardSnapshot snap, CeoDashCube cube, String g,
                                   String d, String m, String fm, String tm, String p, String fy) {
        Map sums = cube.aggregate(g, d, m, fm, tm, p);
        Map facts = fy == null ? null : (Map) snap.getFyMandal().get(fy);
        boolean named = cube != snap.getPurposeCube() && CeoDashCube.PROJECT.equals(g);
        List units = new ArrayList();
        if ("DISTRICT".equals(g)) {
            List ds = snap.getDistricts();
            for (int i = 0; i < ds.size(); i++) {
                Map r = (Map) ds.get(i);
                units.add(new String[] { str(r.get("id")), str(r.get("name")), str(r.get("id")), str(r.get("id")) });
            }
        } else if ("MANDAL".equals(g)) {
            List ms = snap.getMandals();
            for (int i = 0; i < ms.size(); i++) {
                Map r = (Map) ms.get(i);
                String did = str(r.get("districtId"));
                if (d != null && !d.equals(did)) continue;
                String mid = str(r.get("mandalId"));
                units.add(new String[] { mid, str(r.get("name")), did, did + "|" + mid });
            }
        } else {
            for (Iterator it = sums.keySet().iterator(); it.hasNext();) {
                String type = (String) it.next();
                units.add(new String[] { type, named ? cube.projectName(type) : type, d, type });
            }
        }
        StringBuffer sb = new StringBuffer("{\"source\":\"memory\",\"payModes\":" + CeoLoanIntelligenceDAOImpl.PAY_MODES + ",\"rows\":[");
        for (int i = 0; i < units.size(); i++) {
            String[] u = (String[]) units.get(i);
            double[] a = (double[]) sums.get(u[3]);
            if (a == null) a = new double[CeoDashCube.MEASURES];
            double[] f = facts == null ? null
                       : "MANDAL".equals(g) ? (double[]) facts.get(u[3])
                       : "DISTRICT".equals(g) ? districtFacts(facts, u[0]) : null;
            boolean known = facts != null && ("MANDAL".equals(g) || "DISTRICT".equals(g));
            if (i > 0) sb.append(",");
            row(sb, u[0], u[1], u[2], null,
                (long) a[CeoDashCube.LOANS], a[CeoDashCube.DISBURSED], (long) a[CeoDashCube.OPEN],
                (long) a[CeoDashCube.CLOSED], known ? (Object) Long.valueOf(f == null ? 0L : (long) f[0]) : null,
                (long) a[CeoDashCube.TXNS], a[CeoDashCube.REPAID], null,
                Double.valueOf(a[CeoDashCube.OPEN_AMOUNT]), known ? (Object) Double.valueOf(f == null ? 0d : f[1]) : null,
                new double[] { a[CeoDashCube.POS_AMOUNT], a[CeoDashCube.UPI_AMOUNT], a[CeoDashCube.AUTO_AMOUNT],
                               a[CeoDashCube.POS_TXNS], a[CeoDashCube.UPI_TXNS], a[CeoDashCube.AUTO_TXNS] });
        }
        return sb.append("]}").toString();
    }

    private static double[] districtFacts(Map facts, String districtId) {
        double[] t = new double[2];
        String prefix = districtId + "|";
        for (Iterator it = facts.entrySet().iterator(); it.hasNext();) {
            Map.Entry e = (Map.Entry) it.next();
            if (!((String) e.getKey()).startsWith(prefix)) continue;
            double[] f = (double[]) e.getValue();
            t[0] += f[0]; t[1] += f[1];
        }
        return t;
    }

    // overdue of today's open loans for VOs, SHGs and women (one small indexed read); a failure only leaves it out
    private void attachOverdue(CeoDashboardSnapshot snap, ArrayList rows, String g, String d, String m, String v, String s) {
        if (!("VO".equals(g) || "SHG".equals(g) || "MEMBER".equals(g)) || !CeoDashExport.isOverdueReady(snap) || rows.isEmpty()) return;
        try {
            ArrayList od;
            if (!SQL_SLOTS.tryAcquire(SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) return;
            try { od = dao.getOverdueByUnit(g, d, m, v, s); } finally { SQL_SLOTS.release(); }
            Map by = new HashMap();
            for (int i = 0; i < od.size(); i++) { Map r = (Map) od.get(i); by.put(str(r.get("UNIT_ID")), r); }
            for (int i = 0; i < rows.size(); i++) {
                Map row = (Map) rows.get(i);
                Object o = by.get(str(row.get("UNIT_ID")));
                if (o != null) row.put("OD", o);
            }
        } catch (Exception e) {
            in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util.CeoLog.warn("Overdue for " + g + " list not added: " + e.getMessage());
        }
    }

    private static void appendOverdue(StringBuffer sb, Map r) {
        Map od = (Map) r.get("OD");
        if (od == null) return;
        sb.setLength(sb.length() - 1);
        sb.append(",\"od\":{\"open\":").append(lng(od.get("STATUS_LOANS")))
          .append(",\"loans\":").append(lng(od.get("OVERDUE_LOANS")))
          .append(",\"amount\":").append(money(num(od.get("OVERDUE_AMOUNT"))))
          .append(",\"outstanding\":").append(money(num(od.get("OUTSTANDING_AMOUNT"))))
          .append(",\"atRisk\":").append(money(num(od.get("OVERDUE_OUTSTANDING")))).append("}}");
    }

    private static String sqlJson(ArrayList rows, String districtId) {
        StringBuffer sb = new StringBuffer("{\"source\":\"sql\",\"payModes\":" + CeoLoanIntelligenceDAOImpl.PAY_MODES + ",\"rows\":[");
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            if (i > 0) sb.append(",");
            row(sb, str(r.get("UNIT_ID")), str(r.get("UNIT_NAME")), districtId, r.get("ACTIVE_MEMBERS"),
                lng(r.get("LOAN_COUNT")), num(r.get("DISBURSED_AMOUNT")),
                Long.valueOf(lng(r.get("OPEN_LOAN_COUNT"))), Long.valueOf(lng(r.get("CLOSED_LOAN_COUNT"))),
                r.get("BORROWERS"), lng(r.get("REPAYMENT_TXN_COUNT")), num(r.get("REPAID_AMOUNT")), r.get("PAYERS"),
                Double.valueOf(num(r.get("OPEN_AMOUNT"))), null,
                new double[] { num(r.get("REPAID_POS")), num(r.get("REPAID_UPI")), num(r.get("REPAID_AUTO")),
                               num(r.get("TXNS_POS")), num(r.get("TXNS_UPI")), num(r.get("TXNS_AUTO")) });
            String parent = str(r.get("PARENT_ID"));
            if (parent.length() > 0) {
                // SHG rows of a whole mandal also carry their VO, so the page can open the SHG
                sb.setLength(sb.length() - 1);
                sb.append(",\"parentId\":").append(q(parent)).append('}');
            }
            appendOverdue(sb, r);
        }
        return sb.append("]}").toString();
    }

    private static void row(StringBuffer sb, String id, String name, String districtId, Object activeMembers,
                            long loans, double disbursed, Object open, Object closed, Object borrowers,
                            long txns, double repaid, Object payers, Double openAmount, Object targetCrore,
                            double[] modes) {
        sb.append("{\"id\":").append(q(id))
          .append(",\"name\":").append(q(name))
          .append(",\"districtId\":").append(q(districtId))
          .append(",\"activeMembers\":").append(n(activeMembers))
          .append(",\"loanCount\":").append(loans)
          .append(",\"disbursed\":").append(money(disbursed))
          .append(",\"openLoans\":").append(n(open))
          .append(",\"closedLoans\":").append(n(closed))
          .append(",\"borrowers\":").append(n(borrowers))
          .append(",\"repayTxns\":").append(txns)
          .append(",\"repaid\":").append(money(repaid))
          .append(",\"payers\":").append(n(payers))
          .append(",\"openAmount\":").append(openAmount == null ? "null" : money(openAmount.doubleValue()))
          .append(",\"posAmount\":").append(money(modes[0]))
          .append(",\"upiAmount\":").append(money(modes[1]))
          .append(",\"autoAmount\":").append(money(modes[2]))
          .append(",\"posTxns\":").append((long) modes[3])
          .append(",\"upiTxns\":").append((long) modes[4])
          .append(",\"autoTxns\":").append((long) modes[5])
          .append(",\"targetCr\":").append(targetCrore instanceof Double ? money(((Double) targetCrore).doubleValue()) : n(targetCrore))
          .append("}");
    }

    public String member(String memberId) throws Exception {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) throw new NotReadyException();
        String key = snap.getBuiltAtMillis() + "|member|" + clean(memberId);
        String json = (String) CACHE.get(key);
        if (json != null) return json;

        ArrayList rows = limited("member", memberId, null, null, null, null, null, null, null);
        Map member = null;
        List loans = new ArrayList();
        Map loanById = new LinkedHashMap();
        Map txnsByLoan = new HashMap();
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            String type = str(r.get("ROW_TYPE"));
            if ("MEMBER".equals(type)) member = r;
            else if ("LOAN".equals(type)) { loans.add(r); loanById.put(str(r.get("SHG_MEMBER_LOAN_ACCNO")), r); }
            else if ("REPAYMENT".equals(type)) {
                String acc = str(r.get("SHG_MEMBER_LOAN_ACCNO"));
                List l = (List) txnsByLoan.get(acc);
                if (l == null) { l = new ArrayList(); txnsByLoan.put(acc, l); }
                l.add(r);
            }
        }
        Map arrears = new HashMap();      // loan number -> overdue figures of that loan (open loans only)
        if (member != null && CeoDashExport.isOverdueReady(snap) && !loans.isEmpty()) {
            try {
                ArrayList od;
                if (SQL_SLOTS.tryAcquire(SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) {
                    try { od = dao.getOverdueByLoan(str(member.get("SHG_ID"))); } finally { SQL_SLOTS.release(); }
                    for (int i = 0; i < od.size(); i++) { Map r = (Map) od.get(i); arrears.put(str(r.get("LOAN_ACCNO")), r); }
                }
            } catch (Exception e) {
                in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util.CeoLog.warn("Overdue of the loans not added: " + e.getMessage());
            }
        }
        StringBuffer sb = new StringBuffer("{\"member\":");
        if (member == null) sb.append("null");
        else sb.append("{\"id\":").append(q(str(member.get("MEMBER_ID"))))
               .append(",\"name\":").append(q(str(member.get("MEMBER_NAME"))))
               .append(",\"shgId\":").append(q(str(member.get("SHG_ID"))))
               .append(",\"surname\":").append(q(txt(member.get("MEMBER_SURNAME"))))
               .append(",\"fatherHusband\":").append(q((txt(member.get("FH_NAME")) + " " + txt(member.get("FH_SURNAME"))).trim()))
               .append(",\"birthYear\":").append(n(member.get("BIRTH_YEAR")))
               .append(",\"marital\":").append(q(txt(member.get("MARITAL_STATUS"))))
               .append(",\"category\":").append(q(txt(member.get("CATEGORY"))))
               .append(",\"education\":").append(q(txt(member.get("EDUCATION"))))
               .append(",\"wellbeing\":").append(q(txt(member.get("WELLBEING"))))
               .append(",\"village\":").append(q(txt(member.get("VILLAGE"))))
               .append(",\"registered\":").append(q(txt(member.get("REGISTERED"))))
               .append(",\"disabled\":").append(q(txt(member.get("IS_DISABLED"))))
               .append(",\"mobileLast4\":").append(q(txt(member.get("MOBILE_LAST4")))).append("}");
        sb.append(",\"loans\":[");
        for (int i = 0; i < loans.size(); i++) {
            Map l = (Map) loans.get(i);
            String acc = str(l.get("SHG_MEMBER_LOAN_ACCNO"));
            List txns = (List) txnsByLoan.get(acc);
            if (txns == null) txns = new ArrayList();
            double repaid = 0;
            String last = null;
            for (int t = 0; t < txns.size(); t++) {
                Map x = (Map) txns.get(t);
                repaid += num(x.get("REPAID_AMOUNT"));
                String dt = str(x.get("REPAYMENT_DATE"));
                if (last == null || dt.compareTo(last) > 0) last = dt;
            }
            if (i > 0) sb.append(",");
            sb.append("{\"id\":").append(q(acc))
              .append(",\"shgLoanAccNo\":").append(q(str(l.get("SHG_LOAN_ACCNO"))))
              .append(",\"projectType\":").append(q(str(l.get("PROJECT_TYPE"))))
              .append(",\"projectName\":").append(q(str(l.get("PROJECT_NAME"))))
              .append(",\"purpose\":").append(q(str(l.get("PURPOSE"))))
              .append(",\"amount\":").append(money(num(l.get("LOAN_AMOUNT_ISSUED"))))
              .append(",\"status\":").append(q(str(l.get("LOAN_STATUS"))))
              .append(",\"issuedDate\":").append(q(str(l.get("ISSUED_DATE"))))
              .append(",\"repaid\":").append(money(repaid))
              .append(",\"repayTxns\":").append(txns.size())
              .append(",\"lastRepaymentDate\":").append(q(last));
            Map ar = (Map) arrears.get(acc);
            if (ar != null) {
                sb.append(",\"arrears\":").append(money(num(ar.get("ARREARS"))))
                  .append(",\"emi\":").append(money(num(ar.get("EMI"))))
                  .append(",\"balance\":").append(money(num(ar.get("OUTSTANDING"))))
                  .append(",\"dueDate\":").append(q(str(ar.get("DUE_DATE"))));
            }
            sb.append(",\"repayments\":[");
            for (int t = 0; t < txns.size(); t++) {
                Map x = (Map) txns.get(t);
                if (t > 0) sb.append(",");
                sb.append("{\"id\":").append(q(str(x.get("SHG_CREDIT_ID"))))
                  .append(",\"date\":").append(q(str(x.get("REPAYMENT_DATE"))))
                  .append(",\"amount\":").append(money(num(x.get("REPAID_AMOUNT"))))
                  .append(",\"status\":").append(q(str(x.get("REPAY_STATUS"))))
                  .append(",\"processed\":").append(q(str(x.get("IS_PROCESSED"))))
                  .append(",\"adjustType\":").append(q(str(x.get("ADJUST_TYPE"))))
                  .append(",\"creditedDate\":").append(q(str(x.get("CREDITED_DATE"))))
                  .append(",\"mode\":").append(q(str(x.get("PAY_MODE"))))
                  .append("}");
            }
            sb.append("]}");
        }
        json = sb.append("]}").toString();
        CACHE.put(key, json);
        return json;
    }

    private static void checkDate(String name, String v) {
        if (v == null || !v.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException(name + " must be yyyy-MM-dd");
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd");
        f.setLenient(false);
        try { f.parse(v); } catch (java.text.ParseException e) { throw new IllegalArgumentException(name + " is not a date: " + v); }
    }

    private static String clean(String s) { return s == null || s.trim().length() == 0 ? null : s.trim(); }
    private static String upper(String s) { return s == null ? "" : s.trim().toUpperCase(); }
    private static String str(Object o) { return o == null ? "" : o.toString().trim(); }

    private static double num(Object o) {
        if (o instanceof Number) return ((Number) o).doubleValue();
        if (o == null) return 0;
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return 0; }
    }

    private static long lng(Object o) { return (long) num(o); }

    private static String txt(Object o) {
        String s = o == null ? "" : o.toString().trim();
        return s.replaceAll("[?\\s]", "").length() == 0 ? "" : s;
    }

    public String shg(String shgId) throws Exception {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) throw new NotReadyException();
        String key = snap.getBuiltAtMillis() + "|shg|" + clean(shgId);
        String json = (String) CACHE.get(key);
        if (json != null) return json;
        ArrayList rows;
        if (!SQL_SLOTS.tryAcquire(SLOT_WAIT_SECONDS, TimeUnit.SECONDS)) throw new BusyException();
        try { rows = dao.getShgInfo(shgId); } finally { SQL_SLOTS.release(); }
        StringBuffer sb = new StringBuffer("{\"shg\":");
        if (rows.isEmpty()) sb.append("null");
        else {
            Map r = (Map) rows.get(0);
            sb.append("{\"id\":").append(q(txt(r.get("SHG_ID"))))
              .append(",\"name\":").append(q(txt(r.get("SHG_NAME"))))
              .append(",\"voName\":").append(q(txt(r.get("VO_NAME"))))
              .append(",\"registered\":").append(q(txt(r.get("REGISTERED"))))
              .append(",\"members\":").append(n(r.get("NUMBER_OF_MEMBERS")))
              .append(",\"category\":").append(q(txt(r.get("SOCIAL_CATEGORY"))))
              .append(",\"village\":").append(q(txt(r.get("VILLAGE"))))
              .append(",\"wellbeing\":").append(q(txt(r.get("WELLBEING"))))
              .append(",\"grade\":").append(q(txt(r.get("GRADE"))))
              .append(",\"bank\":").append(q(txt(r.get("BANK_NAME"))))
              .append(",\"branch\":").append(q(txt(r.get("BRANCH_NAME"))))
              .append(",\"disabled\":").append(q(txt(r.get("DISABLED"))))
              .append(",\"minority\":").append(q(txt(r.get("MINORITY"))))
              .append(",\"mobileLast4\":").append(q(txt(r.get("MOBILE_LAST4")))).append("}");
        }
        json = sb.append("}").toString();
        CACHE.put(key, json);
        return json;
    }

    private static String money(double d) {
        return BigDecimal.valueOf(d).setScale(2, BigDecimal.ROUND_HALF_UP).toPlainString();
    }

    private static String n(Object o) {
        if (o == null) return "null";
        if (o instanceof Number) return o instanceof BigDecimal ? ((BigDecimal) o).toPlainString() : o.toString();
        return "null";
    }

    static String q(String s) {
        if (s == null) return "null";
        StringBuffer b = new StringBuffer(s.length() + 8).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': b.append("\\\\"); break;
                case '"':  b.append("\\\""); break;
                case '\n': b.append("\\n");  break;
                case '\r': b.append("\\r");  break;
                case '\t': b.append("\\t");  break;
                case '<':  b.append("\\u003c"); break;
                default:
                    if (c < 0x20) { b.append("\\u00").append(c < 0x10 ? "0" : "").append(Integer.toHexString(c)); }
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }
}
