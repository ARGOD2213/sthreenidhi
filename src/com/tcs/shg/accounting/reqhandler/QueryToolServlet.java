package com.tcs.shg.accounting.reqhandler;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import org.apache.poi.hssf.usermodel.HSSFCell;
import org.apache.poi.hssf.usermodel.HSSFCellStyle;
import org.apache.poi.hssf.usermodel.HSSFFont;
import org.apache.poi.hssf.usermodel.HSSFRow;
import org.apache.poi.hssf.usermodel.HSSFSheet;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.hssf.util.HSSFColor;
import org.apache.poi.ss.util.CellRangeAddress;

import com.tcs.shg.accounting.DAO.QueryToolDAO;
import com.tcs.shg.accounting.DAO.QueryToolDAO.AuditEntry;
import com.tcs.shg.accounting.DAO.QueryToolDAO.QueryResult;
import com.tcs.shg.accounting.DAO.QueryToolDAO.ResultSetData;
import com.tcs.shg.util.CommonUtility;

/*
 * QueryToolServlet.java
 * SERP-AP Secure SQL Query Tool — Servlet
 * Two DBs: HRMS (default) and SNBSAP, selected via 'target' param.
 * Java 6 compatible.
 * ADDED BY CHINTALA MAHINDRA
 */
public class QueryToolServlet extends HttpServlet {

    private static final String JSP_TOOL  = "/reports/QueryTool.jsp";
    private static final String JSP_AUDIT = "/reports/QueryToolAudit.jsp";
    private static final String SESSION_KEY = "QT_USER";
    private static final int    DEFAULT_TIMEOUT = 300;

    private static final String STAGE_KEY = "QT_STAGED_QUERIES";
    private static final int    MAX_STAGED_QUERIES = 30;

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String AUDIT_NAV_TOKEN_KEY = "QT_AUDIT_NAV_TOKEN";
    private static final int    MAX_EXPORT_ROWS = 200000;

    private static final char[] B64_CHARS =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();

    private QueryToolDAO dao = new QueryToolDAO();

    /* ════════════════════════════════════════════════════════════ */
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doPost(request, response);
    }

    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String action = CommonUtility.checkNullObj(request.getParameter("action"));

        if ("login".equals(action)) { handleLogin(request, response); return; }

        if ("logout".equals(action)) {
            HttpSession sess = request.getSession(false);
            if (sess != null) sess.invalidate();
            response.sendRedirect(request.getContextPath() + "/QueryTool");
            return;
        }

        if (action.length() == 0 || "page".equals(action)) {
            forwardToJsp(request, response, JSP_TOOL);
            return;
        }

        if ("audit".equals(action)) {
            if (!isAdmin(request) || !validAuditNavToken(request)) {
                response.sendRedirect(request.getContextPath() + "/QueryTool");
                return;
            }
            handleAuditPage(request, response);
            return;
        }

        if ("auditExcel".equals(action)) {
            if (!isAdmin(request) || !validAuditNavToken(request)) {
                response.sendRedirect(request.getContextPath() + "/QueryTool");
                return;
            }
            handleAuditExcel(request, response);
            return;
        }

        if ("stage".equals(action)
                || "execute".equals(action)
                || "preview".equals(action)
                || "history".equals(action)
                || "favoriteSave".equals(action)
                || "favoriteList".equals(action)
                || "favoriteDelete".equals(action)) {

            if (!isLoggedIn(request)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                writeJson(response,
                    "{\"status\":\"error\",\"message\":\"Session expired. Please login again.\"}");
                return;
            }

            if ("stage".equals(action))          { handleStage(request, response);          return; }
            if ("execute".equals(action))        { handleExecute(request, response);        return; }
            if ("preview".equals(action))        { handlePreview(request, response);        return; }
            if ("history".equals(action))        { handleHistory(request, response);        return; }
            if ("favoriteSave".equals(action))   { handleFavoriteSave(request, response);   return; }
            if ("favoriteList".equals(action))   { handleFavoriteList(request, response);   return; }
            if ("favoriteDelete".equals(action)) { handleFavoriteDelete(request, response); return; }
        }

        if ("exportExcel".equals(action)) {
            if (!isLoggedIn(request)) { response.sendRedirect(request.getContextPath() + "/QueryTool"); return; }
            handleExportExcel(request, response);
            return;
        }
        if ("exportCsv".equals(action)) {
            if (!isLoggedIn(request)) { response.sendRedirect(request.getContextPath() + "/QueryTool"); return; }
            handleExportCsv(request, response);
            return;
        }

        forwardToJsp(request, response, JSP_TOOL);
    }

    /* ════════════════════════════════════════════════════════════
       LOGIN
       ════════════════════════════════════════════════════════════ */
    private void handleLogin(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String username = CommonUtility.checkNullObj(request.getParameter("username"));
        String password = CommonUtility.checkNullObj(request.getParameter("password"));
        try {
            ArrayList user = dao.authenticateUser(username.trim(), password);
            if (user != null) {
                HttpSession session = request.getSession(true);
                session.setAttribute(SESSION_KEY, user);
                session.setMaxInactiveInterval(3600);
                writeJson(response, "{\"status\":\"ok\"}");
            } else {
                writeJson(response, "{\"status\":\"fail\",\"message\":\"Invalid credentials or account not active.\"}");
            }
        } catch (Exception e) {
            e.printStackTrace();
            writeJson(response, "{\"status\":\"error\",\"message\":\"" + escJson(e.getMessage()) + "\"}");
        }
    }

    /* ════════════════════════════════════════════════════════════
       TARGET DB — reads 'target' param, default HRMS
       ════════════════════════════════════════════════════════════ */
    private String getDbTarget(HttpServletRequest request) {
        String t = CommonUtility.checkNullObj(request.getParameter("target")).trim();
        if (QueryToolDAO.DB_SNBSAP.equalsIgnoreCase(t)) return QueryToolDAO.DB_SNBSAP;
        return QueryToolDAO.DB_HRMS;
    }

    /* ════════════════════════════════════════════════════════════
       STAGING
       ════════════════════════════════════════════════════════════ */
    @SuppressWarnings("unchecked")
    private java.util.LinkedHashMap getStagedMap(HttpServletRequest request) {
        HttpSession session = request.getSession(true);
        java.util.LinkedHashMap map =
            (java.util.LinkedHashMap) session.getAttribute(STAGE_KEY);
        if (map == null) {
            map = new java.util.LinkedHashMap();
            session.setAttribute(STAGE_KEY, map);
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    private void trimStagedMap(java.util.LinkedHashMap map) {
        while (map.size() > MAX_STAGED_QUERIES) {
            java.util.Iterator it = map.keySet().iterator();
            if (!it.hasNext()) break;
            it.next(); it.remove();
        }
    }

    private void handleStage(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String encSql = CommonUtility.checkNullObj(request.getParameter("sql"));
        if (encSql.trim().length() == 0) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Empty query.\"}");
            return;
        }
        String sql;
        try { sql = new String(base64Decode(encSql), "UTF-8"); }
        catch (Exception e) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Failed to decode query.\"}");
            return;
        }
        if (sql.trim().length() == 0) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Empty query.\"}");
            return;
        }
        String queryId = "q_" + System.currentTimeMillis()
                        + "_" + Integer.toHexString((int) (Math.random() * 0xFFFFFF));
        java.util.LinkedHashMap map = getStagedMap(request);
        map.put(queryId, sql);
        trimStagedMap(map);
        writeJson(response, "{\"status\":\"ok\",\"queryId\":\"" + queryId + "\"}");
    }

    private String resolveSql(HttpServletRequest request) {
        String queryId = CommonUtility.checkNullObj(request.getParameter("queryId"));
        if (queryId.trim().length() > 0) {
            Object staged = getStagedMap(request).get(queryId.trim());
            if (staged != null) return (String) staged;
        }
        return CommonUtility.checkNullObj(request.getParameter("sql"));
    }

    private byte[] base64Decode(String s) throws Exception {
        String clean = s.trim().replaceAll("\\s", "");
        int padding = 0;
        if (clean.endsWith("=="))      padding = 2;
        else if (clean.endsWith("="))  padding = 1;

        int len = clean.length();
        if (len == 0) return new byte[0];

        int[] lookup = new int[128];
        for (int i = 0; i < lookup.length; i++) lookup[i] = -1;
        for (int i = 0; i < B64_CHARS.length; i++) lookup[B64_CHARS[i]] = i;

        int outLen = (len / 4) * 3 - padding;
        if (outLen < 0) outLen = 0;
        byte[] out = new byte[outLen];

        int outPos = 0;
        for (int i = 0; i < len; i += 4) {
            int c0 = clean.charAt(i);
            int c1 = (i + 1 < len) ? clean.charAt(i + 1) : '=';
            int c2 = (i + 2 < len) ? clean.charAt(i + 2) : '=';
            int c3 = (i + 3 < len) ? clean.charAt(i + 3) : '=';
            int b0 = (c0 == '=') ? 0 : lookup[c0];
            int b1 = (c1 == '=') ? 0 : lookup[c1];
            int b2 = (c2 == '=') ? 0 : lookup[c2];
            int b3 = (c3 == '=') ? 0 : lookup[c3];
            int triple = (b0 << 18) | (b1 << 12) | (b2 << 6) | b3;
            if (outPos < outLen) out[outPos++] = (byte) ((triple >> 16) & 0xFF);
            if (c2 != '=' && outPos < outLen) out[outPos++] = (byte) ((triple >> 8) & 0xFF);
            if (c3 != '=' && outPos < outLen) out[outPos++] = (byte) (triple & 0xFF);
        }
        return out;
    }

    /* ════════════════════════════════════════════════════════════
       ROLE / ACCESS CONTROL
       ════════════════════════════════════════════════════════════ */
    private String getLoggedInRole(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return "";
        ArrayList user = (ArrayList) session.getAttribute(SESSION_KEY);
        if (user == null || user.size() < 3) return "";
        Object role = user.get(2);
        return role != null ? role.toString().trim() : "";
    }

    private boolean isAdmin(HttpServletRequest request) {
        return ROLE_ADMIN.equalsIgnoreCase(getLoggedInRole(request));
    }

    private boolean isViewerAllowedQtype(String qtype) {
        return "SELECT".equals(qtype);
    }

    private boolean validAuditNavToken(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return false;
        Object stored = session.getAttribute(AUDIT_NAV_TOKEN_KEY);
        String provided = CommonUtility.checkNullObj(request.getParameter("navToken"));
        if (stored == null || provided.trim().length() == 0) return false;
        return stored.toString().equals(provided.trim());
    }

    /* ════════════════════════════════════════════════════════════
       EXECUTE QUERY
       ════════════════════════════════════════════════════════════ */
    private void handleExecute(HttpServletRequest request, HttpServletResponse response)
            throws IOException {

        String sql      = resolveSql(request);
        String timeoutP = CommonUtility.checkNullObj(request.getParameter("timeout"));
        String username = getLoggedInUsername(request);

        if (sql.trim().length() == 0) {
            QueryResult emptyResult = new QueryResult();
            emptyResult.status       = "ERROR";
            emptyResult.errorMessage = "Empty query.";
            writeJson(response, serializeQueryResult(emptyResult));
            return;
        }

        int timeout = DEFAULT_TIMEOUT;
        try { timeout = Integer.parseInt(timeoutP.trim()); } catch (Exception e) { /* default */ }

        String qtype = dao.detectQueryType(sql);

        if (!isAdmin(request) && !isViewerAllowedQtype(qtype)) {
            QueryResult denied = new QueryResult();
            denied.status = "ERROR";
            denied.queryType = qtype;
            denied.errorMessage = "Your account has read-only access. Only SELECT queries are permitted.";
            writeJson(response, serializeQueryResult(denied));
            return;
        }

        long start = System.currentTimeMillis();

        try {
            QueryResult qr = dao.executeQuery(sql, timeout, 0, getDbTarget(request));

            try { dao.saveQueryHistory(username, sql); }
            catch (Exception e) { System.out.println("=== QueryTool history save warning: " + e.getMessage()); }

            if (isDmlOrDdl(qtype)) {
                AuditEntry ae = buildAuditEntry(request, username, qtype, sql, qr);
                try { dao.insertAudit(ae); }
                catch (Exception e) { System.out.println("=== QueryTool audit warning: " + e.getMessage()); }
            }

            writeJson(response, serializeQueryResult(qr));

        } catch (Exception e) {
            QueryResult errResult = new QueryResult();
            errResult.status          = "ERROR";
            errResult.queryType       = qtype;
            errResult.errorMessage    = e.getMessage() != null ? e.getMessage() : "Unknown error";
            errResult.executionTimeMs = System.currentTimeMillis() - start;

            if (isDmlOrDdl(qtype)) {
                AuditEntry ae = buildAuditEntry(request, username, qtype, sql, errResult);
                try { dao.insertAudit(ae); } catch (Exception ex) { /* ignore */ }
            }
            writeJson(response, serializeQueryResult(errResult));
        }
    }

    /* ════════════════════════════════════════════════════════════
       PREVIEW — HRMS only (admin confirm popups)
       ════════════════════════════════════════════════════════════ */
    private void handlePreview(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String sql   = resolveSql(request);
        String qtype = dao.detectQueryType(sql);
        if (!isAdmin(request) && !isViewerAllowedQtype(qtype)) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Your account has read-only access.\"}");
            return;
        }
        try {
            int           count   = dao.countAffectedRows(sql);
            ResultSetData preview = dao.previewAffectedRows(sql, 5);
            String        table   = dao.extractTableName(sql);
            StringBuffer sb = new StringBuffer();
            sb.append("{");
            sb.append("\"status\":\"ok\",");
            sb.append("\"table\":\"").append(escJson(table)).append("\",");
            sb.append("\"count\":").append(count).append(",");
            sb.append("\"preview\":").append(serializeResultSetData(preview));
            sb.append("}");
            writeJson(response, sb.toString());
        } catch (Exception e) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"" + escJson(e.getMessage()) + "\"}");
        }
    }

    /* ════════════════════════════════════════════════════════════
       HISTORY
       ════════════════════════════════════════════════════════════ */
    private void handleHistory(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String username = getLoggedInUsername(request);
        try {
            ArrayList history = dao.getQueryHistory(username);
            StringBuffer sb = new StringBuffer("[");
            for (int i = 0; i < history.size(); i++) {
                ArrayList row = (ArrayList) history.get(i);
                if (i > 0) sb.append(",");
                sb.append("{");
                sb.append("\"id\":\""  + escJson((String) row.get(0)) + "\",");
                sb.append("\"sql\":\"" + escJson((String) row.get(1)) + "\",");
                sb.append("\"ts\":\""  + escJson((String) row.get(2)) + "\"");
                sb.append("}");
            }
            sb.append("]");
            writeJson(response, sb.toString());
        } catch (Exception e) { writeJson(response, "[]"); }
    }

    /* ════════════════════════════════════════════════════════════
       FAVORITES
       ════════════════════════════════════════════════════════════ */
    private void handleFavoriteSave(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String encSql   = CommonUtility.checkNullObj(request.getParameter("sql"));
        String name     = CommonUtility.checkNullObj(request.getParameter("name"));
        String username = getLoggedInUsername(request);

        if (encSql.trim().length() == 0 || name.trim().length() == 0) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Name and query are required.\"}");
            return;
        }
        String sql;
        try { sql = new String(base64Decode(encSql), "UTF-8"); }
        catch (Exception e) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Failed to decode query.\"}");
            return;
        }
        String qtype = dao.detectQueryType(sql);
        if (!isAdmin(request) && !isViewerAllowedQtype(qtype)) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Your account has read-only access.\"}");
            return;
        }
        try {
            dao.saveFavorite(username, name, sql);
            writeJson(response, "{\"status\":\"ok\"}");
        } catch (Exception e) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"" + escJson(e.getMessage()) + "\"}");
        }
    }

    private void handleFavoriteList(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String username = getLoggedInUsername(request);
        try {
            ArrayList favorites = dao.getFavorites(username);
            StringBuffer sb = new StringBuffer("[");
            for (int i = 0; i < favorites.size(); i++) {
                ArrayList row = (ArrayList) favorites.get(i);
                if (i > 0) sb.append(",");
                sb.append("{");
                sb.append("\"id\":\""   + escJson((String) row.get(0)) + "\",");
                sb.append("\"name\":\"" + escJson((String) row.get(1)) + "\",");
                sb.append("\"sql\":\""  + escJson((String) row.get(2)) + "\",");
                sb.append("\"ts\":\""   + escJson((String) row.get(3)) + "\"");
                sb.append("}");
            }
            sb.append("]");
            writeJson(response, sb.toString());
        } catch (Exception e) { writeJson(response, "[]"); }
    }

    private void handleFavoriteDelete(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String favoriteId = CommonUtility.checkNullObj(request.getParameter("id"));
        String username    = getLoggedInUsername(request);
        if (favoriteId.trim().length() == 0) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"Missing favorite id.\"}");
            return;
        }
        try {
            dao.deleteFavorite(username, favoriteId.trim());
            writeJson(response, "{\"status\":\"ok\"}");
        } catch (Exception e) {
            writeJson(response, "{\"status\":\"error\",\"message\":\"" + escJson(e.getMessage()) + "\"}");
        }
    }

    /* ════════════════════════════════════════════════════════════
       AUDIT PAGE / AUDIT EXCEL
       ════════════════════════════════════════════════════════════ */
    private void handleAuditPage(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String fromDate    = CommonUtility.checkNullObj(request.getParameter("fromDate"));
        String toDate      = CommonUtility.checkNullObj(request.getParameter("toDate"));
        String filterUser  = CommonUtility.checkNullObj(request.getParameter("filterUser"));
        String opType      = CommonUtility.checkNullObj(request.getParameter("opType"));
        String ip          = CommonUtility.checkNullObj(request.getParameter("ip"));
        try {
            ArrayList auditList = dao.getAuditReport(fromDate, toDate, filterUser, opType, ip);
            request.setAttribute("auditList", auditList);
        } catch (Exception e) {
            request.setAttribute("auditList", new ArrayList());
        }
        request.setAttribute("fromDate",   fromDate);
        request.setAttribute("toDate",     toDate);
        request.setAttribute("filterUser", filterUser);
        request.setAttribute("opType",     opType);
        request.setAttribute("ip",         ip);
        forwardToJsp(request, response, JSP_AUDIT);
    }

    private void handleAuditExcel(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String fromDate   = CommonUtility.checkNullObj(request.getParameter("fromDate"));
        String toDate     = CommonUtility.checkNullObj(request.getParameter("toDate"));
        String filterUser = CommonUtility.checkNullObj(request.getParameter("filterUser"));
        String opType     = CommonUtility.checkNullObj(request.getParameter("opType"));
        String ip         = CommonUtility.checkNullObj(request.getParameter("ip"));
        try {
            ArrayList auditList = dao.getAuditReport(fromDate, toDate, filterUser, opType, ip);
            HSSFWorkbook wb  = buildAuditWorkbook(auditList);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            response.reset();
            response.setContentType("application/vnd.ms-excel");
            response.setHeader("Content-Disposition", "attachment; filename=QueryTool_Audit.xls");
            response.setContentLength(bos.size());
            bos.writeTo(response.getOutputStream());
            response.getOutputStream().flush();
        } catch (Exception e) { response.sendError(500, e.getMessage()); }
    }

    /* ════════════════════════════════════════════════════════════
       EXPORT EXCEL — routes to selected target
       ════════════════════════════════════════════════════════════ */
    private void handleExportExcel(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String sql   = resolveSql(request);
        String qtype = dao.detectQueryType(sql);
        if (!isAdmin(request) && !isViewerAllowedQtype(qtype)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Read-only accounts may only export SELECT results.");
            return;
        }
        String timeoutP = CommonUtility.checkNullObj(request.getParameter("timeout"));
        int timeout = DEFAULT_TIMEOUT;
        try { timeout = Integer.parseInt(timeoutP.trim()); } catch (Exception e) { /* default */ }

        try {
            QueryResult qr = dao.executeQuery(sql, timeout, MAX_EXPORT_ROWS, getDbTarget(request));
            HSSFWorkbook wb  = buildResultWorkbook(qr, sql);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            String fname = "QueryResult_" + System.currentTimeMillis() + ".xls";
            response.reset();
            response.setContentType("application/vnd.ms-excel");
            response.setHeader("Content-Disposition", "attachment; filename=" + fname);
            response.setContentLength(bos.size());
            bos.writeTo(response.getOutputStream());
            response.getOutputStream().flush();
        } catch (Exception e) { response.sendError(500, e.getMessage()); }
    }

    /* ════════════════════════════════════════════════════════════
       EXPORT CSV — routes to selected target
       ════════════════════════════════════════════════════════════ */
    private void handleExportCsv(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String sql   = resolveSql(request);
        String qtype = dao.detectQueryType(sql);
        if (!isAdmin(request) && !isViewerAllowedQtype(qtype)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Read-only accounts may only export SELECT results.");
            return;
        }
        String timeoutP = CommonUtility.checkNullObj(request.getParameter("timeout"));
        int timeout = DEFAULT_TIMEOUT;
        try { timeout = Integer.parseInt(timeoutP.trim()); } catch (Exception e) { /* default */ }

        try {
            QueryResult qr = dao.executeQuery(sql, timeout, MAX_EXPORT_ROWS, getDbTarget(request));
            response.reset();
            response.setContentType("text/csv;charset=UTF-8");
            response.setHeader("Content-Disposition",
                    "attachment; filename=QueryResult_" + System.currentTimeMillis() + ".csv");

            PrintWriter pw = response.getWriter();
            for (int ri = 0; ri < qr.resultSets.size(); ri++) {
                ResultSetData rsd = (ResultSetData) qr.resultSets.get(ri);
                if (qr.resultSets.size() > 1) pw.println("\"Result Set " + rsd.index + "\"");
                StringBuffer hdr = new StringBuffer();
                for (int c = 0; c < rsd.columns.size(); c++) {
                    if (c > 0) hdr.append(",");
                    hdr.append("\"").append(csvEsc((String) rsd.columns.get(c))).append("\"");
                }
                pw.println(hdr.toString());
                for (int r = 0; r < rsd.rows.size(); r++) {
                    ArrayList row = (ArrayList) rsd.rows.get(r);
                    StringBuffer line = new StringBuffer();
                    for (int c = 0; c < row.size(); c++) {
                        if (c > 0) line.append(",");
                        line.append("\"").append(csvEsc((String) row.get(c))).append("\"");
                    }
                    pw.println(line.toString());
                }
                if (ri < qr.resultSets.size() - 1) pw.println();
            }
            pw.flush();
        } catch (Exception e) { response.sendError(500, e.getMessage()); }
    }

    /* ════════════════════════════════════════════════════════════
       EXCEL WORKBOOKS
       ════════════════════════════════════════════════════════════ */
    private HSSFWorkbook buildResultWorkbook(QueryResult qr, String sql) throws Exception {
        HSSFWorkbook wb = new HSSFWorkbook();
        HSSFCellStyle hdrStyle = wb.createCellStyle();
        hdrStyle.setFillForegroundColor(HSSFColor.DARK_BLUE.index);
        hdrStyle.setFillPattern(HSSFCellStyle.SOLID_FOREGROUND);
        HSSFFont hdrFont = wb.createFont();
        hdrFont.setColor(HSSFColor.WHITE.index);
        hdrFont.setBoldweight(HSSFFont.BOLDWEIGHT_BOLD);
        hdrStyle.setFont(hdrFont);

        HSSFCellStyle altStyle = wb.createCellStyle();
        altStyle.setFillForegroundColor(HSSFColor.LEMON_CHIFFON.index);
        altStyle.setFillPattern(HSSFCellStyle.SOLID_FOREGROUND);

        HSSFCellStyle normStyle = wb.createCellStyle();

        for (int ri = 0; ri < qr.resultSets.size(); ri++) {
            ResultSetData rsd = (ResultSetData) qr.resultSets.get(ri);
            String sheetName = qr.resultSets.size() == 1 ? "Results" : "Result Set " + rsd.index;
            HSSFSheet sh = wb.createSheet(sheetName);
            for (int c = 0; c < rsd.columns.size(); c++) sh.setColumnWidth(c, 5500);

            HSSFRow hRow = sh.createRow(0);
            for (int c = 0; c < rsd.columns.size(); c++) {
                HSSFCell cell = hRow.createCell(c);
                cell.setCellValue((String) rsd.columns.get(c));
                cell.setCellStyle(hdrStyle);
            }
            for (int r = 0; r < rsd.rows.size(); r++) {
                ArrayList row = (ArrayList) rsd.rows.get(r);
                HSSFRow exRow = sh.createRow(r + 1);
                HSSFCellStyle st = (r % 2 == 1) ? altStyle : normStyle;
                for (int c = 0; c < row.size(); c++) {
                    HSSFCell cell = exRow.createCell(c);
                    cell.setCellValue((String) row.get(c));
                    cell.setCellStyle(st);
                }
            }
            if (rsd.columns.size() > 0) sh.setAutoFilter(new CellRangeAddress(0, 0, 0, rsd.columns.size() - 1));
        }

        HSSFSheet infoSh = wb.createSheet("Execution Info");
        infoSh.setColumnWidth(0, 8000);
        infoSh.setColumnWidth(1, 16000);
        HSSFCellStyle lblStyle = wb.createCellStyle();
        HSSFFont lblFont = wb.createFont();
        lblFont.setBoldweight(HSSFFont.BOLDWEIGHT_BOLD);
        lblStyle.setFont(lblFont);

        int totalRows = 0;
        for (int i = 0; i < qr.resultSets.size(); i++) {
            totalRows += ((ResultSetData) qr.resultSets.get(i)).rowCount;
        }
        String[][] infoData = {
            { "Query Type",          qr.queryType },
            { "Status",              qr.status },
            { "Rows Returned",       String.valueOf(totalRows) },
            { "Rows Affected",       String.valueOf(qr.rowsAffected) },
            { "Execution Time (ms)", String.valueOf(qr.executionTimeMs) },
            { "Query Text",          sql }
        };
        for (int i = 0; i < infoData.length; i++) {
            HSSFRow row = infoSh.createRow(i);
            HSSFCell lbl = row.createCell(0);
            lbl.setCellValue(infoData[i][0]);
            lbl.setCellStyle(lblStyle);
            row.createCell(1).setCellValue(infoData[i][1]);
        }
        return wb;
    }

    private HSSFWorkbook buildAuditWorkbook(ArrayList auditList) throws Exception {
        HSSFWorkbook wb = new HSSFWorkbook();
        HSSFSheet    sh = wb.createSheet("Audit Report");

        HSSFCellStyle hdrStyle = wb.createCellStyle();
        hdrStyle.setFillForegroundColor(HSSFColor.DARK_BLUE.index);
        hdrStyle.setFillPattern(HSSFCellStyle.SOLID_FOREGROUND);
        HSSFFont hf = wb.createFont();
        hf.setColor(HSSFColor.WHITE.index);
        hf.setBoldweight(HSSFFont.BOLDWEIGHT_BOLD);
        hdrStyle.setFont(hf);

        HSSFCellStyle altStyle = wb.createCellStyle();
        altStyle.setFillForegroundColor(HSSFColor.LEMON_CHIFFON.index);
        altStyle.setFillPattern(HSSFCellStyle.SOLID_FOREGROUND);

        String[] hdrs = {
            "ID", "Username", "Operation", "Query Text",
            "Forwarded IP", "Remote IP", "User Agent",
            "Session ID", "Rows Affected", "Exec Time (ms)",
            "Status", "Executed On"
        };
        int[] widths = { 3000, 5000, 4000, 15000, 5000, 5000, 8000, 8000, 4000, 5000, 4000, 7000 };
        for (int c = 0; c < widths.length; c++) sh.setColumnWidth(c, widths[c]);

        HSSFRow hRow = sh.createRow(0);
        for (int c = 0; c < hdrs.length; c++) {
            HSSFCell cell = hRow.createCell(c);
            cell.setCellValue(hdrs[c]);
            cell.setCellStyle(hdrStyle);
        }
        for (int r = 0; r < auditList.size(); r++) {
            ArrayList    row   = (ArrayList) auditList.get(r);
            HSSFRow      exRow = sh.createRow(r + 1);
            HSSFCellStyle st   = (r % 2 == 1) ? altStyle : wb.createCellStyle();
            for (int c = 0; c < row.size() && c < hdrs.length; c++) {
                HSSFCell cell = exRow.createCell(c);
                cell.setCellValue((String) row.get(c));
                cell.setCellStyle(st);
            }
        }
        sh.setAutoFilter(new CellRangeAddress(0, 0, 0, hdrs.length - 1));
        return wb;
    }

    /* ════════════════════════════════════════════════════════════
       JSON
       ════════════════════════════════════════════════════════════ */
    private String serializeQueryResult(QueryResult qr) {
        StringBuffer sb = new StringBuffer();
        sb.append("{");
        sb.append("\"status\":\""          + escJson(qr.status)          + "\",");
        sb.append("\"queryType\":\""       + escJson(qr.queryType)       + "\",");
        sb.append("\"executionTimeMs\":"   + qr.executionTimeMs          + ",");
        sb.append("\"rowsAffected\":"      + qr.rowsAffected             + ",");
        sb.append("\"errorMessage\":\""    + escJson(qr.errorMessage)    + "\",");
        sb.append("\"resultSets\":[");
        for (int i = 0; i < qr.resultSets.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(serializeResultSetData((ResultSetData) qr.resultSets.get(i)));
        }
        sb.append("]}");
        return sb.toString();
    }

    private String serializeResultSetData(ResultSetData rsd) {
        StringBuffer sb = new StringBuffer();
        sb.append("{");
        sb.append("\"index\":"     + rsd.index     + ",");
        sb.append("\"rowCount\":"  + rsd.rowCount  + ",");
        sb.append("\"truncated\":" + rsd.truncated + ",");
        sb.append("\"columns\":[");
        for (int c = 0; c < rsd.columns.size(); c++) {
            if (c > 0) sb.append(",");
            sb.append("\"" + escJson((String) rsd.columns.get(c)) + "\"");
        }
        sb.append("],\"rows\":[");
        for (int r = 0; r < rsd.rows.size(); r++) {
            ArrayList row = (ArrayList) rsd.rows.get(r);
            if (r > 0) sb.append(",");
            sb.append("[");
            for (int c = 0; c < row.size(); c++) {
                if (c > 0) sb.append(",");
                sb.append("\"" + escJson((String) row.get(c)) + "\"");
            }
            sb.append("]");
        }
        sb.append("]}");
        return sb.toString();
    }

    /* ════════════════════════════════════════════════════════════
       AUDIT ENTRY
       ════════════════════════════════════════════════════════════ */
    private AuditEntry buildAuditEntry(HttpServletRequest request,
                                       String username, String qtype,
                                       String sql, QueryResult qr) {
        AuditEntry ae = new AuditEntry();
        ae.username        = username;
        ae.queryType       = qtype;
        ae.queryText       = sql;
        ae.status          = qr != null ? qr.status          : "ERROR";
        ae.rowsAffected    = qr != null ? qr.rowsAffected    : 0;
        ae.executionTimeMs = qr != null ? qr.executionTimeMs : 0;

        String xff = request.getHeader("X-Forwarded-For");
        ae.forwardedIp = xff != null ? xff : "";
        String proxy = request.getHeader("Proxy-Client-IP");
        ae.proxyIp = proxy != null ? proxy : "";
        String wlProxy = request.getHeader("WL-Proxy-Client-IP");
        ae.wlProxyIp = wlProxy != null ? wlProxy : "";
        String remoteAddr = request.getRemoteAddr();
        ae.remoteIp = remoteAddr != null ? remoteAddr : "";
        String remoteHost = request.getRemoteHost();
        ae.remoteHost = remoteHost != null ? remoteHost : "";
        String ua = request.getHeader("User-Agent");
        ae.userAgent = ua != null ? ua : "";
        HttpSession sess = request.getSession(false);
        ae.sessionId = sess != null ? sess.getId() : "";
        return ae;
    }

    /* ════════════════════════════════════════════════════════════
       SESSION HELPERS
       ════════════════════════════════════════════════════════════ */
    private boolean isLoggedIn(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return false;
        return session.getAttribute(SESSION_KEY) != null;
    }

    private String getLoggedInUsername(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return "unknown";
        ArrayList user = (ArrayList) session.getAttribute(SESSION_KEY);
        if (user == null || user.size() == 0) return "unknown";
        return (String) user.get(0);
    }

    private boolean isDmlOrDdl(String qtype) {
        return "INSERT".equals(qtype) || "UPDATE".equals(qtype)
            || "DELETE".equals(qtype) || "ALTER".equals(qtype)
            || "DROP".equals(qtype)   || "TRUNCATE".equals(qtype);
    }

    /* ════════════════════════════════════════════════════════════
       UTILITY
       ════════════════════════════════════════════════════════════ */
    private void forwardToJsp(HttpServletRequest request, HttpServletResponse response, String path)
            throws ServletException, IOException {
        RequestDispatcher rd = request.getRequestDispatcher(path);
        rd.forward(request, response);
    }

    private void writeJson(HttpServletResponse response, String json) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(json);
    }

    private String escJson(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        int len = s.length();
        for (int i = 0; i < len; i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"':  sb.append("\\\""); break;
                case '\b': sb.append("\\b");  break;
                case '\f': sb.append("\\f");  break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) {
                        sb.append("\\u00");
                        String hex = Integer.toHexString(c);
                        if (hex.length() < 2) sb.append('0');
                        sb.append(hex);
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    private String csvEsc(String s) {
        if (s == null) return "";
        return s.replace("\"", "\"\"");
    }
}