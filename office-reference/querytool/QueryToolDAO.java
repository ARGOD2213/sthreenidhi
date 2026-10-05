package com.tcs.shg.accounting.DAO;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;
import java.util.ArrayList;

import javax.naming.InitialContext;
import javax.sql.DataSource;

import com.tcs.sgv.common.util.DBConnection;
import com.tcs.shg.util.CommonUtility;
import com.tcs.shg.util.DataAccess;

/*
 * QueryToolDAO.java
 * SERP-AP SQL Query Tool — DAO Layer
 * Two DBs: HRMS (existing DBConnection/JNDI) and SNBSAP (JNDI SNBSAP_DS).
 * Java 6 compatible — no lambdas, no diamond operator.
 * ADDED BY CHINTALA MAHINDRA
 */
public class QueryToolDAO {

    private static final int MAX_DISPLAY_ROWS = 5000;

    /* ══════════════════════════════════════════════════════════════
       TARGET DB CONSTANTS + SNBSAP JNDI CONNECTION
       Datasource SNBSAP_DS must be declared in JBoss *-ds.xml.
       ══════════════════════════════════════════════════════════════ */
    public static final String DB_HRMS   = "HRMS";
    public static final String DB_SNBSAP = "SNBSAP";

    private Connection getSnbsapConnection() throws Exception {
        InitialContext ic = new InitialContext();
        DataSource ds = null;

        /* try 1: web-app scoped */
        try {
            javax.naming.Context env = (javax.naming.Context) ic.lookup("java:comp/env");
            ds = (DataSource) env.lookup("SNBSAP_DS");
        } catch (Exception e1) { /* fall through */ }

        /* try 2: global JBoss name */
        if (ds == null) {
            try { ds = (DataSource) ic.lookup("java:/SNBSAP_DS"); }
            catch (Exception e2) { /* fall through */ }
        }

        /* try 3: bare name */
        if (ds == null) {
            ds = (DataSource) ic.lookup("SNBSAP_DS");
        }
        if (ds == null) {
            throw new Exception("DataSource SNBSAP_DS not found in JNDI. " +
                                "Check that it is declared in the JBoss *-ds.xml.");
        }
        return ds.getConnection();
    }

    /* ══════════════════════════════════════════════════════════════
       AUTHENTICATE USER — always against HRMS (existing flow)
       ══════════════════════════════════════════════════════════════ */
    public ArrayList authenticateUser(String username, String password)
            throws Exception {

        Connection        conn = null;
        PreparedStatement ps   = null;
        ResultSet         rs   = null;

        try {
            conn = DBConnection.getConnection();

            String sql =
                "SELECT USERNAME, FULL_NAME, ROLE, IS_ACTIVE, " +
                "CONVERT(VARCHAR(64), PASSWORD_HASH, 2) AS STORED_HASH, " +
                "CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CAST(? AS VARCHAR(100))), 2) AS TEST_HASH " +
                "FROM QUERY_TOOL_USER_MASTER WHERE USERNAME = ?";

            ps = conn.prepareStatement(sql);
            ps.setString(1, password);
            ps.setString(2, username.trim());
            rs = ps.executeQuery();

            if (!rs.next()) return null;

            int    active     = rs.getInt("IS_ACTIVE");
            String storedHash = rs.getString("STORED_HASH");
            String testHash   = rs.getString("TEST_HASH");

            if (active != 1) return null;
            if (storedHash == null || testHash == null
                    || !storedHash.equalsIgnoreCase(testHash)) return null;

            ArrayList user = new ArrayList();
            user.add(rs.getString("USERNAME"));
            user.add(rs.getString("FULL_NAME"));
            user.add(rs.getString("ROLE"));
            return user;

        } finally {
            closeAll(rs, ps, conn);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       EXECUTE QUERY — HRMS (existing behaviour, unchanged)
       ══════════════════════════════════════════════════════════════ */
    public QueryResult executeQuery(String sql, int timeoutSeconds)
            throws Exception {
        return executeQuery(sql, timeoutSeconds, 0);
    }

    public QueryResult executeQuery(String sql, int timeoutSeconds, int maxRows)
            throws Exception {

        Connection  conn  = null;
        Statement   stmt  = null;
        QueryResult qr    = new QueryResult();
        long        start = System.currentTimeMillis();

        String qtypeForCap = detectQueryType(sql);
        boolean isRowModifying = "INSERT".equals(qtypeForCap)
                || "UPDATE".equals(qtypeForCap)
                || "DELETE".equals(qtypeForCap);

        boolean manageTxn = "INSERT".equals(qtypeForCap)
                || "UPDATE".equals(qtypeForCap)
                || "DELETE".equals(qtypeForCap)
                || "ALTER".equals(qtypeForCap)
                || "DROP".equals(qtypeForCap)
                || "TRUNCATE".equals(qtypeForCap);

        try {
            conn = DBConnection.getConnection();
            if (manageTxn) conn.setAutoCommit(false);

            stmt = conn.createStatement();
            stmt.setQueryTimeout(timeoutSeconds);
            if (maxRows > 0 && !isRowModifying) stmt.setMaxRows(maxRows + 1);

            boolean hasResultSet = stmt.execute(sql);
            qr.executionTimeMs   = System.currentTimeMillis() - start;
            qr.queryType         = qtypeForCap;

            int rsIndex = 1;
            do {
                if (hasResultSet) {
                    ResultSet     rs  = stmt.getResultSet();
                    ResultSetData rsd = buildResultSetData(rs, rsIndex, maxRows);
                    qr.resultSets.add(rsd);
                    rsIndex++;
                    rs.close();
                } else {
                    int uc = stmt.getUpdateCount();
                    if (uc >= 0) qr.rowsAffected += uc;
                }
                try { hasResultSet = stmt.getMoreResults(); } catch (Exception e) { break; }
            } while (hasResultSet || stmt.getUpdateCount() != -1);

            if (manageTxn) conn.commit();
            qr.status = "SUCCESS";

        } catch (Exception e) {
            if (manageTxn) rollbackQuietly(conn);
            qr.status          = "ERROR";
            qr.errorMessage    = e.getMessage() != null ? e.getMessage() : "Unknown error";
            qr.executionTimeMs = System.currentTimeMillis() - start;
            throw e;
        } finally {
            closeAll(null, stmt, conn);
        }
        return qr;
    }

    /* ══════════════════════════════════════════════════════════════
       EXECUTE QUERY — with target DB routing
       target == SNBSAP -> JNDI SNBSAP_DS
       anything else    -> existing HRMS flow above
       ══════════════════════════════════════════════════════════════ */
    public QueryResult executeQuery(String sql, int timeoutSeconds, int maxRows, String target)
            throws Exception {
        if (DB_SNBSAP.equalsIgnoreCase(target)) {
            return executeOnSnbsap(sql, timeoutSeconds, maxRows);
        }
        return executeQuery(sql, timeoutSeconds, maxRows);
    }

    private QueryResult executeOnSnbsap(String sql, int timeoutSeconds, int maxRows)
            throws Exception {

        Connection  conn  = null;
        Statement   stmt  = null;
        QueryResult qr    = new QueryResult();
        long        start = System.currentTimeMillis();

        try {
            conn = getSnbsapConnection();
            conn.setAutoCommit(true);

            stmt = conn.createStatement();
            stmt.setQueryTimeout(timeoutSeconds);
            if (maxRows > 0) stmt.setMaxRows(maxRows + 1);

            boolean hasResultSet = stmt.execute(sql);
            qr.queryType         = detectQueryType(sql);

            int rsIndex = 1;
            do {
                if (hasResultSet) {
                    ResultSet     rs  = stmt.getResultSet();
                    ResultSetData rsd = buildResultSetData(rs, rsIndex, maxRows);
                    qr.resultSets.add(rsd);
                    rsIndex++;
                    rs.close();
                } else {
                    int uc = stmt.getUpdateCount();
                    if (uc >= 0) qr.rowsAffected += uc;
                }
                try { hasResultSet = stmt.getMoreResults(); } catch (Exception e) { break; }
            } while (hasResultSet || stmt.getUpdateCount() != -1);

            qr.status          = "SUCCESS";
            qr.executionTimeMs = System.currentTimeMillis() - start;
            return qr;

        } catch (Exception e) {
            qr.status          = "ERROR";
            qr.errorMessage    = e.getMessage() != null ? e.getMessage() : "Unknown error";
            qr.executionTimeMs = System.currentTimeMillis() - start;
            throw e;
        } finally {
            closeAll(null, stmt, conn);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       PREVIEW / COUNT — HRMS only (admin confirm popups)
       ══════════════════════════════════════════════════════════════ */
    public ResultSetData previewAffectedRows(String sql, int limit) throws Exception {
        Connection        conn = null;
        PreparedStatement ps   = null;
        ResultSet         rs   = null;
        try {
            conn = DBConnection.getConnection();
            String previewSql = buildPreviewSql(sql, limit);
            ps = conn.prepareStatement(previewSql);
            ps.setQueryTimeout(30);
            rs = ps.executeQuery();
            return buildResultSetData(rs, 1, 0);
        } finally {
            closeAll(rs, ps, conn);
        }
    }

    public int countAffectedRows(String sql) throws Exception {
        Connection        conn = null;
        PreparedStatement ps   = null;
        ResultSet         rs   = null;
        try {
            conn = DBConnection.getConnection();
            String countSql = buildCountSql(sql);
            ps = conn.prepareStatement(countSql);
            ps.setQueryTimeout(30);
            rs = ps.executeQuery();
            if (rs.next()) return rs.getInt(1);
            return 0;
        } finally {
            closeAll(rs, ps, conn);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       AUDIT
       ══════════════════════════════════════════════════════════════ */
    public void insertAudit(AuditEntry ae) throws Exception {
        Connection        conn = null;
        PreparedStatement ps   = null;
        try {
            conn = DBConnection.getConnection();
            String sql =
                "INSERT INTO QUERY_TOOL_AUDIT " +
                "(USERNAME, QUERY_TYPE, QUERY_TEXT, FORWARDED_IP, PROXY_IP, WL_PROXY_IP, " +
                " REMOTE_IP, REMOTE_HOST, USER_AGENT, SESSION_ID, ROWS_AFFECTED, " +
                " EXECUTION_TIME_MS, STATUS, EXECUTED_ON) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,GETDATE())";
            ps = conn.prepareStatement(sql);
            ps.setString(1,  ae.username);
            ps.setString(2,  ae.queryType);
            ps.setString(3,  safeTrunc(ae.queryText, 4000));
            ps.setString(4,  ae.forwardedIp);
            ps.setString(5,  ae.proxyIp);
            ps.setString(6,  ae.wlProxyIp);
            ps.setString(7,  ae.remoteIp);
            ps.setString(8,  ae.remoteHost);
            ps.setString(9,  safeTrunc(ae.userAgent, 500));
            ps.setString(10, ae.sessionId);
            ps.setInt(11,    ae.rowsAffected);
            ps.setLong(12,   ae.executionTimeMs);
            ps.setString(13, ae.status);
            ps.executeUpdate();
        } finally {
            closeAll(null, ps, conn);
        }
    }

    public ArrayList getAuditReport(String fromDate, String toDate,
                                    String username, String opType, String ip)
            throws Exception {
        Connection        conn   = null;
        PreparedStatement ps     = null;
        ResultSet         rs     = null;
        ArrayList         result = new ArrayList();

        try {
            conn = DBConnection.getConnection();
            StringBuffer sb = new StringBuffer();
            sb.append("SELECT ID, USERNAME, QUERY_TYPE, QUERY_TEXT, ");
            sb.append("FORWARDED_IP, REMOTE_IP, USER_AGENT, SESSION_ID, ");
            sb.append("ROWS_AFFECTED, EXECUTION_TIME_MS, STATUS, EXECUTED_ON ");
            sb.append("FROM QUERY_TOOL_AUDIT WHERE 1=1 ");

            ArrayList params = new ArrayList();
            if (fromDate != null && fromDate.trim().length() > 0) {
                sb.append("AND CAST(EXECUTED_ON AS DATE) >= ? "); params.add(fromDate.trim());
            }
            if (toDate != null && toDate.trim().length() > 0) {
                sb.append("AND CAST(EXECUTED_ON AS DATE) <= ? "); params.add(toDate.trim());
            }
            if (username != null && username.trim().length() > 0) {
                sb.append("AND USERNAME = ? "); params.add(username.trim());
            }
            if (opType != null && opType.trim().length() > 0) {
                sb.append("AND QUERY_TYPE = ? "); params.add(opType.trim());
            }
            if (ip != null && ip.trim().length() > 0) {
                sb.append("AND (FORWARDED_IP LIKE ? OR REMOTE_IP LIKE ?) ");
                params.add("%" + ip.trim() + "%");
                params.add("%" + ip.trim() + "%");
            }
            sb.append("ORDER BY EXECUTED_ON DESC");

            ps = conn.prepareStatement(sb.toString());
            for (int i = 0; i < params.size(); i++) ps.setString(i + 1, (String) params.get(i));
            rs = ps.executeQuery();
            while (rs.next()) {
                ArrayList row = new ArrayList();
                row.add(safeGetStr(rs, "ID"));
                row.add(safeGetStr(rs, "USERNAME"));
                row.add(safeGetStr(rs, "QUERY_TYPE"));
                row.add(safeGetStr(rs, "QUERY_TEXT"));
                row.add(safeGetStr(rs, "FORWARDED_IP"));
                row.add(safeGetStr(rs, "REMOTE_IP"));
                row.add(safeGetStr(rs, "USER_AGENT"));
                row.add(safeGetStr(rs, "SESSION_ID"));
                row.add(safeGetStr(rs, "ROWS_AFFECTED"));
                row.add(safeGetStr(rs, "EXECUTION_TIME_MS"));
                row.add(safeGetStr(rs, "STATUS"));
                row.add(safeGetStr(rs, "EXECUTED_ON"));
                result.add(row);
            }
        } finally {
            closeAll(rs, ps, conn);
        }
        return result;
    }

    /* ══════════════════════════════════════════════════════════════
       HISTORY
       ══════════════════════════════════════════════════════════════ */
    public void saveQueryHistory(String username, String queryText) throws Exception {
        Connection        conn = null;
        PreparedStatement ps   = null;
        try {
            conn = DBConnection.getConnection();
            String del =
                "DELETE FROM QUERY_TOOL_HISTORY WHERE USERNAME = ? " +
                "AND ID NOT IN (" +
                "  SELECT TOP 49 ID FROM QUERY_TOOL_HISTORY " +
                "  WHERE USERNAME = ? ORDER BY EXECUTED_ON DESC" +
                ")";
            ps = conn.prepareStatement(del);
            ps.setString(1, username);
            ps.setString(2, username);
            ps.executeUpdate();
            ps.close();
            ps = null;

            String ins =
                "INSERT INTO QUERY_TOOL_HISTORY (USERNAME, QUERY_TEXT, EXECUTED_ON) " +
                "VALUES (?, ?, GETDATE())";
            ps = conn.prepareStatement(ins);
            ps.setString(1, username);
            ps.setString(2, safeTrunc(queryText, 4000));
            ps.executeUpdate();
        } finally {
            closeAll(null, ps, conn);
        }
    }

    public ArrayList getQueryHistory(String username) throws Exception {
        Connection        conn   = null;
        PreparedStatement ps     = null;
        ResultSet         rs     = null;
        ArrayList         result = new ArrayList();
        try {
            conn = DBConnection.getConnection();
            String sql =
                "SELECT TOP 50 ID, QUERY_TEXT, EXECUTED_ON " +
                "FROM QUERY_TOOL_HISTORY WHERE USERNAME = ? " +
                "ORDER BY EXECUTED_ON DESC";
            ps = conn.prepareStatement(sql);
            ps.setString(1, username);
            rs = ps.executeQuery();
            while (rs.next()) {
                ArrayList row = new ArrayList();
                row.add(safeGetStr(rs, "ID"));
                row.add(safeGetStr(rs, "QUERY_TEXT"));
                row.add(safeGetStr(rs, "EXECUTED_ON"));
                result.add(row);
            }
        } finally {
            closeAll(rs, ps, conn);
        }
        return result;
    }

    /* ══════════════════════════════════════════════════════════════
       FAVORITES
       ══════════════════════════════════════════════════════════════ */
    public void saveFavorite(String username, String favoriteName, String queryText)
            throws Exception {
        Connection        conn = null;
        PreparedStatement ps   = null;
        try {
            conn = DBConnection.getConnection();
            String ins =
                "INSERT INTO QUERY_TOOL_FAVORITES (USERNAME, FAVORITE_NAME, QUERY_TEXT, CREATED_ON) " +
                "VALUES (?, ?, ?, GETDATE())";
            ps = conn.prepareStatement(ins);
            ps.setString(1, username);
            ps.setString(2, safeTrunc(favoriteName, 200));
            ps.setString(3, safeTrunc(queryText, 4000));
            ps.executeUpdate();
        } finally {
            closeAll(null, ps, conn);
        }
    }

    public ArrayList getFavorites(String username) throws Exception {
        Connection        conn   = null;
        PreparedStatement ps     = null;
        ResultSet         rs     = null;
        ArrayList         result = new ArrayList();
        try {
            conn = DBConnection.getConnection();
            String sql =
                "SELECT ID, FAVORITE_NAME, QUERY_TEXT, CREATED_ON " +
                "FROM QUERY_TOOL_FAVORITES WHERE USERNAME = ? " +
                "ORDER BY FAVORITE_NAME ASC";
            ps = conn.prepareStatement(sql);
            ps.setString(1, username);
            rs = ps.executeQuery();
            while (rs.next()) {
                ArrayList row = new ArrayList();
                row.add(safeGetStr(rs, "ID"));
                row.add(safeGetStr(rs, "FAVORITE_NAME"));
                row.add(safeGetStr(rs, "QUERY_TEXT"));
                row.add(safeGetStr(rs, "CREATED_ON"));
                result.add(row);
            }
        } finally {
            closeAll(rs, ps, conn);
        }
        return result;
    }

    public void deleteFavorite(String username, String favoriteId) throws Exception {
        Connection        conn = null;
        PreparedStatement ps   = null;
        try {
            conn = DBConnection.getConnection();
            String sql = "DELETE FROM QUERY_TOOL_FAVORITES WHERE ID = ? AND USERNAME = ?";
            ps = conn.prepareStatement(sql);
            ps.setString(1, favoriteId);
            ps.setString(2, username);
            ps.executeUpdate();
        } finally {
            closeAll(null, ps, conn);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       DETECT QUERY TYPE
       ══════════════════════════════════════════════════════════════ */
    public String detectQueryType(String sql) {
        if (sql == null || sql.trim().length() == 0) return "UNKNOWN";
        String trimmed = sql.trim().toUpperCase();
        while (trimmed.startsWith("--")) {
            int nl = trimmed.indexOf('\n');
            trimmed = (nl >= 0) ? trimmed.substring(nl + 1).trim() : "";
        }
        while (trimmed.startsWith("/*")) {
            int end = trimmed.indexOf("*/");
            trimmed = (end >= 0) ? trimmed.substring(end + 2).trim() : "";
        }
        String forHelpCheck = trimmed;
        if (forHelpCheck.startsWith("EXEC "))         forHelpCheck = forHelpCheck.substring(5).trim();
        else if (forHelpCheck.startsWith("EXECUTE ")) forHelpCheck = forHelpCheck.substring(8).trim();
        if (forHelpCheck.startsWith("SP_HELP")) return "SELECT";

        if (trimmed.startsWith("SELECT"))   return "SELECT";
        if (trimmed.startsWith("WITH"))     return "SELECT";
        if (trimmed.startsWith("INSERT"))   return "INSERT";
        if (trimmed.startsWith("UPDATE"))   return "UPDATE";
        if (trimmed.startsWith("DELETE"))   return "DELETE";
        if (trimmed.startsWith("EXEC"))     return "EXEC";
        if (trimmed.startsWith("ALTER"))    return "ALTER";
        if (trimmed.startsWith("DROP"))     return "DROP";
        if (trimmed.startsWith("TRUNCATE")) return "TRUNCATE";
        return "OTHER";
    }

    /* ══════════════════════════════════════════════════════════════
       EXTRACT TABLE NAME
       ══════════════════════════════════════════════════════════════ */
    public String extractTableName(String sql) {
        if (sql == null) return "";
        String up = sql.trim().toUpperCase();
        try {
            if (up.startsWith("UPDATE")) {
                String[] parts = sql.trim().substring(6).trim().split("\\s+");
                return parts.length > 0 ? parts[0] : "";
            }
            if (up.startsWith("DELETE")) {
                int fromIdx = up.indexOf("FROM");
                if (fromIdx >= 0) {
                    String[] parts = sql.trim().substring(fromIdx + 4).trim().split("\\s+");
                    return parts.length > 0 ? parts[0] : "";
                }
            }
            if (up.startsWith("INSERT")) {
                int intoIdx = up.indexOf("INTO");
                if (intoIdx >= 0) {
                    String[] parts = sql.trim().substring(intoIdx + 4).trim().split("\\s+|\\(");
                    return parts.length > 0 ? parts[0] : "";
                }
            }
            if (up.startsWith("DROP")) {
                String[] parts = sql.trim().split("\\s+");
                return parts.length > 2 ? parts[2] : "";
            }
            if (up.startsWith("TRUNCATE")) {
                int tIdx = up.indexOf("TABLE");
                String after = tIdx >= 0 ? sql.trim().substring(tIdx + 5).trim()
                                         : sql.trim().substring(8).trim();
                String[] parts = after.split("\\s+");
                return parts.length > 0 ? parts[0] : "";
            }
        } catch (Exception e) { /* ignore */ }
        return "";
    }

    /* ══════════════════════════════════════════════════════════════
       PRIVATE HELPERS
       ══════════════════════════════════════════════════════════════ */
    private ResultSetData buildResultSetData(ResultSet rs, int index, int maxRows)
            throws Exception {
        ResultSetData     rsd  = new ResultSetData();
        ResultSetMetaData meta = rs.getMetaData();
        int colCount = meta.getColumnCount();
        rsd.index = index;
        for (int c = 1; c <= colCount; c++) rsd.columns.add(meta.getColumnLabel(c));
        while (rs.next()) {
            if (maxRows > 0 && rsd.rowCount >= maxRows) { rsd.truncated = true; break; }
            ArrayList row = new ArrayList();
            for (int c = 1; c <= colCount; c++) {
                Object val = rs.getObject(c);
                row.add(val != null ? val.toString() : "");
            }
            rsd.rows.add(row);
            rsd.rowCount++;
        }
        return rsd;
    }

    private String buildPreviewSql(String sql, int limit) {
        String up    = sql.trim().toUpperCase();
        String table = extractTableName(sql);
        if (up.startsWith("UPDATE")) {
            int idx = up.indexOf(" WHERE ");
            if (idx >= 0) return "SELECT TOP " + limit + " * FROM " + table + " WITH (NOLOCK) " + sql.substring(idx);
            return "SELECT TOP " + limit + " * FROM " + table + " WITH (NOLOCK)";
        }
        if (up.startsWith("DELETE")) {
            int idx = up.indexOf(" WHERE ");
            if (idx >= 0) return "SELECT TOP " + limit + " * FROM " + table + " WITH (NOLOCK) " + sql.substring(idx);
            return "SELECT TOP " + limit + " * FROM " + table + " WITH (NOLOCK)";
        }
        return "SELECT TOP " + limit + " 1 AS PREVIEW_PLACEHOLDER";
    }

    private String buildCountSql(String sql) {
        String up    = sql.trim().toUpperCase();
        String table = extractTableName(sql);
        if (up.startsWith("UPDATE")) {
            int idx = up.indexOf(" WHERE ");
            if (idx >= 0) return "SELECT COUNT(*) FROM " + table + " WITH (NOLOCK) " + sql.substring(idx);
            return "SELECT COUNT(*) FROM " + table + " WITH (NOLOCK)";
        }
        if (up.startsWith("DELETE")) {
            int idx = up.indexOf(" WHERE ");
            if (idx >= 0) return "SELECT COUNT(*) FROM " + table + " WITH (NOLOCK) " + sql.substring(idx);
            return "SELECT COUNT(*) FROM " + table + " WITH (NOLOCK)";
        }
        return "SELECT 0";
    }

    private void rollbackQuietly(Connection conn) {
        if (conn != null) { try { conn.rollback(); } catch (Exception e) { /* ignore */ } }
    }

    private void closeAll(ResultSet rs, java.sql.Statement stmt, Connection conn) {
        if (rs   != null) { try { rs.close();   } catch (Exception e) { /* ignore */ } }
        if (stmt != null) { try { stmt.close(); } catch (Exception e) { /* ignore */ } }
        if (conn != null) { try { conn.close(); } catch (Exception e) { /* ignore */ } }
    }

    private String safeGetStr(ResultSet rs, String col) {
        try {
            Object o = rs.getObject(col);
            return o != null ? o.toString() : "";
        } catch (Exception e) { return ""; }
    }

    private String safeTrunc(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) : s;
    }

    /* ══════════════════════════════════════════════════════════════
       INNER DATA CLASSES
       ══════════════════════════════════════════════════════════════ */
    public static class QueryResult {
        public String    queryType       = "";
        public String    status          = "";
        public String    errorMessage    = "";
        public int       rowsAffected    = 0;
        public long      executionTimeMs = 0;
        public ArrayList resultSets      = new ArrayList();
    }

    public static class ResultSetData {
        public int       index     = 1;
        public ArrayList columns   = new ArrayList();
        public ArrayList rows      = new ArrayList();
        public int       rowCount  = 0;
        public boolean   truncated = false;
    }

    public static class AuditEntry {
        public String username        = "";
        public String queryType       = "";
        public String queryText       = "";
        public String forwardedIp     = "";
        public String proxyIp         = "";
        public String wlProxyIp       = "";
        public String remoteIp        = "";
        public String remoteHost      = "";
        public String userAgent       = "";
        public String sessionId       = "";
        public int    rowsAffected    = 0;
        public long   executionTimeMs = 0;
        public String status          = "";
    }
}