<%--
  CEO Loan Intelligence Dashboard - page shell and boot data

  Designed and architected by CHINTALA MAHINDRA
--%>
<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" session="false"%>
<%@ page import="java.util.*,
                 in.gov.ap.serp.sthreenidhi.platform.util.Text" %>

<%
    /* ---- 1. Pull the boot data the servlet put on the request ---- */
    Boolean snapshotReady = (Boolean) request.getAttribute("snapshotReady");
    if (snapshotReady == null) snapshotReady = Boolean.FALSE;

    Map bootData = (Map) request.getAttribute("bootData");

    String initialChapter = Text.checkNullObj(request.getAttribute("initialChapter"));
    if (initialChapter.length() == 0) initialChapter = "pulse";

    String snapshotMessage = Text.checkNullObj(request.getAttribute("snapshotMessage"));
    String randId          = Text.checkNullObj(request.getAttribute("randId"));
    String apiToken        = Text.checkNullObj(request.getAttribute("apiToken"));
    String ctx             = request.getContextPath();

    /* ---- 2. Serialize the boot data Map to JSON ---- */
    StringBuilder js = new StringBuilder();
    js.append("{");
    js.append("ready:").append(snapshotReady.booleanValue());

    if (snapshotReady.booleanValue() && bootData != null) {
        /* fyLabel / fyStart / fyEnd */
        js.append(",\"fyLabel\":\"").append(escapeJson((String) bootData.get("fyLabel"))).append("\"");
        js.append(",\"fyStart\":\"").append(escapeJson((String) bootData.get("fyStart"))).append("\"");
        js.append(",\"fyEnd\":\"").append(escapeJson((String) bootData.get("fyEnd"))).append("\"");
        js.append(",\"builtAtMillis\":").append(bootData.get("builtAtMillis"));

        /* fyList */
        List fyList = (List) bootData.get("fyList");
        js.append(",\"fyList\":[");
        if (fyList != null) {
            for (int i = 0; i < fyList.size(); i++) {
                if (i > 0) js.append(",");
                js.append("\"").append(escapeJson(String.valueOf(fyList.get(i)))).append("\"");
            }
        }
        js.append("]");

        /* TARGET_AMOUNT is stored in a different unit from rupee amounts
           (FY 2025-26 total 5,713 vs ~95 crore disbursed in one month):
           most likely crore. Not converted until confirmed. */
        js.append(",\"targetUnit\":\"unconfirmed (likely crore)\"");

        /* State totals: every key of the snapshot totals map */
        Map totals = (Map) bootData.get("totals");
        js.append(",\"totals\":{");
        if (totals != null) {
            int n = 0;
            for (Iterator it = totals.entrySet().iterator(); it.hasNext(); n++) {
                Map.Entry e = (Map.Entry) it.next();
                if (n > 0) js.append(",");
                js.append("\"").append(escapeJson(String.valueOf(e.getKey()))).append("\":");
                appendValue(js, e.getValue());
            }
        }
        js.append("}");

        /* Snapshot blocks - keys match CeoDashboardSnapshotBuilder */
        appendListOfMaps(js, "districts", (List) bootData.get("districts"),
            new String[]{"id","name","slug","activeMembers","membersWithLoans","membersLoanSide",
                         "membersRepaySide","loanCount","disbursed","openLoans","closedLoans",
                         "repayTxns","repaid","repaidClosed","repaidUnprocessed","repaidAdjustment",
                         "targetAmount",
                         "overdueLoans","overdueAmount","outstanding","overdueOutstanding","statusLoans","od1Loans","od1Amount","od2Loans","od2Amount","od3Loans","od3Amount"});
        /* 24 trend months, oldest first */
        List months = (List) bootData.get("months");
        js.append(",\"months\":[");
        if (months != null) {
            for (int i = 0; i < months.size(); i++) {
                if (i > 0) js.append(",");
                js.append("\"").append(escapeJson(String.valueOf(months.get(i)))).append("\"");
            }
        }
        js.append("]");
        appendListOfMaps(js, "monthly",   (List) bootData.get("monthly"),
            new String[]{"districtId","month","loanCount","disbursed","repayTxns","repaid"});

        /* Calendar: {"<districtId>":[["yyyy-MM-dd",loanCount,disbursed,repayTxns,repaid],...]}
           compact because it has one row per district per day of the FY */
        List daily = (List) bootData.get("daily");
        js.append(",\"daily\":{");
        if (daily != null) {
            String open = null;
            for (int i = 0; i < daily.size(); i++) {
                Map d = (Map) daily.get(i);
                String did = String.valueOf(d.get("districtId"));
                if (!did.equals(open)) {
                    if (open != null) js.append("],");
                    js.append("\"").append(escapeJson(did)).append("\":[");
                    open = did;
                } else {
                    js.append(",");
                }
                js.append("[\"").append(escapeJson(String.valueOf(d.get("day")))).append("\",");
                appendValue(js, d.get("loanCount"));  js.append(",");
                appendValue(js, d.get("disbursed"));  js.append(",");
                appendValue(js, d.get("repayTxns"));  js.append(",");
                appendValue(js, d.get("repaid"));     js.append("]");
            }
            if (open != null) js.append("]");
        }
        js.append("}");
        appendListOfMaps(js, "projects",  (List) bootData.get("projects"),
            new String[]{"districtId","projectType","projectName","loanCount","disbursed","openLoans","members"});
        appendListOfMaps(js, "purposes",  (List) bootData.get("purposes"),
            new String[]{"districtId","purpose","loanCount","disbursed","members"});
        appendListOfMaps(js, "mandals",   (List) bootData.get("mandals"),
            new String[]{"districtId","mandalId","name","loanCount","disbursed","openLoans","closedLoans",
                         "membersLoanSide","repayTxns","repaid",
                         "targetAmount","officerUserId","officerName","officerRole","agmUserId",
                         "agmName","dgmUserId","dgmName",
                         "overdueLoans","overdueAmount","outstanding","overdueOutstanding","statusLoans","od1Loans","od1Amount","od2Loans","od2Amount","od3Loans","od3Amount"});
        appendListOfMaps(js, "employees", (List) bootData.get("employees"),
            new String[]{"userId","empCode","officerName","officerRole","agmUserId","agmName",
                         "dgmUserId","dgmName","districtIds","mandalCount","loanCount","disbursed",
                         "repayTxns","repaid","targetAmount",
                         "overdueLoans","overdueAmount","outstanding","overdueOutstanding","statusLoans","od1Loans","od1Amount","od2Loans","od2Amount","od3Loans","od3Amount"});
    }
    js.append("}");
%>

<%!
    /* Change on every release that touches app.js or app.css, so browsers fetch the new files. */
    private static final String ASSET_VERSION = "20261007a";

    /* ---- JSP-scope helpers (safe to use anywhere below) ---- */

    public static String escapeJson(String s) {
        if (s == null) return "";
        StringBuilder b = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': b.append("\\\\"); break;
                case '\'': b.append("\\'");  break;
                case '"':  b.append("\\\""); break;
                case '\n': b.append("\\n");  break;
                case '\r': b.append("\\r");  break;
                case '\t': b.append("\\t");  break;
                case '<':  b.append("\\u003c"); break;   /* DB text can never close the <script> */
                case (char) 0x2028: b.append("\\u2028"); break;   /* line separators end an ES5 string literal */
                case (char) 0x2029: b.append("\\u2029"); break;
                default:   b.append(c);
            }
        }
        return b.toString();
    }

    /* Numbers as plain JSON numbers (BigDecimal never in E-notation), text quoted. */
    public static void appendValue(StringBuilder js, Object v) {
        if (v == null) {
            js.append("null");
        } else if (v instanceof java.math.BigDecimal) {
            js.append(((java.math.BigDecimal) v).toPlainString());
        } else if (v instanceof Number || v instanceof Boolean) {
            js.append(v.toString());
        } else {
            js.append("\"").append(escapeJson(String.valueOf(v))).append("\"");
        }
    }

    public static void appendListOfMaps(StringBuilder js, String key, List list, String[] fields) {
        js.append(",\"").append(key).append("\":[");
        if (list != null) {
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) js.append(",");
                Map row = (Map) list.get(i);
                js.append("{");
                for (int f = 0; f < fields.length; f++) {
                    if (f > 0) js.append(",");
                    String field = fields[f];
                    js.append("\"").append(field).append("\":");
                    appendValue(js, row.get(field));
                }
                js.append("}");
            }
        }
        js.append("]");
    }
%>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CEO Loan &amp; Repayment Intelligence — AP Stree Nidhi</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <%-- Web fonts load after the first paint; the page shows in system fonts until they arrive --%>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,450;9..144,600;9..144,700&amp;family=Inter:wght@400;500;600;700;800&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,450;9..144,600;9..144,700&amp;family=Inter:wght@400;500;600;700;800&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet"></noscript>
  <%-- app.js and app.css come compressed through the dashboard servlet (action=asset); the plain files stay in /dashboards/ceo-loan-intelligence/ as a fallback --%>
  <link href="<%=request.getContextPath()%>/CeoLoanIntelligence?action=asset&amp;name=app.css&amp;v=<%=ASSET_VERSION%>" type="text/css" rel="stylesheet">

  <script type="text/javascript">window.__CEO_LIVE = true;</script>
  <script type="text/javascript">
    window.__CEO_CTX               = '<%=escapeJson(ctx)%>';
    window.__CEO_INITIAL_CHAPTER   = '<%=escapeJson(initialChapter)%>';
    window.__CEO_SNAPSHOT_MESSAGE  = '<%=escapeJson(snapshotMessage)%>';
    window.__CEO_RAND_ID           = '<%=escapeJson(randId)%>';
    window.__CEO_TOKEN             = '<%=escapeJson(apiToken)%>';
    window.__CEO_BOOT_DATA         = <%=js.toString()%>;

  </script>
</head>
<body>
  <div id="cd-app-root"></div>
  <script type="text/javascript" src="<%=request.getContextPath()%>/CeoLoanIntelligence?action=asset&amp;name=app.js&amp;v=<%=ASSET_VERSION%>"></script>
  <script type="text/javascript">
    if (!window.CeoDash) {
      document.write('<link href="<%=request.getContextPath()%>/dashboards/ceo-loan-intelligence/app.css?v=<%=ASSET_VERSION%>" type="text/css" rel="stylesheet">');
      document.write('<script type="text/javascript" src="<%=request.getContextPath()%>/dashboards/ceo-loan-intelligence/app.js?v=<%=ASSET_VERSION%>"><\/script>');
    }
  </script>
</body>
</html>
