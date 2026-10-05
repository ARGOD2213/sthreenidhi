/*
 * CEO Loan Intelligence Dashboard
 * In-memory cube (district x mandal x month x project) so period, project and area
 * clicks are answered without SQL.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class CeoDashCube implements Serializable {
    private static final long serialVersionUID = 2L;

    public static final String DISTRICT = "DISTRICT";
    public static final String MANDAL   = "MANDAL";
    public static final String PROJECT  = "PROJECT";
    public static final String TOTAL    = "TOTAL";
    public static final String CATEGORY = "CATEGORY";

    public static final int LOANS = 0, DISBURSED = 1, OPEN = 2, CLOSED = 3, TXNS = 4, REPAID = 5, OPEN_AMOUNT = 6;
    public static final int POS_AMOUNT = 7, UPI_AMOUNT = 8, AUTO_AMOUNT = 9, POS_TXNS = 10, UPI_TXNS = 11, AUTO_TXNS = 12;
    public static final int MEASURES = 13;

    private final String[] mandalDistrict;
    private final String[] mandalId;
    private final String[] months;
    private final String[] projects;
    private final String[] categories;
    private final Map      projectNames;
    private final String   firstMonth;
    private final String   endMonth;

    private final int[]    lMandal, lMonth, lProject, lCategory;
    private final long[]   lCount, lOpen, lClosed;
    private final double[] lAmount, lOpenAmount;
    private final int[]    rMandal, rMonth, rProject;
    private final long[]   rTxns;
    private final double[] rAmount;
    private final double[][] rModeAmount;
    private final long[][]   rModeTxns;

    private CeoDashCube(Builder b) {
        int nm = b.mandals.size();
        mandalDistrict = new String[nm];
        mandalId = new String[nm];
        for (int i = 0; i < nm; i++) {
            String k = (String) b.mandals.get(i);
            int bar = k.indexOf('|');
            mandalDistrict[i] = k.substring(0, bar);
            mandalId[i] = k.substring(bar + 1);
        }
        months = (String[]) b.months.toArray(new String[0]);
        projects = (String[]) b.projects.toArray(new String[0]);
        categories = (String[]) b.categories.toArray(new String[0]);
        projectNames = Collections.unmodifiableMap(new HashMap(b.projectNames));
        firstMonth = b.firstMonth;
        endMonth = b.endMonth;

        int nl = b.lCount.size();
        lMandal = new int[nl]; lMonth = new int[nl]; lProject = new int[nl]; lCategory = new int[nl];
        lCount = new long[nl]; lOpen = new long[nl]; lClosed = new long[nl]; lAmount = new double[nl];
        lOpenAmount = new double[nl];
        for (int i = 0; i < nl; i++) {
            int[] dims = (int[]) b.lDims.get(i);
            lMandal[i] = dims[0]; lMonth[i] = dims[1]; lProject[i] = dims[2]; lCategory[i] = dims[3];
            long[] v = (long[]) b.lCount.get(i);
            lCount[i] = v[0]; lOpen[i] = v[1]; lClosed[i] = v[2];
            double[] amt = (double[]) b.lAmount.get(i);
            lAmount[i] = amt[0]; lOpenAmount[i] = amt[1];
        }
        int nr = b.rTxns.size();
        rMandal = new int[nr]; rMonth = new int[nr]; rProject = new int[nr];
        rTxns = new long[nr]; rAmount = new double[nr];
        rModeAmount = new double[3][nr]; rModeTxns = new long[3][nr];
        for (int i = 0; i < nr; i++) {
            int[] dims = (int[]) b.rDims.get(i);
            rMandal[i] = dims[0]; rMonth[i] = dims[1]; rProject[i] = dims[2];
            rTxns[i] = ((Long) b.rTxns.get(i)).longValue();
            rAmount[i] = ((Double) b.rAmount.get(i)).doubleValue();
            double[] ma = (double[]) b.rModeAmount.get(i);
            long[] mt = (long[]) b.rModeTxns.get(i);
            for (int k = 0; k < 3; k++) { rModeAmount[k][i] = ma[k]; rModeTxns[k][i] = mt[k]; }
        }
    }

    public boolean covers(String fromMonth, String toMonth) {
        return fromMonth != null && toMonth != null
            && fromMonth.compareTo(firstMonth) >= 0 && toMonth.compareTo(endMonth) <= 0
            && fromMonth.compareTo(toMonth) < 0;
    }

    public String getFirstMonth() { return firstMonth; }
    public String getEndMonth()   { return endMonth; }
    public int    loanCells()     { return lCount.length; }
    public int    repayCells()    { return rTxns.length; }

    public String projectName(String type) {
        String n = (String) projectNames.get(type);
        return n != null ? n : "Project " + type;
    }

    // sums of the cells in [fromMonth, toMonth), grouped by DISTRICT / MANDAL / PROJECT / CATEGORY / TOTAL
    public Map aggregate(String group, String districtId, String mandalIdFilter,
                         String fromMonth, String toMonth, String projectType) {
        boolean[] monthIn = new boolean[months.length];
        for (int i = 0; i < months.length; i++) {
            monthIn[i] = months[i].compareTo(fromMonth) >= 0 && months[i].compareTo(toMonth) < 0;
        }
        boolean[] mandalIn = new boolean[mandalId.length];
        for (int i = 0; i < mandalId.length; i++) {
            mandalIn[i] = (districtId == null || districtId.equals(mandalDistrict[i]))
                       && (mandalIdFilter == null || mandalIdFilter.equals(mandalId[i]));
        }
        int projectOnly = -1;
        if (projectType != null) {
            projectOnly = -2;
            for (int i = 0; i < projects.length; i++) { if (projects[i].equals(projectType)) { projectOnly = i; } }
        }

        Map out = new LinkedHashMap();
        for (int i = 0; i < lCount.length; i++) {
            if (!monthIn[lMonth[i]] || !mandalIn[lMandal[i]]) continue;
            if (projectOnly != -1 && lProject[i] != projectOnly) continue;
            double[] a = slot(out, key(group, lMandal[i], lProject[i], categories[lCategory[i]]));
            a[LOANS] += lCount[i]; a[DISBURSED] += lAmount[i]; a[OPEN] += lOpen[i]; a[CLOSED] += lClosed[i];
            a[OPEN_AMOUNT] += lOpenAmount[i];
        }
        if (CATEGORY.equals(group)) return out;
        for (int i = 0; i < rTxns.length; i++) {
            if (!monthIn[rMonth[i]] || !mandalIn[rMandal[i]]) continue;
            if (projectOnly != -1 && rProject[i] != projectOnly) continue;
            double[] a = slot(out, key(group, rMandal[i], rProject[i], null));
            a[TXNS] += rTxns[i]; a[REPAID] += rAmount[i];
            for (int k = 0; k < 3; k++) { a[POS_AMOUNT + k] += rModeAmount[k][i]; a[POS_TXNS + k] += rModeTxns[k][i]; }
        }
        return out;
    }

    public String[] monthList() { return (String[]) months.clone(); }

    // month-by-month sums for a set of mandals (null = whole state)
    public double[][] monthlyFor(java.util.Set mandalKeys) {
        boolean[] mandalIn = new boolean[mandalId.length];
        for (int i = 0; i < mandalId.length; i++) {
            mandalIn[i] = mandalKeys == null || mandalKeys.contains(mandalDistrict[i] + "|" + mandalId[i]);
        }
        double[][] out = new double[months.length][MEASURES];
        for (int i = 0; i < lCount.length; i++) {
            if (!mandalIn[lMandal[i]]) continue;
            double[] a = out[lMonth[i]];
            a[LOANS] += lCount[i]; a[DISBURSED] += lAmount[i]; a[OPEN] += lOpen[i]; a[CLOSED] += lClosed[i];
            a[OPEN_AMOUNT] += lOpenAmount[i];
        }
        for (int i = 0; i < rTxns.length; i++) {
            if (!mandalIn[rMandal[i]]) continue;
            double[] a = out[rMonth[i]];
            a[TXNS] += rTxns[i]; a[REPAID] += rAmount[i];
            for (int k = 0; k < 3; k++) { a[POS_AMOUNT + k] += rModeAmount[k][i]; a[POS_TXNS + k] += rModeTxns[k][i]; }
        }
        return out;
    }

    private String key(String group, int mandal, int project, String category) {
        if (CATEGORY.equals(group)) return category;
        if (DISTRICT.equals(group)) return mandalDistrict[mandal];
        if (MANDAL.equals(group))   return mandalDistrict[mandal] + "|" + mandalId[mandal];
        if (PROJECT.equals(group))  return projects[project];
        return "ALL";
    }

    private static double[] slot(Map m, String k) {
        double[] a = (double[]) m.get(k);
        if (a == null) { a = new double[MEASURES]; m.put(k, a); }
        return a;
    }

    public static final class Builder {
        private final Map  mandalIdx = new HashMap(), monthIdx = new HashMap(), projectIdx = new HashMap(),
                           categoryIdx = new HashMap();
        private final List mandals = new ArrayList(), months = new ArrayList(), projects = new ArrayList(),
                           categories = new ArrayList();
        private final Map  projectNames = new HashMap();
        private final List lDims = new ArrayList(), lCount = new ArrayList(), lAmount = new ArrayList();
        private final List rDims = new ArrayList(), rTxns = new ArrayList(), rAmount = new ArrayList(),
                           rModeAmount = new ArrayList(), rModeTxns = new ArrayList();
        private final String firstMonth, endMonth;

        public Builder(String firstMonth, String endMonth) {
            this.firstMonth = firstMonth;
            this.endMonth = endMonth;
        }

        public void projectName(String type, String name) {
            if (type != null && name != null && name.length() > 0) projectNames.put(type, name);
        }

        public void addLoan(String districtId, String mandal, String month, String project,
                            long count, double amount, long open, long closed) {
            addLoan(districtId, mandal, month, project, "", count, amount, open, closed, 0d);
        }

        public void addLoan(String districtId, String mandal, String month, String project, String category,
                            long count, double amount, long open, long closed, double openAmount) {
            int[] d = dims(districtId, mandal, month, project);
            lDims.add(new int[] { d[0], d[1], d[2], index(categoryIdx, categories, category == null ? "" : category) });
            lCount.add(new long[] { count, open, closed });
            lAmount.add(new double[] { amount, openAmount });
        }

        public void addRepayment(String districtId, String mandal, String month, String project,
                                 long txns, double amount) {
            addRepayment(districtId, mandal, month, project, txns, amount, new double[3], new long[3]);
        }

        public void addRepayment(String districtId, String mandal, String month, String project,
                                 long txns, double amount, double[] modeAmount, long[] modeTxns) {
            rDims.add(dims(districtId, mandal, month, project));
            rTxns.add(Long.valueOf(txns));
            rAmount.add(Double.valueOf(amount));
            rModeAmount.add(modeAmount);
            rModeTxns.add(modeTxns);
        }

        private int[] dims(String d, String m, String month, String project) {
            return new int[] { index(mandalIdx, mandals, d + "|" + m),
                               index(monthIdx, months, month),
                               index(projectIdx, projects, project == null ? "" : project) };
        }

        private static int index(Map idx, List list, String k) {
            Integer i = (Integer) idx.get(k);
            if (i == null) { i = Integer.valueOf(list.size()); idx.put(k, i); list.add(k); }
            return i.intValue();
        }

        public CeoDashCube build() { return new CeoDashCube(this); }
    }
}
