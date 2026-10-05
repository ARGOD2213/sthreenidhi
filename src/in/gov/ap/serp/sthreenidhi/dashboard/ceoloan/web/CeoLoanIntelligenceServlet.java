/*
 * CEO Loan Intelligence Dashboard
 * Public entry point for the CEO dashboard (no login, like QueryTool): serves the page
 * and the JSON calls made by app.js.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.web;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao.CeoLoanIntelligenceDAO;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao.CeoLoanIntelligenceDAOImpl;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashboardSnapshot;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.cache.CeoDashCache;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.cache.CeoDashCacheLoader;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.service.CeoDashboardService;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.service.CeoDashCustomExport;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.service.CeoDashExport;
import in.gov.ap.serp.sthreenidhi.platform.web.GzipSupport;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util.CeoLog;
import in.gov.ap.serp.sthreenidhi.platform.web.ResponseCache;
import in.gov.ap.serp.sthreenidhi.platform.security.AccessGuard;
import in.gov.ap.serp.sthreenidhi.platform.security.LinkToken;
import in.gov.ap.serp.sthreenidhi.platform.util.Text;

public class CeoLoanIntelligenceServlet extends HttpServlet {
    private static final long   serialVersionUID = 1L;
    private static final String DASHBOARD_ID     = "ceo-loan-intelligence";
    private static final String DASHBOARD_DIR    = "/dashboards/ceo-loan-intelligence/";
    private static final String JSP_DASHBOARD    = DASHBOARD_DIR + "CeoLoanIntelligence.jsp";

    // a public URL must not be able to start rebuilds back to back
    private static final long DEFAULT_MIN_REFRESH_GAP_SECONDS = 15L * 60L;

    private CeoLoanIntelligenceDAO dao = new CeoLoanIntelligenceDAOImpl();

    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        doPost(request, response);
    }

    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        String action = Text.checkNullObj(request.getParameter("action")).trim();

        // app.js / app.css carry no data: open to everyone, compressed once and kept in memory
        if ("asset".equals(action)) { handleAsset(request, response); return; }

        // status: ready / loading for everyone, error details only for the admin link
        if ("status".equals(action)) { plain(action, request, response); return; }

        // refresh: admin link only
        if ("refresh".equals(action)) {
            if (!AccessGuard.linkOk(request, DASHBOARD_ID, LinkToken.PURPOSE_ADMIN)) { AccessGuard.denyJson(response); return; }
            plain(action, request, response);
            return;
        }

        // custom Excel: the preview (JSON) and the file, built from the snapshot; the token the page was given
        if ("custom".equals(action) || "customPreview".equals(action)) {
            if (!AccessGuard.apiOk(request, DASHBOARD_ID)) { AccessGuard.denyJson(response); return; }
            handleCustom("custom".equals(action), request, response);
            return;
        }

        // data calls and the Excel file: the token the page was given
        if ("export".equals(action) || isJsonAction(action)) {
            if (!AccessGuard.apiOk(request, DASHBOARD_ID)) { AccessGuard.denyJson(response); return; }
            if ("export".equals(action)) { handleExport(request, response); return; }
            handleCacheable(action, request, response);
            return;
        }

        // the page itself: a signed, unexpired link
        if (!AccessGuard.linkOk(request, DASHBOARD_ID, LinkToken.PURPOSE_VIEW)) { AccessGuard.denyPage(response); return; }
        handleCacheable(action, request, response);
    }

    // not cached: collected and sent compressed when the browser accepts it
    private void plain(String action, HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        if (!GzipSupport.accepted(request)) { route(action, request, response); return; }
        GzipSupport.Buffered out = new GzipSupport.Buffered(request, response);
        try {
            route(action, request, out);
        } finally {
            out.finish();
        }
    }

    // ---- fast path: the page and the JSON answers only change with a new snapshot ----

    // set when this class is loaded, so a new deploy never gets "304 not modified" for an old page
    private static final long STARTED = System.currentTimeMillis();
    private static final int  MAX_PARAM_LENGTH = 200;
    private static final String[] JSON_PARAMS = { "group", "districtId", "mandalId", "voId", "shgId", "from", "to",
                                                  "project", "memberId", "mandals" };

    private static boolean isJsonAction(String a) {
        return "getBorrowers".equals(a) || "drill".equals(a) || "member".equals(a) || "shg".equals(a)
            || "trend".equals(a) || "keyedBy".equals(a);
    }

    private static long jsonMaxAgeSeconds() {
        String p = System.getProperty("ceo.dash.json.maxage.seconds");
        if (p == null || p.trim().length() == 0) return 300L;
        try { return Math.max(0L, Long.parseLong(p.trim())); } catch (Exception e) { return 300L; }
    }

    // null = this request is not cacheable (no snapshot yet, or odd parameters)
    private static String cacheKey(String action, HttpServletRequest request, CeoDashboardSnapshot snap) {
        StringBuffer k = new StringBuffer();
        if (isJsonAction(action)) {
            k.append("ceoloan|json|").append(action).append('|').append(snap.getBuiltAtMillis());
            for (int i = 0; i < JSON_PARAMS.length; i++) {
                String v = param(request, JSON_PARAMS[i]);
                if (v.length() > MAX_PARAM_LENGTH) return null;
                k.append('|').append(v);
            }
        } else {
            String chapter = param(request, "chapter");
            if (chapter.length() > 20 || !chapter.matches("[0-9A-Za-z_-]*")) return null;
            // the day is part of the key in case the page shows "today" from the server clock
            k.append("ceoloan|page|").append(STARTED).append('|').append(snap.getBuiltAtMillis()).append('|').append(chapter)
             .append('|').append(LinkToken.apiToken(DASHBOARD_ID))
             .append('|').append(new java.text.SimpleDateFormat("yyyyMMdd").format(new java.util.Date()));
        }
        return k.toString();
    }

    private void handleCacheable(String action, HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        CeoDashboardSnapshot snap = ResponseCache.enabled() ? CeoDashCache.get() : null;
        String key = snap == null ? null : cacheKey(action, request, snap);
        if (key == null) { plain(action, request, response); return; }

        boolean json = isJsonAction(action);
        String etag = ResponseCache.etagOf(key);
        String cc = json ? "private, max-age=" + jsonMaxAgeSeconds() : "no-cache";

        if (ResponseCache.notModified(request, etag)) {
            ResponseCache.sendNotModified(response, etag, cc);
            return;
        }
        ResponseCache.Entry hit = ResponseCache.get(key);
        if (hit != null) {
            ResponseCache.send(request, response, hit, cc);
            return;
        }

        // first time for this snapshot: build the answer once, keep it, send it
        GzipSupport.Buffered out = new GzipSupport.Buffered(request, response);
        route(action, request, out);
        if (out.statusCode() == HttpServletResponse.SC_OK && !response.isCommitted()) {
            byte[] body = out.body();
            if (body.length > 0 && body.length <= ResponseCache.MAX_BODY_BYTES) {
                ResponseCache.Entry e = ResponseCache.build(body, out.contentType(), etag);
                ResponseCache.put(key, e);
                ResponseCache.send(request, response, e, cc);
                return;
            }
        }
        out.finish();
    }

    private void route(String action, HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        if ("getBorrowers".equals(action)) { handleGetBorrowers(request, response); return; }
        if ("drill".equals(action))        { handleDrill(request, response);        return; }
        if ("member".equals(action))       { handleMember(request, response);       return; }
        if ("shg".equals(action))          { handleShg(request, response);          return; }
        if ("trend".equals(action))        { handleTrend(request, response);        return; }
        if ("keyedBy".equals(action))      { handleKeyedBy(request, response);      return; }
        if ("status".equals(action))       { handleStatus(request, response);       return; }
        if ("refresh".equals(action))      { handleRefresh(response);               return; }

        handlePage(request, response);
    }

    private void handlePage(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        prepareDashboardAttributes(request);
        RequestDispatcher rd = request.getRequestDispatcher(JSP_DASHBOARD);
        rd.forward(request, response);
    }

    // what the JSP needs to draw the first screen (moved here from the FrontServlet request handler)
    private static void prepareDashboardAttributes(HttpServletRequest request) {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) {
            request.setAttribute("snapshotReady", Boolean.FALSE);
            request.setAttribute("snapshotMessage", "Dashboard data is loading...");
        } else {
            request.setAttribute("snapshotReady", Boolean.TRUE);
            request.setAttribute("bootData", toBootData(snap));
        }
        String chapter = Text.checkNullObj(request.getParameter("chapter"));
        if (chapter.length() == 0) chapter = "pulse";
        request.setAttribute("initialChapter", chapter);
        request.setAttribute("apiToken", LinkToken.apiToken(DASHBOARD_ID));
        request.setAttribute("randId", Text.checkNullObj(request.getAttribute("randId")));
    }

    private static Map toBootData(CeoDashboardSnapshot snap) {
        Map boot = new HashMap();
        boot.put("fyLabel", Text.checkNullObj(snap.getFyLabel()));
        boot.put("fyStart", Text.checkNullObj(snap.getFyStart()));
        boot.put("fyEnd",   Text.checkNullObj(snap.getFyEnd()));
        boot.put("builtAtMillis", Long.valueOf(snap.getBuiltAtMillis()));
        List fyList = new ArrayList();
        if (snap.getFyLabel() != null && snap.getFyLabel().length() > 0) fyList.add(snap.getFyLabel());
        boot.put("fyList",    fyList);
        boot.put("totals",    snap.getTotals());
        boot.put("districts", snap.getDistricts());
        boot.put("months",    snap.getMonths());
        boot.put("monthly",   snap.getMonthly());
        boot.put("daily",     snap.getDaily());
        boot.put("projects",  snap.getProjects());
        boot.put("purposes",  snap.getPurposes());
        boot.put("mandals",   snap.getMandals());
        boot.put("employees", snap.getEmployees());
        return boot;
    }

    private void handleGetBorrowers(HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String shgId = Text.checkNullObj(request.getParameter("shgId")).trim();
        ArrayList rows;
        try {
            rows = service.shgMemberLoans(shgId);
        } catch (Exception e) {
            serviceError(response, e, "getBorrowers shgId=" + shgId);
            return;
        }

        StringBuffer sb = new StringBuffer("[");
        String currentMember = null;
        boolean firstLoan = true;
        for (int i = 0; i < rows.size(); i++) {
            Map row = (Map) rows.get(i);
            String memberId = str(row.get("MEMBER_ID"));

            if (!memberId.equals(currentMember)) {
                if (currentMember != null) sb.append("]},");
                currentMember = memberId;
                firstLoan = true;
                sb.append("{\"id\":").append(jsStr(memberId))
                  .append(",\"name\":").append(jsStr(row.get("MEMBER_NAME")))
                  .append(",\"shgId\":").append(jsStr(shgId))
                  .append(",\"loans\":[");
            }

            if (row.get("SHG_MEMBER_LOAN_ACCNO") == null) continue;
            if (!firstLoan) sb.append(",");
            firstLoan = false;

            String loanStatus = str(row.get("LOAN_STATUS"));
            String issued     = str(row.get("ISSUED_DATE"));
            String projName   = str(row.get("PROJECT_NAME"));
            sb.append("{\"id\":").append(jsStr(row.get("SHG_MEMBER_LOAN_ACCNO")))
              .append(",\"shgLoanAccNo\":").append(jsStr(row.get("SHG_LOAN_ACCNO")))
              .append(",\"type\":").append(jsStr(projName.length() > 0 ? projName : str(row.get("PROJECT_TYPE"))))
              .append(",\"projectType\":").append(jsStr(row.get("PROJECT_TYPE")))
              .append(",\"purpose\":").append(jsStr(row.get("PURPOSE")))
              .append(",\"amount\":").append(jsNum(row.get("LOAN_AMOUNT_ISSUED")))
              .append(",\"receivedRepayment\":").append(jsNum(row.get("REPAID_AMOUNT")))
              .append(",\"repaymentTxns\":").append(jsNum(row.get("REPAYMENT_TXN_COUNT")))
              .append(",\"lastRepaymentDate\":").append(jsStr(row.get("LAST_REPAYMENT_DATE")))
              .append(",\"loanStatus\":").append(jsStr(loanStatus))
              .append(",\"status\":").append(jsStr("CLOSED".equalsIgnoreCase(loanStatus) ? "cleared" : "active"))
              .append(",\"issuedDate\":").append(jsStr(issued))
              .append(",\"disbursedDate\":").append(jsStr(issued.length() >= 7 ? issued.substring(0, 7) : issued))
              .append("}");
        }
        if (currentMember != null) sb.append("]}");
        sb.append("]");
        writeJson(response, sb.toString());
    }

    private final CeoDashboardService service = new CeoDashboardService(dao);

    private void handleDrill(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            writeJson(response, service.drill(param(request, "group"), param(request, "districtId"),
                    param(request, "mandalId"), param(request, "voId"), param(request, "shgId"),
                    param(request, "from"), param(request, "to"), param(request, "project")));
        } catch (Exception e) {
            serviceError(response, e, "drill " + request.getQueryString());
        }
    }

    private void handleMember(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            writeJson(response, service.member(param(request, "memberId")));
        } catch (Exception e) {
            serviceError(response, e, "member " + request.getQueryString());
        }
    }

    private void handleShg(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            writeJson(response, service.shg(param(request, "shgId")));
        } catch (Exception e) {
            serviceError(response, e, "shg " + request.getQueryString());
        }
    }

    private void handleTrend(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            writeJson(response, service.trend(param(request, "districtId"), param(request, "mandals")));
        } catch (Exception e) {
            serviceError(response, e, "trend");
        }
    }

    private void handleKeyedBy(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            writeJson(response, service.cashKeyedBy(param(request, "from"), param(request, "to")));
        } catch (Exception e) {
            serviceError(response, e, "keyedBy");
        }
    }

    // Excel (.xls) of what a page shows: kind=drill (same parameters as action=drill) or kind=employee (from, to)
    private void handleExport(HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            String kind = param(request, "kind"), from = param(request, "from"), to = param(request, "to");
            byte[] xls;
            String base;
            if ("employee".equals(kind)) {
                String json = service.drill("MANDAL", null, null, null, null, from, to, null);
                xls = CeoDashExport.employees(json, CeoDashCache.get(), param(request, "label"));
                base = "CEO_Employee_Performance";
            } else {
                String group = param(request, "group");
                String json = service.drill(group, param(request, "districtId"), param(request, "mandalId"),
                        param(request, "voId"), param(request, "shgId"), from, to, param(request, "project"));
                xls = CeoDashExport.rows(json, param(request, "title"), param(request, "label"), group, CeoDashCache.get());
                base = "CEO_" + group.replaceAll("[^A-Za-z]", "");
            }
            String stamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmm").format(new java.util.Date());
            response.reset();
            response.setContentType("application/vnd.ms-excel");
            response.setHeader("Content-Disposition", "attachment; filename=" + base + "_" + stamp + ".xls");
            response.setContentLength(xls.length);
            response.getOutputStream().write(xls);
            response.getOutputStream().flush();
        } catch (Exception e) {
            serviceError(response, e, "export");
        }
    }

    private static final String[] CUSTOM_PARAMS = { "group", "fromMonth", "toMonth", "districts", "mandals", "project",
                                                    "cols", "sort", "dir", "top", "trend", "title" };

    // what the user picked in the "Custom Excel" panel; every value is validated inside CeoDashCustomExport
    private void handleCustom(boolean file, HttpServletRequest request, HttpServletResponse response) throws IOException {
        try {
            Map p = new HashMap();
            for (int i = 0; i < CUSTOM_PARAMS.length; i++) {
                String v = Text.checkNullObj(request.getParameter(CUSTOM_PARAMS[i])).trim();
                if (v.length() > 4000) throw new IllegalArgumentException("a value is too long");
                p.put(CUSTOM_PARAMS[i], v);
            }
            CeoDashCustomExport.Result r = CeoDashCustomExport.run(CeoDashCache.get(), p);
            if (!file) {
                response.setHeader("Cache-Control", "no-store");
                writeJson(response, CeoDashCustomExport.previewJson(r, 8));
                return;
            }
            byte[] xls = CeoDashCustomExport.excel(r);
            String stamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmm").format(new java.util.Date());
            response.reset();
            response.setContentType("application/vnd.ms-excel");
            response.setHeader("Content-Disposition", "attachment; filename=" + CeoDashCustomExport.fileBase(r) + "_" + stamp + ".xls");
            response.setHeader("Cache-Control", "no-store");
            response.setContentLength(xls.length);
            response.getOutputStream().write(xls);
            response.getOutputStream().flush();
        } catch (Exception e) {
            serviceError(response, e, "custom");
        }
    }

    private static final Map ASSETS = Collections.synchronizedMap(new HashMap());

    // app.js and app.css; the JSP adds ?v=ASSET_VERSION, so a new release always gets a new copy
    private void handleAsset(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String name = param(request, "name");
        String path, type;
        if ("app.js".equals(name))       { path = DASHBOARD_DIR + "app.js"; type = "application/javascript;charset=UTF-8"; }
        else if ("app.css".equals(name)) { path = DASHBOARD_DIR + "app.css"; type = "text/css;charset=UTF-8"; }
        else { response.sendError(HttpServletResponse.SC_NOT_FOUND); return; }

        String key = name + "|" + param(request, "v");
        byte[][] body = (byte[][]) ASSETS.get(key);
        if (body == null) {
            byte[] raw = readResource(path);
            if (raw == null) { response.sendError(HttpServletResponse.SC_NOT_FOUND); return; }
            body = new byte[][] { raw, GzipSupport.gzip(raw) };
            if (ASSETS.size() > 20) ASSETS.clear();
            ASSETS.put(key, body);
        }
        boolean gz = GzipSupport.accepted(request);
        byte[] out = gz ? body[1] : body[0];
        response.setContentType(type);
        response.setHeader("Cache-Control", "public, max-age=2592000");
        response.addHeader("Vary", "Accept-Encoding");
        if (gz) response.setHeader("Content-Encoding", "gzip");
        response.setContentLength(out.length);
        response.getOutputStream().write(out);
        response.getOutputStream().flush();
    }

    private byte[] readResource(String path) throws IOException {
        InputStream in = getServletContext().getResourceAsStream(path);
        if (in == null) return null;
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(256 * 1024);
            byte[] b = new byte[8192];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }

    private static String param(HttpServletRequest request, String name) {
        return Text.checkNullObj(request.getParameter(name)).trim();
    }

    // not ready / busy -> 503, bad input -> 400, anything else -> 500 (details in the server log only)
    private void serviceError(HttpServletResponse response, Exception e, String what) throws IOException {
        if (e instanceof CeoDashboardService.NotReadyException || e instanceof CeoDashboardService.BusyException) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            writeJson(response, "{\"status\":\"error\",\"message\":\"" + escJson(e.getMessage()) + "\"}");
        } else if (e instanceof IllegalArgumentException) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            writeJson(response, "{\"status\":\"error\",\"message\":\"" + escJson(e.getMessage()) + "\"}");
        } else {
            CeoLog.error(what + " failed", e);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            writeJson(response, "{\"status\":\"error\",\"message\":\"Unable to load this level.\"}");
        }
    }
    private void handleStatus(HttpServletRequest request, HttpServletResponse response) throws IOException {
        boolean admin = !LinkToken.enabled() || AccessGuard.linkOk(request, DASHBOARD_ID, LinkToken.PURPOSE_ADMIN);
        response.setContentType("text/plain;charset=UTF-8");
        response.setHeader("Cache-Control", "no-store");
        StringBuffer sb = new StringBuffer();
        sb.append("ready=").append(CeoDashCache.isReady()).append('\n');
        sb.append("loading=").append(CeoDashCache.isLoading()).append('\n');
        if (admin) {
            sb.append("lastAttemptMillis=").append(CeoDashCache.getLastAttemptMillis()).append('\n');
            sb.append("lastSuccessMillis=").append(CeoDashCache.getLastSuccessMillis()).append('\n');
            sb.append("lastError=").append(CeoDashCache.getLastError()).append('\n');
        }
        response.getWriter().write(sb.toString());
    }

    private void handleRefresh(HttpServletResponse response) throws IOException {
        if (CeoDashCache.isLoading()) {
            writeJson(response, "{\"status\":\"busy\",\"message\":\"A refresh is already running.\"}");
            return;
        }
        long gapMs = minRefreshGapSeconds() * 1000L;
        long since = System.currentTimeMillis() - CeoDashCache.getLastAttemptMillis();
        if (CeoDashCache.getLastAttemptMillis() > 0 && since < gapMs) {
            long waitSec = (gapMs - since) / 1000L + 1;
            writeJson(response, "{\"status\":\"skipped\",\"message\":\"Last refresh was recent. Try again in "
                    + waitSec + " seconds.\"}");
            return;
        }
        CeoLog.info("CeoLoanIntelligenceServlet: manual refresh requested");
        Thread t = new Thread(new Runnable() {
            public void run() { CeoDashCacheLoader.loadNow(); }
        }, "CeoDash-ManualRefresh");
        t.setDaemon(true);
        t.start();
        writeJson(response, "{\"status\":\"started\",\"message\":\"Refresh started. Check action=status.\"}");
    }

    private static long minRefreshGapSeconds() {
        String p = System.getProperty("ceo.dash.refresh.min.seconds");
        if (p == null || p.trim().length() == 0) return DEFAULT_MIN_REFRESH_GAP_SECONDS;
        try { return Long.parseLong(p.trim()); }
        catch (Exception e) { return DEFAULT_MIN_REFRESH_GAP_SECONDS; }
    }

    private void writeJson(HttpServletResponse response, String json) throws IOException {
        response.setContentType("application/json;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache");
        response.getWriter().write(json);
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static String jsStr(Object o) {
        return o == null ? "null" : "\"" + escJson(o.toString()) + "\"";
    }

    private static String jsNum(Object o) {
        if (o == null) return "null";
        if (o instanceof BigDecimal) return ((BigDecimal) o).toPlainString();
        if (o instanceof Number) return o.toString();
        return "null";
    }

    private static String escJson(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"':  sb.append("\\\""); break;
                case '\b': sb.append("\\b");  break;
                case '\f': sb.append("\\f");  break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                case '<':  sb.append("\\u003c"); break;
                default:
                    if (c < 0x20) {
                        String hex = Integer.toHexString(c);
                        sb.append("\\u00");
                        if (hex.length() < 2) sb.append('0');
                        sb.append(hex);
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }
}
