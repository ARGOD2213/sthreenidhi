/*
 * CEO Loan Intelligence Dashboard
 * SNBSAP queries for the CEO dashboard. The counting rules are kept in the shared
 * fragments below so every query applies exactly the same filters.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao;

import java.math.BigDecimal;
import java.sql.Connection;
import in.gov.ap.serp.sthreenidhi.platform.db.DataSources;
import java.sql.PreparedStatement;
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
    // build queries scan large tables; drill-downs are small and get a short limit
    private static final int DEFAULT_REFRESH_TIMEOUT_SECONDS = 1800;
    private static final int DRILLDOWN_TIMEOUT_SECONDS       = 120;
    // one FY scan of repayments, run once per snapshot and cached
    private static final int KEYED_TIMEOUT_SECONDS           = 600;

    // woman -> SHG -> VO, active only
    private static final String GEO_JOIN =
        " INNER JOIN SHG_INFO SI WITH (NOLOCK)" +
        "   ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'" +
        " INNER JOIN VO_INFO VI WITH (NOLOCK)" +
        "   ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'";

    // active women, one row per MEMBER_ID (a few ids repeat in SHG_MEMBER_INFO)
    private static final String ACTIVE_MEMBER_DIM =
        " (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY" +
        "    FROM SHG_MEMBER_INFO WITH (NOLOCK)" +
        "   WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20" +
        "   GROUP BY MEMBER_ID)";

    private static final String MEMBER_JOIN =
        " INNER JOIN" + ACTIVE_MEMBER_DIM + " SM ON SM.MEMBER_ID = MCP.MEMBER_LONG_CODE";

    // Stree Nidhi projects only (LOAN_TYPE = 'SN'); -Dceo.dash.snOnly=false brings back every project
    public static final boolean SN_ONLY = !"false".equalsIgnoreCase(System.getProperty("ceo.dash.snOnly", "true").trim());
    private static final String SN_PROJECTS =
        " (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)" +
        "   WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN')";

    private static final String PROJECT_DIM =
        " (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME" +
        "    FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)" +
        (SN_ONLY ? "   WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'" : "") +
        "   GROUP BY PROJECT_TYPE)";

    private static final String LOAN_MONTH  = "CONVERT(CHAR(7), MCP.ISSUED_DATE, 120)";
    private static final String REPAY_MONTH = "CONVERT(CHAR(7), BC.CREDITED_DATE, 120)";
    private static final String LOAN_DAY    = "CONVERT(CHAR(10), MCP.ISSUED_DATE, 120)";
    private static final String REPAY_DAY   = "CONVERT(CHAR(10), BC.CREDITED_DATE, 120)";
    private static final String PURPOSE_KEY = "NULLIF(LTRIM(RTRIM(MCP.PURPOSE)), '')";
    private static final String PURPOSE_NORM = "ISNULL(UPPER(NULLIF(LTRIM(RTRIM(MCP.PURPOSE)), '')), '')";
    private static final String CATEGORY_NORM = "UPPER(LTRIM(RTRIM(ISNULL(SM.CATEGORY, ''))))";

    // payment mode from VO_CREDIT_INFO.CREATED_BY: PAYTM = POS, Phi = UPI, SHG AUTO DEBIT = auto-debit, rest = manual
    public static final boolean PAY_MODES = !"false".equalsIgnoreCase(System.getProperty("ceo.dash.paymodes", "true").trim());
    private static final String PAY_MODE_JOIN = !PAY_MODES ? "" :
        " LEFT JOIN (SELECT VC.BANK_REF_NO, MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE' THEN 3" +
        "                                         WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE' THEN 2" +
        "                                         WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE" +
        "              FROM VO_CREDIT_INFO VC WITH (NOLOCK) WHERE VC.BANK_REF_NO IS NOT NULL" +
        "             GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO";

    /*
     * Which repayments count, as finance counts them: the bank credit has arrived
     * (BANKS_CREDIT_INFO.CREDITED_DATE in the period; that date is also the repayment's day and month)
     * and the VO credit is CLOSED (VO_CREDIT_INFO.VO_REPAY_STATUS). Both tables are first reduced
     * to one row per BANK_REF_NO, so a reference that repeats there cannot count a repayment twice.
     * Binds two dates: period start, period end.
     */
    private static final String CREDITED_JOIN =
        " INNER JOIN (SELECT BCI.BANK_REF_NO, MIN(BCI.CREDITED_DATE) AS CREDITED_DATE" +
        "               FROM BANKS_CREDIT_INFO BCI WITH (NOLOCK)" +
        "              WHERE BCI.CREDITED_DATE >= ? AND BCI.CREDITED_DATE < ? AND BCI.BANK_REF_NO IS NOT NULL" +
        "              GROUP BY BCI.BANK_REF_NO) BC ON BC.BANK_REF_NO = SCI.BANK_REF_NO" +
        " INNER JOIN (SELECT VC.BANK_REF_NO, MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE' THEN 3" +
        "                                         WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE' THEN 2" +
        "                                         WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE," +
        "                    MAX(VC.CREATED_BY) AS CB" +
        "               FROM VO_CREDIT_INFO VC WITH (NOLOCK)" +
        "              WHERE VC.BANK_REF_NO IS NOT NULL AND VC.VO_REPAY_STATUS = 'CLOSED'" +
        "              GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO";
    private static String modeSum(int code, boolean amount) {
        if (!PAY_MODES) return amount ? "CAST(0 AS DECIMAL(18,2))" : "0";
        return "SUM(CASE WHEN PM.MODE_CODE = " + code + " THEN " + (amount ? "SCI.REPAID_AMOUNT" : "1") + " ELSE 0 END)";
    }
    private static final String PAY_MODE_MEASURES =
        ", " + modeSum(3, true) + " AS REPAID_POS, " + modeSum(2, true) + " AS REPAID_UPI, " + modeSum(1, true) + " AS REPAID_AUTO" +
        ", " + modeSum(3, false) + " AS TXNS_POS, " + modeSum(2, false) + " AS TXNS_UPI, " + modeSum(1, false) + " AS TXNS_AUTO";

    private static final String BY_DISTRICT = "VI.DISTRICT_ID";
    private static final String BY_MANDAL   = "VI.DISTRICT_ID, VI.MANDAL_ID";

    // active district and active rural (non-MEPMA) mandal; EXISTS so duplicate master rows cannot multiply figures
    private static String geoFilter(String a) {
        return " EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)" +
               "          WHERE DM.DISTRICT_ID = " + a + ".DISTRICT_ID AND DM.FLAG = 'Y')" +
               " AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)" +
               "              WHERE MM.DISTRICT_ID = " + a + ".DISTRICT_ID" +
               "                AND MM.MANDAL_ID = " + a + ".MANDAL_ID" +
               "                AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')";
    }

    // a loan counts only if it is a real, issued Stree Nidhi loan
    private static String loanQuality(String a) {
        return " " + a + ".MEMBER_LONG_CODE IS NOT NULL" +
               " AND LTRIM(RTRIM(" + a + ".MEMBER_LONG_CODE)) <> ''" +
               " AND LEN(" + a + ".MEMBER_LONG_CODE) >= 20" +
               " AND " + a + ".ISSUED_DATE IS NOT NULL" +
               " AND " + a + ".ISSUED_DATE > '2000-01-01'" +
               " AND " + a + ".LOAN_STATUS IN ('OPEN','CLOSED')" +
               (SN_ONLY ? " AND " + a + ".PROJECT_TYPE IN" + SN_PROJECTS : "");
    }

    private static String memberPopulationSql(String keys, String extraMeasures) {
        return "SELECT " + keys + "," +
               " COUNT(DISTINCT SM.MEMBER_ID) AS ACTIVE_MEMBERS," +
               " COUNT(DISTINCT SM.SHG_ID) AS ACTIVE_SHGS," +
               " COUNT(DISTINCT SI.VO_ID) AS ACTIVE_VOS" + extraMeasures +
               " FROM" + ACTIVE_MEMBER_DIM + " SM" + GEO_JOIN +
               " WHERE" + geoFilter("VI") +
               " GROUP BY " + keys;
    }

    private static String membersWithLoansSql(String keys) {
        return "SELECT " + keys + "," +
               " COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_WITH_LOANS" +
               " FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)" + MEMBER_JOIN + GEO_JOIN +
               " WHERE" + loanQuality("MCP") + " AND" + geoFilter("VI") +
               " GROUP BY " + keys;
    }

    private static String loanAggSql(String selectKeys, String groupKeys) {
        return "SELECT " + selectKeys + "," +
               " COUNT(*) AS LOAN_COUNT," +
               " SUM(MCP.LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT," +
               " SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT," +
               " SUM(CASE WHEN MCP.LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT," +
               " SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN MCP.LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT," +
               " COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_ACTIVE_LOAN_SIDE" +
               " FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)" + MEMBER_JOIN + GEO_JOIN +
               " WHERE MCP.ISSUED_DATE >= ? AND MCP.ISSUED_DATE < ?" +
               " AND" + loanQuality("MCP") + " AND" + geoFilter("VI") +
               " GROUP BY " + groupKeys;
    }

    private static String repayAggSql(String selectKeys, String groupKeys) {
        return "SELECT " + selectKeys + "," +
               " COUNT(*) AS REPAYMENT_TXN_COUNT," +
               " SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT," +
               " SUM(CASE WHEN UPPER(SCI.REPAY_STATUS) = 'CLOSED' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_CLOSED," +
               " SUM(CASE WHEN SCI.IS_PROCESSED = 'N' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_UNPROCESSED," +
               " SUM(CASE WHEN LTRIM(RTRIM(ISNULL(SCI.Adjust_Type, ''))) <> '' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_ADJUSTMENT," +
               " COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_ACTIVE_REPAY_SIDE" + PAY_MODE_MEASURES +
               " FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)" + CREDITED_JOIN +
               " INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)" +
               "   ON MCP.SHG_MEMBER_LOAN_ACCNO = SCI.SHG_MEMBER_LOAN_ACCNO" +
               MEMBER_JOIN + GEO_JOIN +
               " WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> ''" +
               " AND" + loanQuality("MCP") + " AND" + geoFilter("VI") +
               " GROUP BY " + groupKeys;
    }

    // target columns are stored as text - convert only clean numbers
    private static String safeNumber(String col) {
        String t = "LTRIM(RTRIM(" + col + "))";
        return "CASE WHEN " + t + " LIKE '%[0-9]%' AND " + t + " NOT LIKE '%[^0-9.]%'" +
               " AND " + t + " NOT LIKE '%.%.%' THEN CAST(" + t + " AS DECIMAL(18,2)) END";
    }

    // targets: one row per FY / district / mandal
    private static final String TARGET_MANDAL_DEDUP_SQL =
        "SELECT T.DISTRICT_ID, T.MANDAL_ID," +
        " MAX(" + safeNumber("T.TARGET_SHG") + ") AS TARGET_SHG," +
        " MAX(" + safeNumber("T.TARGET_MEMBER") + ") AS TARGET_MEMBER," +
        " MAX(T.TARGET_AMOUNT) AS TARGET_AMOUNT," +
        " SUM(T.TARGET_AMOUNT) AS TARGET_AMOUNT_RAW_SUM," +
        " COUNT(*) AS TARGET_RAW_ROWS" +
        " FROM LIVELIHOOD_MANDALWISE_TARGET_FY18 T WITH (NOLOCK)" +
        " WHERE T.FY_YEAR = CAST(? AS VARCHAR(20))" +
        " GROUP BY T.FY_YEAR, T.DISTRICT_ID, T.MANDAL_ID";

    private static final String TARGET_DISTRICT_SQL =
        "SELECT TM.DISTRICT_ID," +
        " SUM(TM.TARGET_SHG) AS TARGET_SHG," +
        " SUM(TM.TARGET_MEMBER) AS TARGET_MEMBER," +
        " SUM(TM.TARGET_AMOUNT) AS TARGET_AMOUNT," +
        " COUNT(*) AS TARGET_MANDALS," +
        " SUM(TM.TARGET_AMOUNT_RAW_SUM) AS TARGET_AMOUNT_RAW_SUM," +
        " SUM(TM.TARGET_RAW_ROWS) AS TARGET_RAW_ROWS" +
        " FROM (" + TARGET_MANDAL_DEDUP_SQL + ") TM" +
        " WHERE" + geoFilter("TM") +
        " GROUP BY TM.DISTRICT_ID";

    public ArrayList getActiveMandals() throws Exception {
        String sql =
            "SELECT MM.DISTRICT_ID, MM.MANDAL_ID, MM.MANDAL_DESCRIPTION AS MANDAL_NAME" +
            " FROM MANDAL_MASTER MM WITH (NOLOCK)" +
            " WHERE MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N'" +
            " AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)" +
            "              WHERE DM.DISTRICT_ID = MM.DISTRICT_ID AND DM.FLAG = 'Y')" +
            " ORDER BY MM.DISTRICT_ID, MM.MANDAL_ID";
        ArrayList rows = query("getActiveMandals", sql, new Object[0], refreshTimeout());
        warnIfDuplicateKeys("getActiveMandals", rows, new String[] { "DISTRICT_ID", "MANDAL_ID" });
        return rows;
    }

    // who owns each mandal (the mapping table has exact duplicates, hence DISTINCT)
    public ArrayList getOfficerMandalMapping() throws Exception {
        String activeUsers =
            " (SELECT USER_ID, MAX(EMP_CODE) AS EMP_CODE" +
            "    FROM SNBS_USER_INFO WITH (NOLOCK)" +
            "   WHERE IS_ACTIVE = 'Y' GROUP BY USER_ID)";
        String sql =
            "SELECT DISTINCT MAP.DISTRICT_ID, DM.DISTRICT_DESCRIPTION AS DISTRICT_NAME," +
            " MAP.MANDAL_ID, MM.MANDAL_NAME," +
            " CASE WHEN MM.MANDAL_ID IS NULL THEN 'N' ELSE 'Y' END AS MANDAL_IN_ACTIVE_MASTER," +
            " CASE WHEN MAP.MANG_USER_NAME LIKE 'SN_MANG%' THEN 'MANAGER'" +
            "      WHEN MAP.MANG_USER_NAME LIKE 'SN_AM%'   THEN 'AM'" +
            "      WHEN MAP.MANG_USER_NAME LIKE 'SN_AGM%'  THEN 'AGM'" +
            "      ELSE 'OTHER' END AS OFFICER_ROLE," +
            " MAP.MANG_USER_NAME AS OFFICER_USER_ID, MAP.MANAGER_NAME AS OFFICER_NAME," +
            " OFU.EMP_CODE AS OFFICER_EMP_ID," +
            " MAP.AGM_USER_NAME, MAP.DIST_AGM_NAME AS AGM_NAME, AGU.EMP_CODE AS AGM_EMP_ID," +
            " MAP.DGM_USER_NAME, MAP.MONITORING_DGM_NAME AS DGM_NAME, DGU.EMP_CODE AS DGM_EMP_ID" +
            " FROM DIST_DGM_AGM_MANG_MAPPING MAP WITH (NOLOCK)" +
            " INNER JOIN DISTRICT_MASTER DM WITH (NOLOCK)" +
            "   ON DM.DISTRICT_ID = MAP.DISTRICT_ID AND DM.FLAG = 'Y'" +
            " LEFT JOIN (SELECT DISTRICT_ID, MANDAL_ID, MAX(MANDAL_DESCRIPTION) AS MANDAL_NAME" +
            "              FROM MANDAL_MASTER WITH (NOLOCK)" +
            "             WHERE IS_ACTIVE = 'Y' AND IS_MEPMA = 'N'" +
            "             GROUP BY DISTRICT_ID, MANDAL_ID) MM" +
            "   ON MM.DISTRICT_ID = MAP.DISTRICT_ID AND MM.MANDAL_ID = MAP.MANDAL_ID" +
            " LEFT JOIN" + activeUsers + " OFU ON OFU.USER_ID = MAP.MANG_USER_NAME" +
            " LEFT JOIN" + activeUsers + " AGU ON AGU.USER_ID = MAP.AGM_USER_NAME" +
            " LEFT JOIN" + activeUsers + " DGU ON DGU.USER_ID = MAP.DGM_USER_NAME" +
            " WHERE MAP.MANDAL_ID IS NOT NULL AND LTRIM(RTRIM(MAP.MANDAL_ID)) <> ''" +
            " ORDER BY DGM_USER_NAME, AGM_USER_NAME, OFFICER_USER_ID, DISTRICT_ID, MANDAL_ID";
        ArrayList rows = query("getOfficerMandalMapping", sql, new Object[0], refreshTimeout());
        warnIfDuplicateKeys("getOfficerMandalMapping", rows, new String[] { "DISTRICT_ID", "MANDAL_ID" });
        return rows;
    }

    // FY totals per district: members, loans, repayments, targets
    public ArrayList getDistrictRollup(String fyLabel, String fyStart, String fyEnd) throws Exception {
        String label = checkFyLabel(fyLabel);
        Timestamp[] p = checkPeriod(fyStart, fyEnd);

        String sql =
            "SELECT DM.DISTRICT_ID, DM.DISTRICT_DESCRIPTION AS DISTRICT_NAME," +
            " ISNULL(MEM.ACTIVE_MEMBERS, 0) AS ACTIVE_MEMBERS," +
            " ISNULL(MWL.MEMBERS_WITH_LOANS, 0) AS MEMBERS_WITH_LOANS," +
            " ISNULL(LN.MEMBERS_ACTIVE_LOAN_SIDE, 0) AS MEMBERS_ACTIVE_LOAN_SIDE," +
            " ISNULL(RP.MEMBERS_ACTIVE_REPAY_SIDE, 0) AS MEMBERS_ACTIVE_REPAY_SIDE," +
            " ISNULL(LN.LOAN_COUNT, 0) AS LOAN_COUNT," +
            " ISNULL(LN.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT," +
            " ISNULL(LN.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT," +
            " ISNULL(LN.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT," +
            " ISNULL(RP.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT," +
            " ISNULL(RP.REPAID_AMOUNT, 0) AS REPAID_AMOUNT," +
            " ISNULL(RP.REPAID_AMOUNT_CLOSED, 0) AS REPAID_AMOUNT_CLOSED," +
            " ISNULL(RP.REPAID_AMOUNT_UNPROCESSED, 0) AS REPAID_AMOUNT_UNPROCESSED," +
            " ISNULL(RP.REPAID_AMOUNT_ADJUSTMENT, 0) AS REPAID_AMOUNT_ADJUSTMENT," +
            " ISNULL(TGT.TARGET_AMOUNT, 0) AS TARGET_AMOUNT" +
            " FROM DISTRICT_MASTER DM WITH (NOLOCK)" +
            " LEFT JOIN (" + memberPopulationSql(BY_DISTRICT, "") + ") MEM ON MEM.DISTRICT_ID = DM.DISTRICT_ID" +
            " LEFT JOIN (" + membersWithLoansSql(BY_DISTRICT) + ") MWL ON MWL.DISTRICT_ID = DM.DISTRICT_ID" +
            " LEFT JOIN (" + loanAggSql(BY_DISTRICT, BY_DISTRICT) + ") LN ON LN.DISTRICT_ID = DM.DISTRICT_ID" +
            " LEFT JOIN (" + repayAggSql(BY_DISTRICT, BY_DISTRICT) + ") RP ON RP.DISTRICT_ID = DM.DISTRICT_ID" +
            " LEFT JOIN (" + TARGET_DISTRICT_SQL + ") TGT ON TGT.DISTRICT_ID = DM.DISTRICT_ID" +
            " WHERE DM.FLAG = 'Y'" +
            " ORDER BY DM.DISTRICT_ID";

        ArrayList rows = query("getDistrictRollup", sql,
                new Object[] { p[0], p[1], p[0], p[1], label }, refreshTimeout());
        warnIfDuplicateKeys("getDistrictRollup", rows, new String[] { "DISTRICT_ID" });
        return rows;
    }

    public ArrayList getMandalDailyLoanRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String sql = loanAggSql(BY_MANDAL + ", " + LOAN_DAY + " AS PERIOD_DAY",
                                BY_MANDAL + ", " + LOAN_DAY) +
                     " ORDER BY 1, 2, 3";
        return query("getMandalDailyLoanRollup", sql, new Object[] { p[0], p[1] }, refreshTimeout());
    }

    public ArrayList getMandalDailyRepaymentRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String sql = repayAggSql(BY_MANDAL + ", " + REPAY_DAY + " AS PERIOD_DAY",
                                 BY_MANDAL + ", " + REPAY_DAY) +
                     " ORDER BY 1, 2, 3";
        return query("getMandalDailyRepaymentRollup", sql, new Object[] { p[0], p[1] }, refreshTimeout());
    }

    public ArrayList getDistrictProjectComposition(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String sql =
            "SELECT A.DISTRICT_ID, A.PROJECT_TYPE, PT.PROJECT_NAME," +
            " A.LOAN_COUNT, A.DISBURSED_AMOUNT, A.OPEN_LOAN_COUNT, A.CLOSED_LOAN_COUNT," +
            " A.MEMBERS_ACTIVE_LOAN_SIDE" +
            " FROM (" + loanAggSql(BY_DISTRICT + ", MCP.PROJECT_TYPE",
                                   BY_DISTRICT + ", MCP.PROJECT_TYPE") + ") A" +
            " LEFT JOIN" + PROJECT_DIM + " PT ON PT.PROJECT_TYPE = A.PROJECT_TYPE" +
            " ORDER BY A.DISTRICT_ID, A.PROJECT_TYPE";
        return query("getDistrictProjectComposition", sql, new Object[] { p[0], p[1] }, refreshTimeout());
    }

    public ArrayList getMandalLoanRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String sql = loanAggSql(BY_MANDAL, BY_MANDAL) + " ORDER BY VI.DISTRICT_ID, VI.MANDAL_ID";
        return query("getMandalLoanRollup", sql, new Object[] { p[0], p[1] }, refreshTimeout());
    }

    // repayments whose bank credit was entered by a person (VO_CREDIT_INFO.CREATED_BY is not one of the
    // online channels), summed per login; one row per CREATED_BY
    public ArrayList getCashKeyedBy(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String sql =
            "SELECT PM.CB AS CREATED_BY, COUNT(*) AS TXN_COUNT, SUM(SCI.REPAID_AMOUNT) AS AMOUNT," +
            " CONVERT(CHAR(10), MIN(BC.CREDITED_DATE), 120) AS FIRST_DATE," +
            " CONVERT(CHAR(10), MAX(BC.CREDITED_DATE), 120) AS LAST_DATE" +
            " FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)" + CREDITED_JOIN +
            " INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = SCI.SHG_MEMBER_LOAN_ACCNO" +
            " WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> '' AND" + loanQuality("MCP") +
            " AND PM.CB NOT IN ('PAYTM PAYMENT SERVICE', 'Phi PAYMENT SERVICE', 'SHG AUTO DEBIT PROCESS')" +
            " GROUP BY PM.CB";
        return query("getCashKeyedBy", sql, new Object[] { p[0], p[1] }, KEYED_TIMEOUT_SECONDS);
    }

    /*
     * Overdue = arrears in SN.SHG_MEMBER_LOAN_STATUS_NEW (one row per loan, refreshed daily by SNBSAP):
     * LOAN_DUE = amount behind before this month's instalment, LOAN_EMI = the instalment, OUTSTANDING = balance.
     * Same loans, same woman -> SHG -> VO geography and same quality rules as every other figure here.
     * Bands by how many instalments the arrears equal: up to 1, 1 to 3, over 3 (or no instalment amount left).
     */
    private static final String STATUS_TABLE = statusTable();

    private static String statusTable() {
        String t = System.getProperty("ceo.dash.statusTable", "SN.SHG_MEMBER_LOAN_STATUS_NEW").trim();
        return t.matches("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)?") ? t : "SN.SHG_MEMBER_LOAN_STATUS_NEW";
    }

    public ArrayList getMandalOverdueRollup() throws Exception {
        return query("getMandalOverdueRollup", overdueSql(), new Object[0], refreshTimeout());
    }

    // package-visible so a test can look at the exact text
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

    public ArrayList getMandalTargetRollup(String fyLabel) throws Exception {
        String label = checkFyLabel(fyLabel);
        String sql =
            "SELECT TM.DISTRICT_ID, TM.MANDAL_ID, TM.TARGET_SHG, TM.TARGET_MEMBER," +
            " TM.TARGET_AMOUNT, TM.TARGET_AMOUNT_RAW_SUM, TM.TARGET_RAW_ROWS" +
            " FROM (" + TARGET_MANDAL_DEDUP_SQL + ") TM" +
            " WHERE" + geoFilter("TM") +
            " ORDER BY TM.DISTRICT_ID, TM.MANDAL_ID";
        return query("getMandalTargetRollup", sql, new Object[] { label }, refreshTimeout());
    }

    // 24-month cube rows: district x mandal x month x project
    public ArrayList getLoanCube(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String keys = BY_MANDAL + ", " + LOAN_MONTH + " AS PERIOD_MONTH, MCP.PROJECT_TYPE, " + CATEGORY_NORM + " AS CATEGORY";
        String grp  = BY_MANDAL + ", " + LOAN_MONTH + ", MCP.PROJECT_TYPE, " + CATEGORY_NORM;
        return query("getLoanCube", loanAggSql(keys, grp), new Object[] { p[0], p[1] }, refreshTimeout());
    }

    public ArrayList getMandalPurposeRollup(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String keys = BY_MANDAL + ", " + PURPOSE_NORM + " AS PURPOSE";
        String grp  = BY_MANDAL + ", " + PURPOSE_NORM;
        return query("getMandalPurposeRollup", loanAggSql(keys, grp), new Object[] { p[0], p[1] }, refreshTimeout());
    }

    public ArrayList getProjectNames() throws Exception {
        String sql = "SELECT PT.PROJECT_TYPE, PT.PROJECT_NAME FROM" + PROJECT_DIM + " PT ORDER BY PT.PROJECT_TYPE";
        return query("getProjectNames", sql, new Object[0], refreshTimeout());
    }

    public ArrayList getRepaymentCube(String periodStart, String periodEnd) throws Exception {
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String keys = BY_MANDAL + ", " + REPAY_MONTH + " AS PERIOD_MONTH, MCP.PROJECT_TYPE";
        String grp  = BY_MANDAL + ", " + REPAY_MONTH + ", MCP.PROJECT_TYPE";
        return query("getRepaymentCube", repayAggSql(keys, grp), new Object[] { p[0], p[1] }, refreshTimeout());
    }

    private static final int MAX_FACT_FIRST_DAYS = 31;

    private static final class Frag {
        final StringBuffer sql = new StringBuffer();
        final ArrayList params = new ArrayList();
        Frag add(String s) { sql.append(s); return this; }
        Frag bind(String s, Object v) { sql.append(s); params.add(v); return this; }
        Frag add(Frag f) { sql.append(f.sql); params.addAll(f.params); return this; }
    }

    private static final class Scope {
        String level, d, m, v, s;
        void where(Frag f) {
            if ("DISTRICT".equals(level)) f.bind(" VI.DISTRICT_ID = CAST(? AS VARCHAR(10))", d);
            else if ("MANDAL".equals(level)) f.bind(" VI.DISTRICT_ID = CAST(? AS VARCHAR(10))", d)
                                              .bind(" AND VI.MANDAL_ID = CAST(? AS VARCHAR(10))", m);
            else if ("VO".equals(level)) f.bind(" VI.TRANS_VO_ID = CAST(? AS VARCHAR(40))", v);
            else if ("SHG".equals(level)) f.bind(" SM.SHG_ID = CAST(? AS VARCHAR(40))", s);
            else f.add(" 1 = 1");
        }
    }

    private static Frag scopedMembers(Scope sc) {
        Frag f = new Frag().add(
            " (SELECT SM.MEMBER_ID, MAX(SM.MEMBER_NAME) AS MEMBER_NAME, MAX(SM.SHG_ID) AS SHG_ID, MAX(SI.VO_ID) AS VO_ID," +
            "         MAX(SM.CATAGORY) AS CATEGORY" +
            "    FROM SHG_MEMBER_INFO SM WITH (NOLOCK)" + GEO_JOIN +
            "   WHERE SM.IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(SM.MEMBER_ID))) >= 20 AND");
        sc.where(f);
        return f.add(" AND" + geoFilter("VI") + " GROUP BY SM.MEMBER_ID)");
    }

    private static final String FACT_GEO =
        " CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)" +
        "               WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'" +
        "               ORDER BY SMQ.SHG_ID DESC) SMX" +
        " INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'" +
        " INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'";

    // CREDITED_JOIN with its two period dates bound in place
    private static void bindCredited(Frag f, Timestamp[] p) {
        int a = CREDITED_JOIN.indexOf('?');
        int b = CREDITED_JOIN.indexOf('?', a + 1);
        f.bind(CREDITED_JOIN.substring(0, a + 1), p[0])
         .bind(CREDITED_JOIN.substring(a + 1, b + 1), p[1])
         .add(CREDITED_JOIN.substring(b + 1));
    }

    private static void projectFilter(Frag f, String project) {
        if (project != null) f.bind(" AND MCP.PROJECT_TYPE = CAST(? AS VARCHAR(20))", project);
    }

    private static Frag loansFrag(boolean membersFirst, Scope sc, String key, Timestamp[] p, String project) {
        Frag f = new Frag().add(
            "SELECT " + key + " AS UNIT_ID, COUNT(*) AS LOAN_COUNT," +
            " SUM(MCP.LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT," +
            " SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT," +
            " SUM(CASE WHEN MCP.LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT," +
            " SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN MCP.LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT," +
            " COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS BORROWERS" +
            " FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)");
        if (membersFirst) {
            f.add(" INNER JOIN").add(scopedMembers(sc)).add(" X ON X.MEMBER_ID = MCP.MEMBER_LONG_CODE");
            f.bind(" WHERE MCP.ISSUED_DATE >= ?", p[0]).bind(" AND MCP.ISSUED_DATE < ?", p[1]);
            f.add(" AND" + loanQuality("MCP"));
        } else {
            f.add(FACT_GEO);
            f.bind(" WHERE MCP.ISSUED_DATE >= ?", p[0]).bind(" AND MCP.ISSUED_DATE < ?", p[1]);
            f.add(" AND" + loanQuality("MCP") + " AND" + geoFilter("VI") + " AND");
            sc.where(f);
        }
        projectFilter(f, project);
        return f.add(" GROUP BY " + key);
    }

    private static Frag repayFrag(boolean membersFirst, Scope sc, String key, Timestamp[] p, String project) {
        Frag f = new Frag().add(
            "SELECT " + key + " AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT," +
            " SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT," +
            " COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS PAYERS" + PAY_MODE_MEASURES +
            " FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)");
        bindCredited(f, p);
        f.add(" INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = SCI.SHG_MEMBER_LOAN_ACCNO");
        if (membersFirst) {
            f.add(" INNER JOIN").add(scopedMembers(sc)).add(" X ON X.MEMBER_ID = MCP.MEMBER_LONG_CODE");
            f.add(" WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> '' AND" + loanQuality("MCP"));
        } else {
            f.add(FACT_GEO);
            f.add(" WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> '' AND" + loanQuality("MCP") + " AND" + geoFilter("VI") + " AND");
            sc.where(f);
        }
        projectFilter(f, project);
        return f.add(" GROUP BY " + key);
    }

    private static final String MEASURES =
        " ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT," +
        " ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT," +
        " ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS," +
        " ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT," +
        " ISNULL(R.PAYERS, 0) AS PAYERS," +
        " ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO," +
        " ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO";

    // one drill-down level for one scope and period
    public ArrayList drill(String group, String districtId, String mandalId, String voId, String shgId,
                           String periodStart, String periodEnd, String projectType) throws Exception {
        String g = group == null ? "" : group.trim().toUpperCase();
        Timestamp[] p = checkPeriod(periodStart, periodEnd);
        String project = blank(projectType) ? null : checkKey("projectType", projectType);
        Scope sc = new Scope();
        sc.d = blank(districtId) ? null : checkKey("districtId", districtId);
        sc.m = blank(mandalId)   ? null : checkKey("mandalId", mandalId);
        sc.v = blank(voId)       ? null : checkKey("voId", voId);
        sc.s = blank(shgId)      ? null : checkKey("shgId", shgId);
        sc.level = sc.s != null ? "SHG" : sc.v != null ? "VO" : sc.m != null ? "MANDAL" : sc.d != null ? "DISTRICT" : "STATE";
        if ("MANDAL".equals(sc.level) && sc.d == null) throw new IllegalArgumentException("mandalId needs districtId");

        boolean membersFirst = "MANDAL".equals(sc.level) || "VO".equals(sc.level) || "SHG".equals(sc.level);
        String allowed = membersFirst
            ? ("MANDAL".equals(sc.level) ? "VO SHG PROJECT CATEGORY PURPOSE" : "VO".equals(sc.level) ? "SHG PROJECT CATEGORY PURPOSE"
                                         : "MEMBER PROJECT CATEGORY PURPOSE")
            : ("STATE".equals(sc.level) ? "DISTRICT PROJECT" : "MANDAL PROJECT");
        if ((" " + allowed + " ").indexOf(" " + g + " ") < 0) {
            throw new IllegalArgumentException("group " + g + " is not available at " + sc.level + " level");
        }
        if (!membersFirst) {
            long days = (p[1].getTime() - p[0].getTime()) / 86400000L;
            if (days > MAX_FACT_FIRST_DAYS) {
                throw new IllegalArgumentException("period longer than " + MAX_FACT_FIRST_DAYS
                        + " days at " + sc.level + " level is served from the snapshot");
            }
        }

        boolean split = "PROJECT".equals(g) || "CATEGORY".equals(g) || "PURPOSE".equals(g);
        String key;
        if ("PROJECT".equals(g)) key = "MCP.PROJECT_TYPE";
        else if ("CATEGORY".equals(g)) key = "UPPER(LTRIM(RTRIM(ISNULL(X.CATEGORY, ''))))";
        else if ("PURPOSE".equals(g)) key = PURPOSE_NORM;
        else if (membersFirst) key = "VO".equals(g) ? "X.VO_ID" : "SHG".equals(g) ? "X.SHG_ID" : "X.MEMBER_ID";
        else key = "DISTRICT".equals(g) ? "VI.DISTRICT_ID" : "VI.MANDAL_ID";

        Frag sql = new Frag();
        if (split) {
            String name = "PROJECT".equals(g) ? "MAX(PT.PROJECT_NAME)" : "COALESCE(L.UNIT_ID, R.UNIT_ID)";
            sql.add("SELECT COALESCE(L.UNIT_ID, R.UNIT_ID) AS UNIT_ID, " + name + " AS UNIT_NAME," +
                    " CAST(NULL AS INT) AS ACTIVE_MEMBERS," +
                    " MAX(ISNULL(L.LOAN_COUNT, 0)) AS LOAN_COUNT, MAX(ISNULL(L.DISBURSED_AMOUNT, 0)) AS DISBURSED_AMOUNT," +
                    " MAX(ISNULL(L.OPEN_LOAN_COUNT, 0)) AS OPEN_LOAN_COUNT, MAX(ISNULL(L.CLOSED_LOAN_COUNT, 0)) AS CLOSED_LOAN_COUNT," +
                    " MAX(ISNULL(L.OPEN_AMOUNT, 0)) AS OPEN_AMOUNT," +
                    " MAX(ISNULL(L.BORROWERS, 0)) AS BORROWERS," +
                    " MAX(ISNULL(R.REPAYMENT_TXN_COUNT, 0)) AS REPAYMENT_TXN_COUNT, MAX(ISNULL(R.REPAID_AMOUNT, 0)) AS REPAID_AMOUNT," +
                    " MAX(ISNULL(R.PAYERS, 0)) AS PAYERS," +
                    " MAX(ISNULL(R.REPAID_POS, 0)) AS REPAID_POS, MAX(ISNULL(R.REPAID_UPI, 0)) AS REPAID_UPI," +
                    " MAX(ISNULL(R.REPAID_AUTO, 0)) AS REPAID_AUTO, MAX(ISNULL(R.TXNS_POS, 0)) AS TXNS_POS," +
                    " MAX(ISNULL(R.TXNS_UPI, 0)) AS TXNS_UPI, MAX(ISNULL(R.TXNS_AUTO, 0)) AS TXNS_AUTO" +
                    " FROM (").add(loansFrag(membersFirst, sc, key, p, project)).add(") L" +
                    " FULL OUTER JOIN (").add(repayFrag(membersFirst, sc, key, p, project)).add(") R ON R.UNIT_ID = L.UNIT_ID" +
                    ("PROJECT".equals(g) ? " LEFT JOIN" + PROJECT_DIM + " PT ON PT.PROJECT_TYPE = COALESCE(L.UNIT_ID, R.UNIT_ID)" : "") +
                    " GROUP BY COALESCE(L.UNIT_ID, R.UNIT_ID)");
        } else {
            Frag units = new Frag();
            String membersCol;
            Frag members = null;
            if ("DISTRICT".equals(g)) {
                units.add("SELECT DM.DISTRICT_ID AS UNIT_ID, MAX(DM.DISTRICT_DESCRIPTION) AS UNIT_NAME" +
                          " FROM DISTRICT_MASTER DM WITH (NOLOCK) WHERE DM.FLAG = 'Y' GROUP BY DM.DISTRICT_ID");
                membersCol = "CAST(NULL AS INT)";
            } else if ("MANDAL".equals(g)) {
                units.add("SELECT MM.MANDAL_ID AS UNIT_ID, MAX(MM.MANDAL_DESCRIPTION) AS UNIT_NAME" +
                          " FROM MANDAL_MASTER MM WITH (NOLOCK) WHERE MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N'" +
                          " AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)" +
                          "              WHERE DM.DISTRICT_ID = MM.DISTRICT_ID AND DM.FLAG = 'Y')");
                if (sc.d != null) units.bind(" AND MM.DISTRICT_ID = CAST(? AS VARCHAR(10))", sc.d);
                units.add(" GROUP BY MM.MANDAL_ID");
                membersCol = "CAST(NULL AS INT)";
            } else if ("VO".equals(g)) {
                units.add("SELECT VI.TRANS_VO_ID AS UNIT_ID, MAX(VI.VO_NAME) AS UNIT_NAME" +
                          " FROM VO_INFO VI WITH (NOLOCK) WHERE VI.IS_ACTIVE = 'Y' AND");
                sc.where(units);
                units.add(" GROUP BY VI.TRANS_VO_ID");
                members = new Frag().add("SELECT X.VO_ID AS UNIT_ID, COUNT(*) AS ACTIVE_MEMBERS FROM")
                                    .add(scopedMembers(sc)).add(" X GROUP BY X.VO_ID");
                membersCol = "ISNULL(M.ACTIVE_MEMBERS, 0)";
            } else if ("SHG".equals(g) && "MANDAL".equals(sc.level)) {
                // SHGs of a whole mandal: only the 100 with the highest collections are returned
                units.bind("SELECT SI.TRANS_SHG_ID AS UNIT_ID, MAX(SI.SHG_NAME) AS UNIT_NAME, MAX(SI.VO_ID) AS PARENT_ID" +
                           " FROM SHG_INFO SI WITH (NOLOCK)" +
                           " INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'" +
                           " WHERE SI.IS_ACTIVE = 'Y' AND VI.DISTRICT_ID = CAST(? AS VARCHAR(10))", sc.d)
                     .bind(" AND VI.MANDAL_ID = CAST(? AS VARCHAR(10)) GROUP BY SI.TRANS_SHG_ID", sc.m);
                members = new Frag().add("SELECT X.SHG_ID AS UNIT_ID, COUNT(*) AS ACTIVE_MEMBERS FROM")
                                    .add(scopedMembers(sc)).add(" X GROUP BY X.SHG_ID");
                membersCol = "ISNULL(M.ACTIVE_MEMBERS, 0)";
            } else if ("SHG".equals(g)) {
                units.bind("SELECT SI.TRANS_SHG_ID AS UNIT_ID, MAX(SI.SHG_NAME) AS UNIT_NAME" +
                           " FROM SHG_INFO SI WITH (NOLOCK) WHERE SI.IS_ACTIVE = 'Y'" +
                           " AND SI.VO_ID = CAST(? AS VARCHAR(40)) GROUP BY SI.TRANS_SHG_ID", sc.v);
                members = new Frag().add("SELECT X.SHG_ID AS UNIT_ID, COUNT(*) AS ACTIVE_MEMBERS FROM")
                                    .add(scopedMembers(sc)).add(" X GROUP BY X.SHG_ID");
                membersCol = "ISNULL(M.ACTIVE_MEMBERS, 0)";
            } else {
                units.add("SELECT X.MEMBER_ID AS UNIT_ID, X.MEMBER_NAME AS UNIT_NAME FROM")
                     .add(scopedMembers(sc)).add(" X");
                membersCol = "1";
            }
            boolean topShgs = "SHG".equals(g) && "MANDAL".equals(sc.level);
            sql.add("SELECT " + (topShgs ? "TOP 100 U.PARENT_ID, " : "") + "U.UNIT_ID, U.UNIT_NAME, " + membersCol + " AS ACTIVE_MEMBERS," + MEASURES)
               .add(" FROM (").add(units).add(") U");
            if (members != null) sql.add(" LEFT JOIN (").add(members).add(") M ON M.UNIT_ID = U.UNIT_ID");
            sql.add(" LEFT JOIN (").add(loansFrag(membersFirst, sc, key, p, project)).add(") L ON L.UNIT_ID = U.UNIT_ID");
            sql.add(" LEFT JOIN (").add(repayFrag(membersFirst, sc, key, p, project)).add(") R ON R.UNIT_ID = U.UNIT_ID");
            sql.add(topShgs ? " ORDER BY ISNULL(R.REPAID_AMOUNT, 0) DESC, ISNULL(L.DISBURSED_AMOUNT, 0) DESC" : " ORDER BY U.UNIT_NAME");
        }
        return query("drill " + g + "@" + sc.level, sql.sql.toString(), sql.params.toArray(), DRILLDOWN_TIMEOUT_SECONDS);
    }

    // profile, loans and repayments of one woman (mobile: last 4 digits only)
    public ArrayList getMemberDetail(String memberId) throws Exception {
        String id = checkKey("memberId", memberId);
        String member =
            "SELECT 'MEMBER' AS ROW_TYPE, SM.MEMBER_ID, MAX(SM.MEMBER_NAME) AS MEMBER_NAME, MAX(SM.SHG_ID) AS SHG_ID," +
            " MAX(SM.MEMBER_SURNAME) AS MEMBER_SURNAME, MAX(SM.FATHER_HUSBAND_NAME) AS FH_NAME," +
            " MAX(SM.FATHER_HUSBAND_SUR_NAME) AS FH_SURNAME, MAX(YEAR(SM.DOB)) AS BIRTH_YEAR," +
            " MAX(SM.MARITIAL_STATUS) AS MARITAL_STATUS, MAX(SM.CATAGORY) AS CATEGORY, MAX(SM.EDUCATION) AS EDUCATION," +
            " MAX(SM.WELLBEING_STATUS) AS WELLBEING, MAX(SM.HABITATION_NAME) AS VILLAGE," +
            " CONVERT(CHAR(10), MAX(SM.REGISTRATION_DATE), 120) AS REGISTERED, MAX(SM.IS_DISABLED) AS IS_DISABLED," +
            " MAX(CASE WHEN LEN(LTRIM(RTRIM(SM.MOBILE_NUM))) >= 4 THEN RIGHT(LTRIM(RTRIM(SM.MOBILE_NUM)), 4) END) AS MOBILE_LAST4" +
            " FROM SHG_MEMBER_INFO SM WITH (NOLOCK)" +
            " WHERE SM.MEMBER_ID = CAST(? AS VARCHAR(40)) AND SM.IS_MEM_ACTIVE = 'Y'" +
            " GROUP BY SM.MEMBER_ID";
        String loans =
            "SELECT 'LOAN' AS ROW_TYPE, L.SHG_MEMBER_LOAN_ACCNO, L.SHG_LOAN_ACCNO, L.PROJECT_TYPE, PT.PROJECT_NAME," +
            " L.PURPOSE, L.LOAN_AMOUNT_ISSUED, L.LOAN_STATUS, CONVERT(CHAR(10), L.ISSUED_DATE, 120) AS ISSUED_DATE" +
            " FROM SHG_MEMBER_MCP_INFO L WITH (NOLOCK)" +
            " LEFT JOIN" + PROJECT_DIM + " PT ON PT.PROJECT_TYPE = L.PROJECT_TYPE" +
            " WHERE L.MEMBER_LONG_CODE = CAST(? AS VARCHAR(40)) AND" + loanQuality("L") +
            " ORDER BY L.ISSUED_DATE";
        String repayments =
            "SELECT TOP 3000 'REPAYMENT' AS ROW_TYPE, SCI.SHG_CREDIT_ID, SCI.SHG_MEMBER_LOAN_ACCNO," +
            " CONVERT(CHAR(10), SCI.REPAYMENT_DATE, 120) AS REPAYMENT_DATE, SCI.REPAID_AMOUNT, SCI.REPAY_STATUS," +
            " SCI.IS_PROCESSED, SCI.Adjust_Type AS ADJUST_TYPE, CONVERT(CHAR(10), SCI.CREDITED_DATE, 120) AS CREDITED_DATE," +
            (PAY_MODES ? " CASE PM.MODE_CODE WHEN 3 THEN 'POS' WHEN 2 THEN 'UPI' WHEN 1 THEN 'AUTO' ELSE 'MANUAL' END" : " CAST(NULL AS VARCHAR(10))") +
            " AS PAY_MODE" +
            " FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)" + PAY_MODE_JOIN +
            " WHERE SCI.SHG_MEMBER_LOAN_ACCNO IN (SELECT L.SHG_MEMBER_LOAN_ACCNO FROM SHG_MEMBER_MCP_INFO L WITH (NOLOCK)" +
            "                                      WHERE L.MEMBER_LONG_CODE = CAST(? AS VARCHAR(40)) AND" + loanQuality("L") + ")" +
            " ORDER BY SCI.REPAYMENT_DATE";
        ArrayList out = new ArrayList();
        out.addAll(query("getMemberDetail.member", member, new Object[] { id }, DRILLDOWN_TIMEOUT_SECONDS));
        out.addAll(query("getMemberDetail.loans", loans, new Object[] { id }, DRILLDOWN_TIMEOUT_SECONDS));
        out.addAll(query("getMemberDetail.repayments", repayments, new Object[] { id }, DRILLDOWN_TIMEOUT_SECONDS));
        return out;
    }

    public ArrayList getShgInfo(String shgId) throws Exception {
        String id = checkKey("shgId", shgId);
        String sql =
            "SELECT SI.TRANS_SHG_ID AS SHG_ID, MAX(SI.SHG_NAME) AS SHG_NAME, MAX(VI.VO_NAME) AS VO_NAME," +
            " CONVERT(CHAR(10), MAX(COALESCE(CAST(SI.SHG_REGISTRATION_DATE AS DATETIME), SI.SHG_REG_DATE)), 120) AS REGISTERED," +
            " MAX(SI.NUMBER_OF_MEMBERS) AS NUMBER_OF_MEMBERS, MAX(SI.SOCIAL_CATEGORY) AS SOCIAL_CATEGORY," +
            " MAX(SI.HQVILLAGE) AS VILLAGE, MAX(SI.WELLBEING_STATUS) AS WELLBEING, MAX(SI.GRADE) AS GRADE," +
            " MAX(SI.BANK_NAME) AS BANK_NAME, MAX(SI.BRANCH_NAME) AS BRANCH_NAME," +
            " MAX(SI.DISABLED) AS DISABLED, MAX(SI.MINORITY) AS MINORITY," +
            " MAX(CASE WHEN LEN(LTRIM(RTRIM(SI.MOBILE_NUM))) >= 4 THEN RIGHT(LTRIM(RTRIM(SI.MOBILE_NUM)), 4) END) AS MOBILE_LAST4" +
            " FROM SHG_INFO SI WITH (NOLOCK)" +
            " LEFT JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'" +
            " WHERE SI.TRANS_SHG_ID = CAST(? AS VARCHAR(40)) AND SI.IS_ACTIVE = 'Y'" +
            " GROUP BY SI.TRANS_SHG_ID";
        return query("getShgInfo", sql, new Object[] { id }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    private static boolean blank(String s) { return s == null || s.trim().length() == 0; }

    public ArrayList getShgMemberLoans(String shgId) throws Exception {
        String id = checkKey("shgId", shgId);
        String sql =
            "SELECT SM.MEMBER_ID, SM.MEMBER_NAME," +
            " L.SHG_MEMBER_LOAN_ACCNO, L.SHG_LOAN_ACCNO, L.PROJECT_TYPE, PT.PROJECT_NAME," +
            " L.PURPOSE, L.LOAN_AMOUNT_ISSUED, L.LOAN_STATUS," +
            " CONVERT(CHAR(10), L.ISSUED_DATE, 120) AS ISSUED_DATE," +
            " R.REPAYMENT_TXN_COUNT, R.REPAID_AMOUNT," +
            " CONVERT(CHAR(10), R.LAST_REPAYMENT_DATE, 120) AS LAST_REPAYMENT_DATE" +
            " FROM (SELECT MEMBER_ID, MAX(MEMBER_NAME) AS MEMBER_NAME" +
            "         FROM SHG_MEMBER_INFO WITH (NOLOCK)" +
            "        WHERE SHG_ID = CAST(? AS VARCHAR(40)) AND IS_MEM_ACTIVE = 'Y'" +
            "        GROUP BY MEMBER_ID) SM" +
            " LEFT JOIN SHG_MEMBER_MCP_INFO L WITH (NOLOCK)" +
            "   ON L.MEMBER_LONG_CODE = SM.MEMBER_ID AND" + loanQuality("L") +
            " LEFT JOIN" + PROJECT_DIM + " PT ON PT.PROJECT_TYPE = L.PROJECT_TYPE" +
            " LEFT JOIN (SELECT SCI.SHG_MEMBER_LOAN_ACCNO," +
            "                   COUNT(*) AS REPAYMENT_TXN_COUNT," +
            "                   SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT," +
            "                   MAX(SCI.REPAYMENT_DATE) AS LAST_REPAYMENT_DATE" +
            "              FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)" +
            "             WHERE SCI.SHG_MEMBER_LOAN_ACCNO IN (" +
            "                   SELECT L2.SHG_MEMBER_LOAN_ACCNO" +
            "                     FROM SHG_MEMBER_MCP_INFO L2 WITH (NOLOCK)" +
            "                    INNER JOIN SHG_MEMBER_INFO SM2 WITH (NOLOCK)" +
            "                       ON SM2.MEMBER_ID = L2.MEMBER_LONG_CODE" +
            "                    WHERE SM2.SHG_ID = CAST(? AS VARCHAR(40)))" +
            "             GROUP BY SCI.SHG_MEMBER_LOAN_ACCNO) R" +
            "   ON R.SHG_MEMBER_LOAN_ACCNO = L.SHG_MEMBER_LOAN_ACCNO" +
            " ORDER BY SM.MEMBER_ID, L.ISSUED_DATE";
        return query("getShgMemberLoans", sql, new Object[] { id, id }, DRILLDOWN_TIMEOUT_SECONDS);
    }

    private Connection getSnbsapConnection() throws Exception {
        return DataSources.connection("snbsap", "SNBSAP_DS");
    }

    private ArrayList query(String method, String sql, Object[] params, int timeoutSeconds)
            throws Exception {
        long start = System.currentTimeMillis();
        Connection        conn = null;
        PreparedStatement ps   = null;
        ResultSet         rs   = null;
        try {
            conn = getSnbsapConnection();
            ps = conn.prepareStatement(sql);
            ps.setQueryTimeout(timeoutSeconds);
            for (int i = 0; i < params.length; i++) {
                Object v = params[i];
                if (v instanceof Timestamp) ps.setTimestamp(i + 1, (Timestamp) v);
                else                        ps.setString(i + 1, (String) v);
            }
            rs = ps.executeQuery();
            ArrayList rows = readRows(rs);
            CeoLog.info("DAO " + method + " rows=" + rows.size()
                    + " ms=" + (System.currentTimeMillis() - start));
            return rows;
        } catch (Exception e) {
            CeoLog.error("DAO " + method + " failed after "
                    + (System.currentTimeMillis() - start) + " ms: " + e.getMessage());
            throw e;
        } finally {
            closeAll(rs, ps, conn);
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

    private static void closeAll(ResultSet rs, PreparedStatement ps, Connection conn) {
        if (rs   != null) { try { rs.close();   } catch (Exception e) {  } }
        if (ps   != null) { try { ps.close();   } catch (Exception e) {  } }
        if (conn != null) { try { conn.close(); } catch (Exception e) {  } }
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
