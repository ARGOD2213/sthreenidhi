/*
 * CEO Loan Intelligence Dashboard
 * Runs the extraction queries and turns the rows into a snapshot. Any query failure
 * aborts the build and the snapshot already live stays in use.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.cache;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao.CeoLoanIntelligenceDAO;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashCube;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashboardSnapshot;
import in.gov.ap.serp.sthreenidhi.platform.util.FiscalYear;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util.CeoLog;

public final class CeoDashboardSnapshotBuilder {
    private static final int TOP_PURPOSES_PER_DISTRICT = 10;
    private static final int TOP_PURPOSES_STATE        = 20;
    private static final String OTHERS = "Others";

    private static final Map SLUG_ALIASES = new HashMap();
    static {
        SLUG_ALIASES.put("spsr-nellore", "sri-potti-sriramulu-nellore");
        SLUG_ALIASES.put("dr-br-ambedkar-konaseema", "konaseema");
    }

    private CeoDashboardSnapshotBuilder() { }

    public static CeoDashboardSnapshot build(CeoLoanIntelligenceDAO dao, String fyLabel) throws Exception {
        long t0 = System.currentTimeMillis();
        int y = FiscalYear.startYearOfLabel(fyLabel);
        String start = FiscalYear.fyStart(y);
        String end   = FiscalYear.fyEndExclusive(y);
        CeoLog.info("Snapshot build start fy=" + fyLabel + " period=[" + start + ", " + end + ")");

        List months = trendMonths(y, new Date());
        String winStart = months.get(0) + "-01";
        String winEnd   = nextMonthStart((String) months.get(months.size() - 1));

        ArrayList distRows    = dao.getDistrictRollup(fyLabel, start, end);
        ArrayList loanDays    = dao.getMandalDailyLoanRollup(start, end);
        ArrayList repayDays   = dao.getMandalDailyRepaymentRollup(start, end);
        ArrayList projRows    = dao.getDistrictProjectComposition(start, end);
        String prevLabel = FiscalYear.labelFromStartYear(y - 1);
        String prevStart = FiscalYear.fyStart(y - 1);
        ArrayList purposeCur  = dao.getMandalPurposeRollup(start, end);
        ArrayList purposePrev = dao.getMandalPurposeRollup(prevStart, start);
        ArrayList loansPrev   = dao.getMandalLoanRollup(prevStart, start);
        ArrayList tgtPrev     = dao.getMandalTargetRollup(prevLabel);
        ArrayList mandalDim   = dao.getActiveMandals();
        ArrayList mandalLoans = dao.getMandalLoanRollup(start, end);
        ArrayList mandalTgt   = dao.getMandalTargetRollup(fyLabel);
        ArrayList mapping     = dao.getOfficerMandalMapping();
        ArrayList loanCube    = dao.getLoanCube(winStart, winEnd);
        ArrayList repayCube   = dao.getRepaymentCube(winStart, winEnd);
        ArrayList projNames   = dao.getProjectNames();
        ArrayList overdueRows = new ArrayList();
        boolean overdueOk = true;
        try {
            // -Dceo.dash.overdue=false switches overdue off without a redeploy
            if ("false".equalsIgnoreCase(System.getProperty("ceo.dash.overdue", "true").trim())) {
                overdueOk = false;
                CeoLog.info("Overdue figures are switched off (-Dceo.dash.overdue=false)");
            } else {
                overdueRows = dao.getMandalOverdueRollup();
            }
        } catch (Exception e) {
            overdueOk = false;
            CeoLog.warn("Overdue figures not available (" + e.getMessage() + "); the dashboard runs without them");
        }

        CeoDashCube cube = buildCube(winStart.substring(0, 7), winEnd.substring(0, 7), loanCube, repayCube, projNames);
        ArrayList loanMonths  = new ArrayList();
        ArrayList repayMonths = new ArrayList();
        monthlyFromCube(cube, months, loanMonths, repayMonths);
        ArrayList mandalRepay = mandalRepayFromCube(cube, start.substring(0, 7), end.substring(0, 7));

        List districts = buildDistricts(distRows);
        Map  totals    = buildTotals(districts);
        List monthly   = mergeByPeriod(loanMonths, repayMonths, "PERIOD_MONTH", "month");
        CeoDashCube dayCube = buildDayCube(start, end, loanDays, repayDays);
        List daily     = mergeByPeriod(loanDays, repayDays, "PERIOD_DAY", "day");
        List projects  = buildProjects(projRows);
        List purposes  = buildPurposes(districtPurposes(purposeCur));
        CeoDashCube purposeCube = buildPurposeCube(prevStart.substring(0, 7), end.substring(0, 7),
                                                   start.substring(0, 7), purposeCur, prevStart.substring(0, 7), purposePrev);
        Map fyMandal = new HashMap();
        fyMandal.put(fyLabel, fyMandalFacts(mandalLoans, mandalTgt));
        fyMandal.put(prevLabel, fyMandalFacts(loansPrev, tgtPrev));
        List mandals   = buildMandals(mandalDim, mandalLoans, mandalRepay, mandalTgt, mapping, overdueRows);
        addOverdueToDistricts(districts, mandals);
        addOverdueToTotals(totals, districts, overdueOk && overdueSane(districts));
        List employees = buildEmployees(mandals);

        CeoLog.info("Snapshot build done in " + (System.currentTimeMillis() - t0) + " ms:"
                + " districts=" + districts.size() + " months=" + months.size()
                + " monthly=" + monthly.size() + " daily=" + daily.size()
                + " projects=" + projects.size() + " purposes=" + purposes.size()
                + " mandals=" + mandals.size() + " employees=" + employees.size()
                + " cubeLoanCells=" + cube.loanCells() + " cubeRepayCells=" + cube.repayCells()
                + " dayCells=" + (dayCube.loanCells() + dayCube.repayCells()));

        return new CeoDashboardSnapshot(System.currentTimeMillis(), fyLabel, start, end,
                districts, months, monthly, daily, projects, purposes, mandals, employees, totals, cube, dayCube,
                purposeCube, fyMandal, false);
    }

    private static CeoDashCube buildCube(String firstMonth, String endMonth,
                                         ArrayList loanCube, ArrayList repayCube, ArrayList projNames) {
        CeoDashCube.Builder b = new CeoDashCube.Builder(firstMonth, endMonth);
        for (int i = 0; i < projNames.size(); i++) {
            Map r = (Map) projNames.get(i);
            b.projectName(str(r.get("PROJECT_TYPE")), str(r.get("PROJECT_NAME")));
        }
        for (int i = 0; i < loanCube.size(); i++) {
            Map r = (Map) loanCube.get(i);
            b.addLoan(str(r.get("DISTRICT_ID")), str(r.get("MANDAL_ID")), str(r.get("PERIOD_MONTH")),
                      str(r.get("PROJECT_TYPE")), str(r.get("CATEGORY")), lng(r.get("LOAN_COUNT")).longValue(),
                      dec(r.get("DISBURSED_AMOUNT")).doubleValue(),
                      lng(r.get("OPEN_LOAN_COUNT")).longValue(), lng(r.get("CLOSED_LOAN_COUNT")).longValue(),
                      dec(r.get("OPEN_AMOUNT")).doubleValue());
        }
        for (int i = 0; i < repayCube.size(); i++) {
            Map r = (Map) repayCube.get(i);
            b.addRepayment(str(r.get("DISTRICT_ID")), str(r.get("MANDAL_ID")), str(r.get("PERIOD_MONTH")),
                           str(r.get("PROJECT_TYPE")), lng(r.get("REPAYMENT_TXN_COUNT")).longValue(),
                           dec(r.get("REPAID_AMOUNT")).doubleValue(), modeAmounts(r), modeTxns(r));
        }
        return b.build();
    }

    private static CeoDashCube buildPurposeCube(String firstMonth, String endMonth,
                                                String curMonth, ArrayList cur, String prevMonth, ArrayList prev) {
        CeoDashCube.Builder b = new CeoDashCube.Builder(firstMonth, endMonth);
        addPurposes(b, curMonth, cur);
        addPurposes(b, prevMonth, prev);
        return b.build();
    }

    private static void addPurposes(CeoDashCube.Builder b, String month, ArrayList rows) {
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            b.addLoan(str(r.get("DISTRICT_ID")), str(r.get("MANDAL_ID")), month, str(r.get("PURPOSE")), "",
                      lng(r.get("LOAN_COUNT")).longValue(), dec(r.get("DISBURSED_AMOUNT")).doubleValue(),
                      lng(r.get("OPEN_LOAN_COUNT")).longValue(), lng(r.get("CLOSED_LOAN_COUNT")).longValue(),
                      dec(r.get("OPEN_AMOUNT")).doubleValue());
        }
    }

    private static ArrayList districtPurposes(ArrayList mandalRows) {
        Map by = new LinkedHashMap();
        for (int i = 0; i < mandalRows.size(); i++) {
            Map r = (Map) mandalRows.get(i);
            String purpose = str(r.get("PURPOSE"));
            String k = str(r.get("DISTRICT_ID")) + "|" + purpose;
            Map t = (Map) by.get(k);
            if (t == null) {
                t = new HashMap();
                t.put("DISTRICT_ID", str(r.get("DISTRICT_ID")));
                t.put("PURPOSE", purpose.length() == 0 ? null : purpose);
                t.put("LOAN_COUNT", Long.valueOf(0));
                t.put("DISBURSED_AMOUNT", BigDecimal.ZERO);
                t.put("MEMBERS_ACTIVE_LOAN_SIDE", Long.valueOf(0));
                by.put(k, t);
            }
            incLong(t, "LOAN_COUNT", lng(r.get("LOAN_COUNT")).longValue());
            incDec(t, "DISBURSED_AMOUNT", dec(r.get("DISBURSED_AMOUNT")));
            incLong(t, "MEMBERS_ACTIVE_LOAN_SIDE", lng(r.get("MEMBERS_ACTIVE_LOAN_SIDE")).longValue());
        }
        return new ArrayList(by.values());
    }

    private static Map fyMandalFacts(ArrayList loans, ArrayList targets) {
        Map out = new HashMap();
        for (int i = 0; i < loans.size(); i++) {
            Map r = (Map) loans.get(i);
            facts(out, key(r))[0] += lng(r.get("MEMBERS_ACTIVE_LOAN_SIDE")).longValue();
        }
        for (int i = 0; i < targets.size(); i++) {
            Map r = (Map) targets.get(i);
            facts(out, key(r))[1] += dec(r.get("TARGET_AMOUNT")).doubleValue();
        }
        return out;
    }

    private static double[] facts(Map m, String k) {
        double[] a = (double[]) m.get(k);
        if (a == null) { a = new double[2]; m.put(k, a); }
        return a;
    }

    private static double[] modeAmounts(Map r) {
        return new double[] { dec(r.get("REPAID_POS")).doubleValue(), dec(r.get("REPAID_UPI")).doubleValue(),
                              dec(r.get("REPAID_AUTO")).doubleValue() };
    }

    private static long[] modeTxns(Map r) {
        return new long[] { lng(r.get("TXNS_POS")).longValue(), lng(r.get("TXNS_UPI")).longValue(),
                            lng(r.get("TXNS_AUTO")).longValue() };
    }

    private static CeoDashCube buildDayCube(String start, String end, ArrayList loanDays, ArrayList repayDays) {
        CeoDashCube.Builder b = new CeoDashCube.Builder(start, end);
        for (int i = 0; i < loanDays.size(); i++) {
            Map r = (Map) loanDays.get(i);
            b.addLoan(str(r.get("DISTRICT_ID")), str(r.get("MANDAL_ID")), str(r.get("PERIOD_DAY")), "",
                      lng(r.get("LOAN_COUNT")).longValue(), dec(r.get("DISBURSED_AMOUNT")).doubleValue(),
                      lng(r.get("OPEN_LOAN_COUNT")).longValue(), lng(r.get("CLOSED_LOAN_COUNT")).longValue());
        }
        for (int i = 0; i < repayDays.size(); i++) {
            Map r = (Map) repayDays.get(i);
            b.addRepayment(str(r.get("DISTRICT_ID")), str(r.get("MANDAL_ID")), str(r.get("PERIOD_DAY")), "",
                           lng(r.get("REPAYMENT_TXN_COUNT")).longValue(), dec(r.get("REPAID_AMOUNT")).doubleValue(),
                           modeAmounts(r), modeTxns(r));
        }
        return b.build();
    }

    private static void monthlyFromCube(CeoDashCube cube, List months, ArrayList loanRows, ArrayList repayRows) {
        for (int i = 0; i < months.size(); i++) {
            String m = (String) months.get(i);
            String next = nextMonthStart(m).substring(0, 7);
            Map sums = cube.aggregate(CeoDashCube.DISTRICT, null, null, m, next, null);
            for (Iterator it = sums.entrySet().iterator(); it.hasNext();) {
                Map.Entry e = (Map.Entry) it.next();
                double[] a = (double[]) e.getValue();
                if (a[CeoDashCube.LOANS] != 0 || a[CeoDashCube.DISBURSED] != 0) {
                    Map r = new HashMap();
                    r.put("DISTRICT_ID", e.getKey());
                    r.put("PERIOD_MONTH", m);
                    r.put("LOAN_COUNT", Long.valueOf((long) a[CeoDashCube.LOANS]));
                    r.put("DISBURSED_AMOUNT", money(a[CeoDashCube.DISBURSED]));
                    loanRows.add(r);
                }
                if (a[CeoDashCube.TXNS] != 0 || a[CeoDashCube.REPAID] != 0) {
                    Map r = new HashMap();
                    r.put("DISTRICT_ID", e.getKey());
                    r.put("PERIOD_MONTH", m);
                    r.put("REPAYMENT_TXN_COUNT", Long.valueOf((long) a[CeoDashCube.TXNS]));
                    r.put("REPAID_AMOUNT", money(a[CeoDashCube.REPAID]));
                    repayRows.add(r);
                }
            }
        }
    }

    private static ArrayList mandalRepayFromCube(CeoDashCube cube, String fromMonth, String toMonth) {
        String to = toMonth.compareTo(cube.getEndMonth()) < 0 ? toMonth : cube.getEndMonth();
        ArrayList out = new ArrayList();
        if (fromMonth.compareTo(to) >= 0) return out;
        Map sums = cube.aggregate(CeoDashCube.MANDAL, null, null, fromMonth, to, null);
        for (Iterator it = sums.entrySet().iterator(); it.hasNext();) {
            Map.Entry e = (Map.Entry) it.next();
            String k = (String) e.getKey();
            int bar = k.indexOf('|');
            double[] a = (double[]) e.getValue();
            Map r = new HashMap();
            r.put("DISTRICT_ID", k.substring(0, bar));
            r.put("MANDAL_ID", k.substring(bar + 1));
            r.put("REPAYMENT_TXN_COUNT", Long.valueOf((long) a[CeoDashCube.TXNS]));
            r.put("REPAID_AMOUNT", money(a[CeoDashCube.REPAID]));
            out.add(r);
        }
        return out;
    }

    private static BigDecimal money(double v) {
        return new BigDecimal(v).setScale(2, BigDecimal.ROUND_HALF_UP);
    }

    static List trendMonths(int fyStartYear, Date now) {
        Calendar c = Calendar.getInstance();
        c.setTime(now);
        int nowKey   = c.get(Calendar.YEAR) * 12 + c.get(Calendar.MONTH);
        int fyFirst  = fyStartYear * 12 + Calendar.APRIL;
        int fyLast   = (fyStartYear + 1) * 12 + Calendar.MARCH;
        int anchor   = Math.max(fyFirst, Math.min(nowKey, fyLast));
        List out = new ArrayList();
        for (int k = anchor - 23; k <= anchor; k++) {
            int m = k % 12 + 1;
            out.add((k / 12) + "-" + (m < 10 ? "0" : "") + m);
        }
        return out;
    }

    static String nextMonthStart(String yyyyMM) {
        int y = Integer.parseInt(yyyyMM.substring(0, 4));
        int m = Integer.parseInt(yyyyMM.substring(5, 7));
        if (m == 12) { y++; m = 1; } else { m++; }
        return y + "-" + (m < 10 ? "0" : "") + m + "-01";
    }

    private static List buildDistricts(ArrayList rows) {
        List out = new ArrayList();
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            String name = str(r.get("DISTRICT_NAME"));
            Map d = new LinkedHashMap();
            d.put("id",               str(r.get("DISTRICT_ID")));
            d.put("name",             name);
            d.put("slug",             slugOf(name));
            d.put("activeMembers",    lng(r.get("ACTIVE_MEMBERS")));
            d.put("membersWithLoans", lng(r.get("MEMBERS_WITH_LOANS")));
            d.put("membersLoanSide",  lng(r.get("MEMBERS_ACTIVE_LOAN_SIDE")));
            d.put("membersRepaySide", lng(r.get("MEMBERS_ACTIVE_REPAY_SIDE")));
            d.put("loanCount",        lng(r.get("LOAN_COUNT")));
            d.put("disbursed",        dec(r.get("DISBURSED_AMOUNT")));
            d.put("openLoans",        lng(r.get("OPEN_LOAN_COUNT")));
            d.put("closedLoans",      lng(r.get("CLOSED_LOAN_COUNT")));
            d.put("repayTxns",        lng(r.get("REPAYMENT_TXN_COUNT")));
            d.put("repaid",           dec(r.get("REPAID_AMOUNT")));
            d.put("repaidClosed",     dec(r.get("REPAID_AMOUNT_CLOSED")));
            d.put("repaidUnprocessed",dec(r.get("REPAID_AMOUNT_UNPROCESSED")));
            d.put("repaidAdjustment", dec(r.get("REPAID_AMOUNT_ADJUSTMENT")));
            d.put("targetAmount",     dec(r.get("TARGET_AMOUNT")));
            out.add(d);
        }
        return out;
    }

    private static Map buildTotals(List districts) {
        String[] longs = { "activeMembers", "membersWithLoans", "membersLoanSide", "membersRepaySide",
                           "loanCount", "openLoans", "closedLoans", "repayTxns" };
        String[] decs  = { "disbursed", "repaid", "repaidClosed", "repaidUnprocessed",
                           "repaidAdjustment", "targetAmount" };
        Map t = new LinkedHashMap();
        for (int k = 0; k < longs.length; k++) t.put(longs[k], Long.valueOf(sumLong(districts, longs[k])));
        for (int k = 0; k < decs.length; k++)  t.put(decs[k], sumDec(districts, decs[k]));
        return t;
    }

    private static List mergeByPeriod(ArrayList loanRows, ArrayList repayRows,
                                      String periodCol, String periodKey) {
        TreeMap byKey = new TreeMap();
        for (int i = 0; i < loanRows.size(); i++) {
            Map r = (Map) loanRows.get(i);
            Map m = periodRow(byKey, str(r.get("DISTRICT_ID")), periodKey, str(r.get(periodCol)));
            incLong(m, "loanCount", lng(r.get("LOAN_COUNT")).longValue());
            incDec(m, "disbursed", dec(r.get("DISBURSED_AMOUNT")));
        }
        for (int i = 0; i < repayRows.size(); i++) {
            Map r = (Map) repayRows.get(i);
            Map m = periodRow(byKey, str(r.get("DISTRICT_ID")), periodKey, str(r.get(periodCol)));
            incLong(m, "repayTxns", lng(r.get("REPAYMENT_TXN_COUNT")).longValue());
            incDec(m, "repaid", dec(r.get("REPAID_AMOUNT")));
        }
        return new ArrayList(byKey.values());
    }

    private static Map periodRow(TreeMap byKey, String districtId, String periodKey, String period) {
        String key = districtId + "|" + period;
        Map m = (Map) byKey.get(key);
        if (m == null) {
            m = new LinkedHashMap();
            m.put("districtId", districtId);
            m.put(periodKey,    period);
            m.put("loanCount",  Long.valueOf(0));
            m.put("disbursed",  BigDecimal.ZERO);
            m.put("repayTxns",  Long.valueOf(0));
            m.put("repaid",     BigDecimal.ZERO);
            byKey.put(key, m);
        }
        return m;
    }

    private static List buildProjects(ArrayList rows) {
        List out = new ArrayList();
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            Map p = new LinkedHashMap();
            p.put("districtId",  str(r.get("DISTRICT_ID")));
            p.put("projectType", str(r.get("PROJECT_TYPE")));
            p.put("projectName", str(r.get("PROJECT_NAME")));
            p.put("loanCount",   lng(r.get("LOAN_COUNT")));
            p.put("disbursed",   dec(r.get("DISBURSED_AMOUNT")));
            p.put("openLoans",   lng(r.get("OPEN_LOAN_COUNT")));
            p.put("members",     lng(r.get("MEMBERS_ACTIVE_LOAN_SIDE")));
            out.add(p);
        }
        return out;
    }

    private static List buildPurposes(ArrayList rows) {
        Map byDistrict = new TreeMap();
        Map state      = new HashMap();
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            String purpose = r.get("PURPOSE") == null ? "(not recorded)" : str(r.get("PURPOSE"));
            Map p = purposeRow(str(r.get("DISTRICT_ID")), purpose,
                               lng(r.get("LOAN_COUNT")).longValue(), dec(r.get("DISBURSED_AMOUNT")));
            p.put("members", lng(r.get("MEMBERS_ACTIVE_LOAN_SIDE")));
            List l = (List) byDistrict.get(p.get("districtId"));
            if (l == null) { l = new ArrayList(); byDistrict.put(p.get("districtId"), l); }
            l.add(p);

            String sk = purpose.toUpperCase();
            Map s = (Map) state.get(sk);
            if (s == null) { s = purposeRow("ALL", purpose, 0L, BigDecimal.ZERO); state.put(sk, s); }
            addInto(s, p);
        }
        List out = new ArrayList();
        out.addAll(topN(new ArrayList(state.values()), "ALL", TOP_PURPOSES_STATE));
        for (Iterator it = byDistrict.entrySet().iterator(); it.hasNext();) {
            Map.Entry e = (Map.Entry) it.next();
            out.addAll(topN((List) e.getValue(), (String) e.getKey(), TOP_PURPOSES_PER_DISTRICT));
        }
        return out;
    }

    private static Map purposeRow(String districtId, String purpose, long count, BigDecimal amount) {
        Map p = new LinkedHashMap();
        p.put("districtId", districtId);
        p.put("purpose",    purpose);
        p.put("loanCount",  Long.valueOf(count));
        p.put("disbursed",  amount);
        p.put("members",    Long.valueOf(0));
        return p;
    }

    private static void addInto(Map target, Map add) {
        target.put("members",   Long.valueOf(((Long) target.get("members")).longValue()
                                             + ((Long) add.get("members")).longValue()));
        target.put("loanCount", Long.valueOf(((Long) target.get("loanCount")).longValue()
                                             + ((Long) add.get("loanCount")).longValue()));
        target.put("disbursed", ((BigDecimal) target.get("disbursed")).add((BigDecimal) add.get("disbursed")));
    }

    private static List topN(List rows, String districtId, int n) {
        Collections.sort(rows, new Comparator() {
            public int compare(Object a, Object b) {
                return ((BigDecimal) ((Map) b).get("disbursed")).compareTo((BigDecimal) ((Map) a).get("disbursed"));
            }
        });
        List out = new ArrayList();
        Map others = null;
        for (int i = 0; i < rows.size(); i++) {
            if (i < n) { out.add(rows.get(i)); continue; }
            if (others == null) others = purposeRow(districtId, OTHERS, 0L, BigDecimal.ZERO);
            addInto(others, (Map) rows.get(i));
        }
        if (others != null) out.add(others);
        return out;
    }

    private static List buildMandals(ArrayList dim, ArrayList loans, ArrayList repay,
                                     ArrayList targets, ArrayList mapping, ArrayList overdue) {
        Map loanBy  = index(loans);
        Map overdueBy = index(overdue);
        Map repayBy = index(repay);
        Map tgtBy   = index(targets);
        Map mapBy   = new HashMap();
        for (int i = 0; i < mapping.size(); i++) {
            Map r = (Map) mapping.get(i);
            String key = key(r);
            if (mapBy.containsKey(key)) {
                CeoLog.warn("Mandal " + key + " mapped to more than one officer; keeping the first");
                continue;
            }
            mapBy.put(key, r);
        }

        List out = new ArrayList();
        for (int i = 0; i < dim.size(); i++) {
            Map d = (Map) dim.get(i);
            String k = key(d);
            Map l = (Map) loanBy.get(k);
            Map r = (Map) repayBy.get(k);
            Map t = (Map) tgtBy.get(k);
            Map o = (Map) mapBy.get(k);
            Map od = (Map) overdueBy.get(k);

            Map m = new LinkedHashMap();
            m.put("districtId",   str(d.get("DISTRICT_ID")));
            m.put("mandalId",     str(d.get("MANDAL_ID")));
            m.put("name",         str(d.get("MANDAL_NAME")));
            m.put("loanCount",    l == null ? Long.valueOf(0) : lng(l.get("LOAN_COUNT")));
            m.put("disbursed",    l == null ? BigDecimal.ZERO : dec(l.get("DISBURSED_AMOUNT")));
            m.put("openLoans",    l == null ? Long.valueOf(0) : lng(l.get("OPEN_LOAN_COUNT")));
            m.put("closedLoans",  l == null ? Long.valueOf(0) : lng(l.get("CLOSED_LOAN_COUNT")));
            m.put("membersLoanSide", l == null ? Long.valueOf(0) : lng(l.get("MEMBERS_ACTIVE_LOAN_SIDE")));
            m.put("repayTxns",    r == null ? Long.valueOf(0) : lng(r.get("REPAYMENT_TXN_COUNT")));
            m.put("repaid",       r == null ? BigDecimal.ZERO : dec(r.get("REPAID_AMOUNT")));
            m.put("targetAmount", t == null ? BigDecimal.ZERO : dec(t.get("TARGET_AMOUNT")));
            for (int f = 0; f < OVERDUE_FIELDS.length; f++) {
                String[] x = OVERDUE_FIELDS[f];
                m.put(x[0], "L".equals(x[2]) ? (Object) (od == null ? Long.valueOf(0) : lng(od.get(x[1])))
                                             : (Object) (od == null ? BigDecimal.ZERO : dec(od.get(x[1]))));
            }
            m.put("officerUserId",   o == null ? "" : str(o.get("OFFICER_USER_ID")));
            m.put("officerName",     o == null ? "" : str(o.get("OFFICER_NAME")));
            m.put("officerRole",     o == null ? "" : str(o.get("OFFICER_ROLE")));
            m.put("officerEmpCode",  o == null ? "" : str(o.get("OFFICER_EMP_ID")));
            m.put("agmUserId",       o == null ? "" : str(o.get("AGM_USER_NAME")));
            m.put("agmName",         o == null ? "" : str(o.get("AGM_NAME")));
            m.put("dgmUserId",       o == null ? "" : str(o.get("DGM_USER_NAME")));
            m.put("dgmName",         o == null ? "" : str(o.get("DGM_NAME")));
            out.add(m);
        }
        return out;
    }

    // snapshot field, query column, L = count / D = rupees
    private static final String[][] OVERDUE_FIELDS = {
        { "statusLoans",        "STATUS_LOANS",        "L" },
        { "overdueLoans",       "OVERDUE_LOANS",       "L" },
        { "overdueAmount",      "OVERDUE_AMOUNT",      "D" },
        { "outstanding",        "OUTSTANDING_AMOUNT",  "D" },
        { "overdueOutstanding", "OVERDUE_OUTSTANDING", "D" },
        { "od1Loans",           "B1_LOANS",            "L" },
        { "od1Amount",          "B1_AMOUNT",           "D" },
        { "od2Loans",           "B2_LOANS",            "L" },
        { "od2Amount",          "B2_AMOUNT",           "D" },
        { "od3Loans",           "B3_LOANS",            "L" },
        { "od3Amount",          "B3_AMOUNT",           "D" }
    };

    private static void addOverdueToDistricts(List districts, List mandals) {
        Map byId = new HashMap();
        for (int i = 0; i < districts.size(); i++) {
            Map d = (Map) districts.get(i);
            byId.put(d.get("id"), d);
            zeroOverdue(d);
        }
        for (int i = 0; i < mandals.size(); i++) {
            Map m = (Map) mandals.get(i);
            Map d = (Map) byId.get(m.get("districtId"));
            if (d == null) continue;
            addOverdue(d, m);
        }
    }

    private static void zeroOverdue(Map target) {
        for (int f = 0; f < OVERDUE_FIELDS.length; f++) {
            String[] x = OVERDUE_FIELDS[f];
            target.put(x[0], "L".equals(x[2]) ? (Object) Long.valueOf(0) : (Object) BigDecimal.ZERO);
        }
    }

    private static void addOverdue(Map target, Map from) {
        for (int f = 0; f < OVERDUE_FIELDS.length; f++) {
            String[] x = OVERDUE_FIELDS[f];
            if ("L".equals(x[2])) incLong(target, x[0], ((Long) from.get(x[0])).longValue());
            else                  incDec(target, x[0], (BigDecimal) from.get(x[0]));
        }
    }

    // arrears can never exceed the balance, and loans in arrears can never exceed the open loans
    private static boolean overdueSane(List districts) {
        for (int i = 0; i < districts.size(); i++) {
            Map d = (Map) districts.get(i);
            long loans = ((Long) d.get("statusLoans")).longValue(), od = ((Long) d.get("overdueLoans")).longValue();
            if (od > loans || ((BigDecimal) d.get("overdueAmount")).signum() < 0) {
                CeoLog.warn("Overdue figures look wrong for district " + d.get("id") + " (" + od + " of " + loans + "); not shown");
                return false;
            }
        }
        return true;
    }

    private static void addOverdueToTotals(Map totals, List districts, boolean ready) {
        Map sum = new HashMap();
        zeroOverdue(sum);
        for (int i = 0; i < districts.size(); i++) addOverdue(sum, (Map) districts.get(i));
        for (int f = 0; f < OVERDUE_FIELDS.length; f++) totals.put(OVERDUE_FIELDS[f][0], sum.get(OVERDUE_FIELDS[f][0]));
        totals.put("overdueReady", Long.valueOf(ready && ((Long) sum.get("statusLoans")).longValue() > 0 ? 1 : 0));
    }

    private static List buildEmployees(List mandals) {
        Map byKey = new TreeMap();
        for (int i = 0; i < mandals.size(); i++) {
            Map m = (Map) mandals.get(i);
            String user = str(m.get("officerUserId"));
            boolean unassigned = user.length() == 0;
            String key = unassigned ? "~UNASSIGNED|" + m.get("districtId")
                                    : user + "|" + m.get("agmUserId");
            Map e = (Map) byKey.get(key);
            if (e == null) {
                e = new LinkedHashMap();
                e.put("userId",      unassigned ? "" : user);
                e.put("empCode",     m.get("officerEmpCode"));
                e.put("officerName", unassigned ? "Unassigned mandals" : m.get("officerName"));
                e.put("officerRole", unassigned ? "UNASSIGNED" : m.get("officerRole"));
                e.put("agmUserId",   m.get("agmUserId"));
                e.put("agmName",     m.get("agmName"));
                e.put("dgmUserId",   m.get("dgmUserId"));
                e.put("dgmName",     m.get("dgmName"));
                e.put("districtIds", new TreeSet());
                e.put("mandalCount", Long.valueOf(0));
                e.put("loanCount",   Long.valueOf(0));
                e.put("disbursed",   BigDecimal.ZERO);
                e.put("repayTxns",   Long.valueOf(0));
                e.put("repaid",      BigDecimal.ZERO);
                e.put("targetAmount",BigDecimal.ZERO);
                zeroOverdue(e);
                byKey.put(key, e);
            }
            ((TreeSet) e.get("districtIds")).add(m.get("districtId"));
            incLong(e, "mandalCount", 1L);
            incLong(e, "loanCount", ((Long) m.get("loanCount")).longValue());
            incLong(e, "repayTxns", ((Long) m.get("repayTxns")).longValue());
            incDec(e, "disbursed",    (BigDecimal) m.get("disbursed"));
            incDec(e, "repaid",       (BigDecimal) m.get("repaid"));
            incDec(e, "targetAmount", (BigDecimal) m.get("targetAmount"));
            addOverdue(e, m);
        }
        List out = new ArrayList();
        for (Iterator it = byKey.values().iterator(); it.hasNext();) {
            Map e = (Map) it.next();
            e.put("districtIds", join((TreeSet) e.get("districtIds")));
            out.add(e);
        }
        return out;
    }

    static String slugOf(String name) {
        String s = name == null ? "" : name.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-");
        s = s.replaceAll("^-+|-+$", "");
        String alias = (String) SLUG_ALIASES.get(s);
        return alias != null ? alias : s;
    }

    private static String key(Map r) {
        return str(r.get("DISTRICT_ID")) + "|" + str(r.get("MANDAL_ID"));
    }

    private static Map index(ArrayList rows) {
        Map m = new HashMap();
        for (int i = 0; i < rows.size(); i++) m.put(key((Map) rows.get(i)), rows.get(i));
        return m;
    }

    private static String str(Object o) { return o == null ? "" : o.toString().trim(); }

    private static Long lng(Object o) {
        if (o instanceof Number) return Long.valueOf(((Number) o).longValue());
        return Long.valueOf(0);
    }

    private static BigDecimal dec(Object o) {
        if (o instanceof BigDecimal) return (BigDecimal) o;
        if (o instanceof Number) return new BigDecimal(o.toString());
        return BigDecimal.ZERO;
    }

    private static long sumLong(List rows, String field) {
        long s = 0;
        for (int i = 0; i < rows.size(); i++) s += ((Long) ((Map) rows.get(i)).get(field)).longValue();
        return s;
    }

    private static BigDecimal sumDec(List rows, String field) {
        BigDecimal s = BigDecimal.ZERO;
        for (int i = 0; i < rows.size(); i++) s = s.add((BigDecimal) ((Map) rows.get(i)).get(field));
        return s;
    }

    private static void incLong(Map m, String f, long v) {
        m.put(f, Long.valueOf(((Long) m.get(f)).longValue() + v));
    }

    private static void incDec(Map m, String f, BigDecimal v) {
        m.put(f, ((BigDecimal) m.get(f)).add(v));
    }

    private static String join(TreeSet set) {
        StringBuffer sb = new StringBuffer();
        for (Iterator it = set.iterator(); it.hasNext();) {
            if (sb.length() > 0) sb.append(',');
            sb.append(it.next());
        }
        return sb.toString();
    }
}
