/*
 * CEO Loan Intelligence Dashboard
 * SNBSAP queries for the CEO dashboard, run as stored procedures (sql_procedures/P01 ... P21).
 * Same class, constants, input checks, timeouts, log lines and returned rows as the inline-SQL
 * version, so it replaces that file with no change anywhere else.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao;

import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Connection;
import in.gov.ap.serp.sthreenidhi.platform.db.DataSources;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Timestamp;
import java.sql.Types;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;


import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util.CeoLog;

public class CeoLoanIntelligenceDAOImpl implements CeoLoanIntelligenceDAO {
    // build procedures scan large tables; drill-downs are small and get a short limit
    private static final int DEFAULT_REFRESH_TIMEOUT_SECONDS = 1800;
    private static final int DRILLDOWN_TIMEOUT_SECONDS       = 120;
    // one FY scan of repayments, run once per snapshot and cached
    private static final int KEYED_TIMEOUT_SECONDS           = 600;
    private static final int MAX_FACT_FIRST_DAYS             = 31;

    // Stree Nidhi projects only (LOAN_TYPE = 'SN'); -Dceo.dash.snOnly=false brings back every project
    public static final boolean SN_ONLY = !"false".equalsIgnoreCase(System.getProperty("ceo.dash.snOnly", "true").trim());
    // payment modes (POS / UPI / auto-debit); -Dceo.dash.paymodes=false returns them as 0
    public static final boolean PAY_MODES = !"false".equalsIgnoreCase(System.getProperty("ceo.dash.paymodes", "true").trim());

    private static final Boolean SN    = Boolean.valueOf(SN_ONLY);
    private static final Boolean MODES = Boolean.valueOf(PAY_MODES);

    public ArrayList getActiveMandals() throws Exception {
        ArrayList rows = call("getActiveMandals", "USP_CEO_DASH_ACTIVE_MANDALS",
                new Object[0], refreshTimeout());
        warnIfDuplicateKeys("getActiveMandals", rows, new String[] { "DISTRICT_ID", "MANDAL_ID" });
        return rows;
    }

    // who owns each mandal
    public ArrayList getOfficerMandalMapping() throws Exception {
        ArrayList rows = call("getOfficerMandalMapping", "USP_CEO_DASH_OFFICER_MAPPING",
                new Object[0], refreshTimeout());
        warnIfDuplicateKeys("getOfficerMandalMapping", rows, new String[] { "DISTRICT_ID", "MANDAL_ID" });
        return rows;
    }

    // FY totals per district: members, loans, repayments, targets
    public ArrayList getDistrictRollup(String fyLabel, String fyStart, String fyEnd) throws Exception {
        String label = checkFyLabel(fyLabel);
        Timestamp[] p = checkPeriod(fyStart, fyEnd);
        ArrayList rows = call("getDistrictRollup", "USP_CEO_DASH_DISTRICT_ROLLUP",
                new Object[] { label, p[0], p[1], SN }, refreshTimeout());
        warnIfDuplicateKeys("getDistrictRollup", rows, new String[] { "DISTRICT_ID" });
        return rows;
    }

    public ArrayList getMandalDailyLoanRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getMandalDailyLoanRollup", "USP_CEO_DASH_MANDAL_DAILY_LOANS",
                new Object[] { p[0], p[1], SN }, refreshTimeout());
    }

    public ArrayList getMandalDailyRepaymentRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getMandalDailyRepaymentRollup", "USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS",
                new Object[] { p[0], p[1], SN, MODES }, refreshTimeout());
    }

    public ArrayList getDistrictProjectComposition(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getDistrictProjectComposition", "USP_CEO_DASH_DISTRICT_PROJECTS",
                new Object[] { p[0], p[1], SN }, refreshTimeout());
    }

    public ArrayList getMandalLoanRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getMandalLoanRollup", "USP_CEO_DASH_MANDAL_LOANS",
                new Object[] { p[0], p[1], SN }, refreshTimeout());
    }

    // cash (non-online) repayments summed per login; one row per CREATED_BY
    public ArrayList getCashKeyedBy(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getCashKeyedBy", "USP_CEO_DASH_CASH_KEYED_BY",
                new Object[] { p[0], p[1], SN }, KEYED_TIMEOUT_SECONDS);
    }

    /*
     * Overdue = arrears in SN.SHG_MEMBER_LOAN_STATUS_NEW (one row per loan, refreshed daily by SNBSAP):
     * LOAN_DUE = amount behind before this month's instalment, LOAN_EMI = the instalment, OUTSTANDING = balance.
     * Read by procedures P19 - P21, which always use SN.SHG_MEMBER_LOAN_STATUS_NEW.
     */
    private static final String DEFAULT_STATUS_TABLE = "SN.SHG_MEMBER_LOAN_STATUS_NEW";
    private static final String STATUS_TABLE = statusTable();

    private static String statusTable() {
        String t = System.getProperty("ceo.dash.statusTable", DEFAULT_STATUS_TABLE).trim();
        t = t.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)?") ? t : DEFAULT_STATUS_TABLE;
        if (!DEFAULT_STATUS_TABLE.equalsIgnoreCase(t)) {
            CeoLog.warn("-Dceo.dash.statusTable=" + t + " is not used: the overdue procedures read " + DEFAULT_STATUS_TABLE);
        }
        return t;
    }

    public ArrayList getMandalOverdueRollup() throws Exception {
        return call("getMandalOverdueRollup", "USP_CEO_DASH_MANDAL_OVERDUE",
                new Object[] { SN }, refreshTimeout());
    }

    public ArrayList getOverdueByUnit(String group, String districtId, String mandalId, String voId, String shgId) throws Exception {
        String g = group == null ? "" : group.trim().toUpperCase();
        boolean voGiven = !blank(voId);
        if (!"VO".equals(g) && !"SHG".equals(g) && !"MEMBER".equals(g)) {
            throw new IllegalArgumentException("overdue is not available for group " + g);
        }
        String d = null, m = null, v = null, s = null;
        if ("MEMBER".equals(g)) {
            if (blank(shgId)) throw new IllegalArgumentException("shgId is needed");
            s = checkKey("shgId", shgId);
        } else if ("SHG".equals(g) && voGiven) {
            v = checkKey("voId", voId);
        } else {
            if (blank(districtId) || blank(mandalId)) throw new IllegalArgumentException("districtId and mandalId are needed");
            d = checkKey("districtId", districtId);
            m = checkKey("mandalId", mandalId);
        }
        return call("getOverdueByUnit " + g, "USP_CEO_DASH_OVERDUE_BY_UNIT",
                new Object[] { g, d, m, v, s, SN }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    public ArrayList getOverdueByLoan(String shgId) throws Exception {
        if (blank(shgId)) throw new IllegalArgumentException("shgId is needed");
        return call("getOverdueByLoan", "USP_CEO_DASH_OVERDUE_BY_LOAN",
                new Object[] { checkKey("shgId", shgId) }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    public ArrayList getMandalTargetRollup(String fyLabel) throws Exception {
        String label = checkFyLabel(fyLabel);
        return call("getMandalTargetRollup", "USP_CEO_DASH_MANDAL_TARGETS",
                new Object[] { label }, refreshTimeout());
    }

    // 24-month cube rows: district x mandal x month x project
    public ArrayList getLoanCube(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getLoanCube", "USP_CEO_DASH_LOAN_CUBE",
                new Object[] { p[0], p[1], SN }, refreshTimeout());
    }

    public ArrayList getMandalPurposeRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getMandalPurposeRollup", "USP_CEO_DASH_MANDAL_PURPOSES",
                new Object[] { p[0], p[1], SN }, refreshTimeout());
    }

    public ArrayList getProjectNames() throws Exception {
        return call("getProjectNames", "USP_CEO_DASH_PROJECT_NAMES",
                new Object[] { SN }, refreshTimeout());
    }

    public ArrayList getRepaymentCube(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        return call("getRepaymentCube", "USP_CEO_DASH_REPAYMENT_CUBE",
                new Object[] { p[0], p[1], SN, MODES }, refreshTimeout());
    }

    // one drill-down level for one scope and period; state / district go to DRILL_AREA,
    // mandal / VO / SHG to DRILL_SCOPE
    public ArrayList drill(String group, String districtId, String mandalId, String voId, String shgId,
                           String periodStart, String periodEnd, String projectType) throws Exception {
        String g = group == null ? "" : group.trim().toUpperCase();
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String project = blank(projectType) ? null : checkKey("projectType", projectType);
        String d = blank(districtId) ? null : checkKey("districtId", districtId);
        String m = blank(mandalId)   ? null : checkKey("mandalId", mandalId);
        String v = blank(voId)       ? null : checkKey("voId", voId);
        String s = blank(shgId)      ? null : checkKey("shgId", shgId);
        String level = s != null ? "SHG" : v != null ? "VO" : m != null ? "MANDAL" : d != null ? "DISTRICT" : "STATE";
        if ("MANDAL".equals(level) && d == null) throw new IllegalArgumentException("mandalId needs districtId");

        boolean membersFirst = "MANDAL".equals(level) || "VO".equals(level) || "SHG".equals(level);
        String allowed = membersFirst
            ? ("MANDAL".equals(level) ? "VO SHG PROJECT CATEGORY PURPOSE" : "VO".equals(level) ? "SHG PROJECT CATEGORY PURPOSE"
                                      : "MEMBER PROJECT CATEGORY PURPOSE")
            : ("STATE".equals(level) ? "DISTRICT PROJECT" : "MANDAL PROJECT");
        if ((" " + allowed + " ").indexOf(" " + g + " ") < 0) {
            throw new IllegalArgumentException("group " + g + " is not available at " + level + " level");
        }
        String method = "drill " + g + "@" + level;
        if (!membersFirst) {
            long days = (p[1].getTime() - p[0].getTime()) / 86400000L;
            if (days > MAX_FACT_FIRST_DAYS) {
                throw new IllegalArgumentException("period longer than " + MAX_FACT_FIRST_DAYS
                        + " days at " + level + " level is served from the snapshot");
            }
            return call(method, "USP_CEO_DASH_DRILL_AREA",
                    new Object[] { g, d, p[0], p[1], project, SN, MODES }, DRILLDOWN_TIMEOUT_SECONDS);
        }
        return call(method, "USP_CEO_DASH_DRILL_SCOPE",
                new Object[] { g, d, m, v, s, p[0], p[1], project, SN, MODES }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    // profile, loans and repayments of one woman (mobile: last 4 digits only): one procedure, three result sets
    public ArrayList getMemberDetail(String memberId) throws Exception {
        String id = checkKey("memberId", memberId);
        return call("getMemberDetail", "USP_CEO_DASH_MEMBER_DETAIL",
                new Object[] { id, SN, MODES }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    public ArrayList getShgInfo(String shgId) throws Exception {
        String id = checkKey("shgId", shgId);
        return call("getShgInfo", "USP_CEO_DASH_SHG_INFO", new Object[] { id }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    private static boolean blank(String s) { return s == null || s.trim().length() == 0; }

    public ArrayList getShgMemberLoans(String shgId) throws Exception {
        String id = checkKey("shgId", shgId);
        return call("getShgMemberLoans", "USP_CEO_DASH_SHG_MEMBER_LOANS",
                new Object[] { id, SN }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    /*
     * The two methods below are kept with the same text as before for the existing tests that read
     * the overdue SQL. The dashboard itself runs procedures P19 / P20, which hold the same SQL.
     */
    private static final String GEO_JOIN =
        " INNER JOIN SHG_INFO SI WITH (NOLOCK)" +
        "   ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'" +
        " INNER JOIN VO_INFO VI WITH (NOLOCK)" +
        "   ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'";

    private static final String ACTIVE_MEMBER_DIM =
        " (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY" +
        "    FROM SHG_MEMBER_INFO WITH (NOLOCK)" +
        "   WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20" +
        "   GROUP BY MEMBER_ID)";

    private static final String MEMBER_JOIN =
        " INNER JOIN" + ACTIVE_MEMBER_DIM + " SM ON SM.MEMBER_ID = MCP.MEMBER_LONG_CODE";

    private static final String SN_PROJECTS =
        " (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)" +
        "   WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN')";

    private static final String BY_MANDAL = "VI.DISTRICT_ID, VI.MANDAL_ID";

    private static String geoFilter(String a) {
        return " EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)" +
               "          WHERE DM.DISTRICT_ID = " + a + ".DISTRICT_ID AND DM.FLAG = 'Y')" +
               " AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)" +
               "              WHERE MM.DISTRICT_ID = " + a + ".DISTRICT_ID" +
               "                AND MM.MANDAL_ID = " + a + ".MANDAL_ID" +
               "                AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')";
    }

    private static String loanQuality(String a) {
        return " " + a + ".MEMBER_LONG_CODE IS NOT NULL" +
               " AND LTRIM(RTRIM(" + a + ".MEMBER_LONG_CODE)) <> ''" +
               " AND LEN(" + a + ".MEMBER_LONG_CODE) >= 20" +
               " AND " + a + ".ISSUED_DATE IS NOT NULL" +
               " AND " + a + ".ISSUED_DATE > '2000-01-01'" +
               " AND " + a + ".LOAN_STATUS IN ('OPEN','CLOSED')" +
               (SN_ONLY ? " AND " + a + ".PROJECT_TYPE IN" + SN_PROJECTS : "");
    }

    private static String overdueColumns() {
        String due = "ISNULL(S.LOAN_DUE, 0)", bal = "ISNULL(S.OUTSTANDING, 0)";
        return " COUNT(*) AS STATUS_LOANS," +
               " SUM(CASE WHEN " + due + " > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS," +
               " SUM(CASE WHEN " + due + " > 0 THEN " + due + " ELSE 0 END) AS OVERDUE_AMOUNT," +
               " SUM(CASE WHEN " + bal + " > 0 THEN " + bal + " ELSE 0 END) AS OUTSTANDING_AMOUNT," +
               " SUM(CASE WHEN " + due + " > 0 AND " + bal + " > 0 THEN " + bal + " ELSE 0 END) AS OVERDUE_OUTSTANDING";
    }

    private static final String VOS_OF_MANDAL =
        " S.VO_ID IN (SELECT VX.TRANS_VO_ID FROM VO_INFO VX WITH (NOLOCK)" +
        "              WHERE VX.DISTRICT_ID = ? AND VX.MANDAL_ID = ? AND VX.IS_ACTIVE = 'Y')";

    static String overdueByUnitSql(String g, boolean voGiven) {
        String unit, where;
        if ("VO".equals(g)) { unit = "S.VO_ID"; where = VOS_OF_MANDAL; }
        else if ("SHG".equals(g)) { unit = "S.SHG_ID"; where = voGiven ? " S.VO_ID = ?" : VOS_OF_MANDAL; }
        else if ("MEMBER".equals(g)) { unit = "MCP.MEMBER_LONG_CODE"; where = " S.SHG_ID = ?"; }
        else throw new IllegalArgumentException("overdue is not available for group " + g);
        return "SELECT " + unit + " AS UNIT_ID," + overdueColumns() +
               " FROM " + STATUS_TABLE + " S WITH (NOLOCK)" +
               " INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = S.SHG_MEMBER_LOAN_ACCNO" +
               " WHERE" + where + " AND S.IS_CLOSED = 0 AND MCP.LOAN_STATUS = 'OPEN' AND" + loanQuality("MCP") +
               " GROUP BY " + unit;
    }

    static String overdueSql() {
        String due = "ISNULL(S.LOAN_DUE, 0)", emi = "ISNULL(S.LOAN_EMI, 0)", bal = "ISNULL(S.OUTSTANDING, 0)";
        String b1 = due + " > 0 AND " + emi + " > 0 AND " + due + " <= " + emi;
        String b2 = due + " > 0 AND " + emi + " > 0 AND " + due + " > " + emi + " AND " + due + " <= 3 * " + emi;
        String b3 = due + " > 0 AND (" + emi + " <= 0 OR " + due + " > 3 * " + emi + ")";
        String sql =
            "SELECT " + BY_MANDAL + "," +
            " COUNT(*) AS STATUS_LOANS," +
            " SUM(CASE WHEN " + due + " > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS," +
            " SUM(CASE WHEN " + due + " > 0 THEN " + due + " ELSE 0 END) AS OVERDUE_AMOUNT," +
            " SUM(CASE WHEN " + bal + " > 0 THEN " + bal + " ELSE 0 END) AS OUTSTANDING_AMOUNT," +
            " SUM(CASE WHEN " + due + " > 0 AND " + bal + " > 0 THEN " + bal + " ELSE 0 END) AS OVERDUE_OUTSTANDING," +
            " SUM(CASE WHEN " + b1 + " THEN 1 ELSE 0 END) AS B1_LOANS," +
            " SUM(CASE WHEN " + b1 + " THEN " + due + " ELSE 0 END) AS B1_AMOUNT," +
            " SUM(CASE WHEN " + b2 + " THEN 1 ELSE 0 END) AS B2_LOANS," +
            " SUM(CASE WHEN " + b2 + " THEN " + due + " ELSE 0 END) AS B2_AMOUNT," +
            " SUM(CASE WHEN " + b3 + " THEN 1 ELSE 0 END) AS B3_LOANS," +
            " SUM(CASE WHEN " + b3 + " THEN " + due + " ELSE 0 END) AS B3_AMOUNT" +
            " FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)" +
            " INNER JOIN " + STATUS_TABLE + " S WITH (NOLOCK) ON S.SHG_MEMBER_LOAN_ACCNO = MCP.SHG_MEMBER_LOAN_ACCNO" +
            MEMBER_JOIN + GEO_JOIN +
            " WHERE MCP.LOAN_STATUS = 'OPEN' AND S.IS_CLOSED = 0" +
            " AND" + loanQuality("MCP") + " AND" + geoFilter("VI") +
            " GROUP BY " + BY_MANDAL + " ORDER BY VI.DISTRICT_ID, VI.MANDAL_ID";
        return sql;
    }

    private Connection getSnbsapConnection() throws Exception {
        return DataSources.connection("snbsap", "SNBSAP_DS");
    }

    /*
     * Runs {call dbo.<proc>(?, ...)} and returns the rows of every result set it sends back,
     * in order. Parameters: Timestamp -> datetime, Boolean -> bit, String -> varchar, null -> NULL.
     */
    private ArrayList call(String method, String proc, Object[] params, int timeoutSeconds)
            throws Exception {
        long start = System.currentTimeMillis();
        StringBuffer sql = new StringBuffer("{call dbo.").append(proc).append('(');
        for (int i = 0; i < params.length; i++) sql.append(i == 0 ? "?" : ", ?");
        sql.append(")}");

        Connection        conn = null;
        CallableStatement cs   = null;
        try {
            conn = getSnbsapConnection();
            cs = conn.prepareCall(sql.toString());
            cs.setQueryTimeout(timeoutSeconds);
            for (int i = 0; i < params.length; i++) {
                Object v = params[i];
                if (v == null)                   cs.setNull(i + 1, Types.VARCHAR);
                else if (v instanceof Timestamp) cs.setTimestamp(i + 1, (Timestamp) v);
                else if (v instanceof Boolean)   cs.setBoolean(i + 1, ((Boolean) v).booleanValue());
                else                             cs.setString(i + 1, (String) v);
            }
            ArrayList rows = new ArrayList();
            boolean isResultSet = cs.execute();
            while (true) {
                if (isResultSet) {
                    ResultSet rs = cs.getResultSet();
                    try { rows.addAll(readRows(rs)); }
                    finally { try { rs.close(); } catch (Exception e) {  } }
                } else if (cs.getUpdateCount() == -1) {
                    break;
                }
                isResultSet = cs.getMoreResults();
            }
            CeoLog.info("DAO " + method + " rows=" + rows.size()
                    + " ms=" + (System.currentTimeMillis() - start) + " proc=" + proc);
            return rows;
        } catch (Exception e) {
            CeoLog.error("DAO " + method + " failed after "
                    + (System.currentTimeMillis() - start) + " ms (proc " + proc + "): " + e.getMessage());
            throw e;
        } finally {
            if (cs   != null) { try { cs.close();   } catch (Exception e) {  } }
            if (conn != null) { try { conn.close(); } catch (Exception e) {  } }
        }
    }

    private static ArrayList readRows(ResultSet rs) throws Exception {
        ResultSetMetaData md = rs.getMetaData();
        int n = md.getColumnCount();
        String[] labels = new String[n];
        int[]    types  = new int[n];
        for (int c = 0; c < n; c++) {
            labels[c] = md.getColumnLabel(c + 1).toUpperCase();
            types[c]  = md.getColumnType(c + 1);
        }
        ArrayList rows = new ArrayList();
        while (rs.next()) {
            LinkedHashMap row = new LinkedHashMap();
            for (int c = 0; c < n; c++) {
                row.put(labels[c], readValue(rs, c + 1, types[c]));
            }
            rows.add(row);
        }
        return rows;
    }

    private static Object readValue(ResultSet rs, int i, int type) throws Exception {
        switch (type) {
            case Types.CHAR:
            case Types.VARCHAR:
            case Types.NCHAR:
            case Types.NVARCHAR:
            case Types.LONGVARCHAR:
            case Types.LONGNVARCHAR: {
                String s = rs.getString(i);
                return s == null ? null : s.trim();
            }
            case Types.TINYINT:
            case Types.SMALLINT:
            case Types.INTEGER:
            case Types.BIGINT: {
                long v = rs.getLong(i);
                return rs.wasNull() ? null : Long.valueOf(v);
            }
            case Types.DECIMAL:
            case Types.NUMERIC: {
                BigDecimal bd = rs.getBigDecimal(i);
                if (bd == null) return null;
                return bd.scale() <= 0 ? (Object) Long.valueOf(bd.longValue()) : bd;
            }
            case Types.REAL:
            case Types.FLOAT:
            case Types.DOUBLE: {
                double d = rs.getDouble(i);
                return rs.wasNull() ? null : Double.valueOf(d);
            }
            default:
                return rs.getObject(i);
        }
    }

    private static void warnIfDuplicateKeys(String method, ArrayList rows, String[] keyCols) {
        Set seen = new HashSet();
        for (int r = 0; r < rows.size(); r++) {
            Map row = (Map) rows.get(r);
            StringBuffer key = new StringBuffer();
            for (int k = 0; k < keyCols.length; k++) {
                if (k > 0) key.append('|');
                key.append(row.get(keyCols[k]));
            }
            if (!seen.add(key.toString())) {
                CeoLog.warn("DAO " + method + " duplicate key " + key);
            }
        }
    }

    private static int refreshTimeout() {
        String p = System.getProperty("ceo.dash.sql.timeout.seconds");
        if (p == null || p.trim().length() == 0) return DEFAULT_REFRESH_TIMEOUT_SECONDS;
        try { return Integer.parseInt(p.trim()); }
        catch (Exception e) { return DEFAULT_REFRESH_TIMEOUT_SECONDS; }
    }

    private static Timestamp[] checkPeriod(String start, String end) {
        Timestamp s = toTimestamp("periodStart", start);
        Timestamp e = toTimestamp("periodEnd", end);
        if (!s.before(e)) {
            throw new IllegalArgumentException("periodStart " + start
                    + " must be before periodEnd " + end + " (end is exclusive)");
        }
        return new Timestamp[] { s, e };
    }

    private static Timestamp toTimestamp(String name, String value) {
        if (value == null || !value.trim().matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new IllegalArgumentException(name + " must be yyyy-MM-dd, got: " + value);
        }
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd");
        f.setLenient(false);
        try {
            Date d = f.parse(value.trim());
            return new Timestamp(d.getTime());
        } catch (java.text.ParseException ex) {
            throw new IllegalArgumentException(name + " is not a valid date: " + value);
        }
    }

    private static String checkFyLabel(String fyLabel) {
        String s = fyLabel == null ? "" : fyLabel.trim();
        if (!s.matches("\\d{4}-\\d{2}")) {
            throw new IllegalArgumentException("fyLabel must look like 2025-26, got: " + fyLabel);
        }
        int y1 = Integer.parseInt(s.substring(0, 4));
        int y2 = Integer.parseInt(s.substring(5, 7));
        if ((y1 + 1) % 100 != y2) {
            throw new IllegalArgumentException("fyLabel years are not consecutive: " + fyLabel);
        }
        return s;
    }

    private static String checkKey(String name, String value) {
        String s = value == null ? "" : value.trim();
        if (!s.matches("[0-9A-Za-z]{1,40}")) {
            throw new IllegalArgumentException(name + " must be 1-40 letters/digits, got: " + value);
        }
        return s;
    }
}
