/*
 * CEO Loan Intelligence Dashboard
 * Excel (.xls) downloads of what the pages show, in the same HSSF style as QueryTool.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.service;

import java.io.ByteArrayOutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.poi.hssf.usermodel.HSSFCell;
import org.apache.poi.hssf.usermodel.HSSFCellStyle;
import org.apache.poi.hssf.usermodel.HSSFFont;
import org.apache.poi.hssf.usermodel.HSSFRow;
import org.apache.poi.hssf.usermodel.HSSFSheet;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.hssf.util.HSSFColor;
import org.apache.poi.ss.util.CellRangeAddress;

import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean.CeoDashboardSnapshot;

public final class CeoDashExport {

    private CeoDashExport() { }

    private static final String[] GROUP_SHEET = {
        "DISTRICT", "Districts", "MANDAL", "Mandals", "VO", "VOs", "SHG", "SHGs", "MEMBER", "Women",
        "PROJECT", "Projects", "PURPOSE", "Activities", "CATEGORY", "Social category"
    };

    // ---------------- drill rows (Loans Given, Repayments, Calendar, Top SHGs) ----------------

    public static byte[] rows(String json, String title, String label, String group, CeoDashboardSnapshot snap) throws Exception {
        Map body = (Map) new Json(json).value();
        List rows = (List) body.get("rows");
        Book b = new Book();

        String[] base = { "#", "Name", "ID", "Active women", "Loans", "Amount given (Rs)", "Active loans", "Closed loans",
                          "Women who borrowed", "Repayments", "Collected (Rs)", "UPI (Rs)", "POS (Rs)", "Auto-debit (Rs)",
                          "Manual / cash (Rs)", "Online %", "Target (Rs)" };
        // overdue is known per district and per mandal only (today's figure, not tied to the period)
        Map overdue = overdueIndex(snap, group);
        boolean fromRows = false;      // VO / SHG / woman lists carry their own overdue figures in each row
        for (int i = 0; i < rows.size(); i++) { if (((Map) rows.get(i)).get("od") instanceof Map) fromRows = true; }
        boolean odCols = overdue != null || fromRows;
        String[] head = base;
        if (odCols) {
            head = new String[base.length + 5];
            System.arraycopy(base, 0, head, 0, base.length);
            head[17] = "Overdue (Rs)"; head[18] = "Loans in arrears"; head[19] = "Overdue % of open loans";
            head[20] = "Balance at risk (Rs)"; head[21] = "Total outstanding (Rs)";
        }
        HSSFSheet sh = b.sheet(sheetName(group), head);
        double[] tot = new double[head.length];
        boolean[] seen = new boolean[head.length];
        double odOpen = 0;
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            double repaid = d(r.get("repaid")), online = d(r.get("upiAmount")) + d(r.get("posAmount")) + d(r.get("autoAmount"));
            Object[] v = new Object[head.length];
            Object[] first = {
                Double.valueOf(i + 1), s(r.get("name")), s(r.get("id")), r.get("activeMembers"), r.get("loanCount"), r.get("disbursed"),
                r.get("openLoans"), r.get("closedLoans"), r.get("borrowers"), r.get("repayTxns"), r.get("repaid"),
                r.get("upiAmount"), r.get("posAmount"), r.get("autoAmount"), Double.valueOf(Math.max(0, repaid - online)),
                repaid > 0 ? Double.valueOf(Math.round(online / repaid * 1000) / 10.0) : null,
                r.get("targetCr") == null ? null : Double.valueOf(d(r.get("targetCr")) * 10000000d)
            };
            System.arraycopy(first, 0, v, 0, first.length);
            if (odCols) {
                double open = -1, behind = 0;
                if (overdue != null) {
                    Map od = (Map) overdue.get("DISTRICT".equals(group) ? s(r.get("id")) : s(r.get("districtId")) + "|" + s(r.get("id")));
                    if (od != null) {
                        open = d(od.get("statusLoans")); behind = d(od.get("overdueLoans"));
                        v[17] = od.get("overdueAmount"); v[18] = od.get("overdueLoans");
                        v[20] = od.get("overdueOutstanding"); v[21] = od.get("outstanding");
                    }
                } else if (r.get("od") instanceof Map) {
                    Map od = (Map) r.get("od");
                    open = d(od.get("open")); behind = d(od.get("loans"));
                    v[17] = od.get("amount"); v[18] = od.get("loans"); v[20] = od.get("atRisk"); v[21] = od.get("outstanding");
                }
                if (open >= 0) {
                    v[19] = open > 0 ? Double.valueOf(Math.round(behind / open * 1000) / 10.0) : null;
                    odOpen += open;
                }
            }
            b.row(sh, i + 1, v, i % 2 == 1);
            for (int c = 3; c < v.length; c++) { if (c != 15 && c != 19 && v[c] instanceof Number) { tot[c] += ((Number) v[c]).doubleValue(); seen[c] = true; } }
        }
        Object[] total = new Object[head.length];
        total[1] = "Total";
        for (int c = 3; c < head.length; c++) { if (c != 15 && c != 19 && seen[c]) total[c] = Double.valueOf(tot[c]); }
        if (tot[10] > 0) total[15] = Double.valueOf(Math.round((tot[11] + tot[12] + tot[13]) / tot[10] * 1000) / 10.0);
        if (odCols && odOpen > 0) total[19] = Double.valueOf(Math.round(tot[18] / odOpen * 1000) / 10.0);
        b.totalRow(sh, rows.size() + 1, total);

        b.info(new String[][] {
            { "Report", title.length() > 0 ? title : "CEO Loan Intelligence" },
            { "Showing", label },
            { "Rows", String.valueOf(rows.size()) },
            { "Payment modes", Boolean.FALSE.equals(body.get("payModes")) ? "not available" : "UPI = Phi PAYMENT SERVICE, POS = PAYTM PAYMENT SERVICE, Auto-debit = SHG AUTO DEBIT PROCESS, rest = manual" },
            { "Scope", "Stree Nidhi projects only (LOAN_TYPE = SN)" },
            { "Overdue", !odCols ? "not in this list" : "Overdue = arrears of today's open loans (as on the snapshot date), not tied to the period chosen" },
            { "Downloaded", new SimpleDateFormat("dd-MM-yyyy HH:mm").format(new Date()) }
        });
        return b.bytes();
    }

    // key -> overdue figures (district id, or "districtId|mandalId"); null when not available for this list
    static Map overdueIndex(CeoDashboardSnapshot snap, String group) {
        if (snap == null || !(("DISTRICT".equals(group)) || ("MANDAL".equals(group)))) return null;
        if (!isOverdueReady(snap)) return null;
        Map out = new HashMap();
        List l = "DISTRICT".equals(group) ? snap.getDistricts() : snap.getMandals();
        for (int i = 0; i < l.size(); i++) {
            Map m = (Map) l.get(i);
            out.put("DISTRICT".equals(group) ? s(m.get("id")) : s(m.get("districtId")) + "|" + s(m.get("mandalId")), m);
        }
        return out;
    }

    static boolean isOverdueReady(CeoDashboardSnapshot snap) {
        Object o = snap == null ? null : snap.getTotals().get("overdueReady");
        return o instanceof Number && ((Number) o).longValue() == 1;
    }

    private static String sheetName(String group) {
        for (int i = 0; i < GROUP_SHEET.length; i += 2) { if (GROUP_SHEET[i].equals(group)) return GROUP_SHEET[i + 1]; }
        return "Rows";
    }

    // ---------------- Employee performance: mandals with owners, and per person ----------------

    public static byte[] employees(String json, CeoDashboardSnapshot snap, String label) throws Exception {
        Map body = (Map) new Json(json).value();
        List rows = (List) body.get("rows");
        Map byKey = new HashMap();
        for (int i = 0; i < rows.size(); i++) {
            Map r = (Map) rows.get(i);
            byKey.put(s(r.get("districtId")) + "|" + s(r.get("id")), r);
        }
        Map districtName = new HashMap();
        List ds = snap.getDistricts();
        for (int i = 0; i < ds.size(); i++) { Map d = (Map) ds.get(i); districtName.put(s(d.get("id")), s(d.get("name"))); }

        Book b = new Book();
        boolean odOn = isOverdueReady(snap);
        String[] head = { "District", "Mandal", "Manager", "Manager login", "Emp code", "Role", "AGM", "AGM login", "DGM", "DGM login",
                          "Collected (Rs)", "Online (Rs)", "Manual / cash (Rs)", "Online %", "Cash %", "Amount given (Rs)",
                          "Target (Rs)", "Target achieved %", "Loans", "Women who borrowed",
                          "Overdue (Rs)", "Loans in arrears", "Balance at risk (Rs)", "Total outstanding (Rs)" };
        HSSFSheet sh = b.sheet("Mandals", head);
        Map managers = new LinkedHashMap(), agms = new LinkedHashMap(), dgms = new LinkedHashMap();
        List ms = snap.getMandals();
        for (int i = 0; i < ms.size(); i++) {
            Map m = (Map) ms.get(i);
            Map r = (Map) byKey.get(s(m.get("districtId")) + "|" + s(m.get("mandalId")));
            double repaid = r == null ? 0 : d(r.get("repaid"));
            double online = r == null ? 0 : d(r.get("upiAmount")) + d(r.get("posAmount")) + d(r.get("autoAmount"));
            double given = r == null ? 0 : d(r.get("disbursed"));
            double target = r == null || r.get("targetCr") == null ? 0 : d(r.get("targetCr")) * 10000000d;
            double loans = r == null ? 0 : d(r.get("loanCount"));
            double women = r == null ? 0 : d(r.get("borrowers"));
            String mgr = s(m.get("officerName")), agm = s(m.get("agmName")), dgm = s(m.get("dgmName"));
            Object[] v = {
                districtName.containsKey(s(m.get("districtId"))) ? districtName.get(s(m.get("districtId"))) : s(m.get("districtId")),
                s(m.get("name")), mgr.length() > 0 ? mgr : "No officer mapped", s(m.get("officerUserId")), s(m.get("officerEmpCode")),
                s(m.get("officerRole")), agm, s(m.get("agmUserId")), dgm, s(m.get("dgmUserId")),
                Double.valueOf(repaid), Double.valueOf(online), Double.valueOf(Math.max(0, repaid - online)),
                pct(online, repaid), pct(Math.max(0, repaid - online), repaid), Double.valueOf(given),
                target > 0 ? Double.valueOf(target) : null, pct(given, target), Double.valueOf(loans), Double.valueOf(women),
                odOn ? m.get("overdueAmount") : null, odOn ? m.get("overdueLoans") : null, odOn ? m.get("overdueOutstanding") : null, odOn ? m.get("outstanding") : null
            };
            b.row(sh, i + 1, v, i % 2 == 1);
            double[] add = { repaid, online, given, target, loans, women, 1, d(m.get("overdueAmount")), d(m.get("overdueLoans")), d(m.get("overdueOutstanding")), d(m.get("outstanding")) };
            sum(managers, s(m.get("officerUserId")), mgr.length() > 0 ? mgr : "No officer mapped", s(m.get("officerRole")), add);
            sum(agms, s(m.get("agmUserId")), agm.length() > 0 ? agm : "AGM not mapped", "AGM", add);
            sum(dgms, s(m.get("dgmUserId")), dgm.length() > 0 ? dgm : "DGM not mapped", "DGM", add);
        }
        people(b, "Managers", managers, odOn);
        people(b, "AGMs", agms, odOn);
        people(b, "DGMs", dgms, odOn);
        b.info(new String[][] {
            { "Report", "Employee performance" },
            { "Showing", label },
            { "Sheets", "Mandals (one row per mandal with its owners), Managers, AGMs, DGMs (summed from their mandals)" },
            { "Scope", "Stree Nidhi projects only (LOAN_TYPE = SN)" },
            { "Overdue", odOn ? "Overdue = arrears of today's open loans (as on the snapshot date), not tied to the period chosen" : "not available" },
            { "Downloaded", new SimpleDateFormat("dd-MM-yyyy HH:mm").format(new Date()) }
        });
        return b.bytes();
    }

    private static void sum(Map into, String login, String name, String role, double[] add) {
        String key = login.length() > 0 ? login : "~" + name;
        Object[] e = (Object[]) into.get(key);
        if (e == null) { e = new Object[] { name, login, role, new double[add.length] }; into.put(key, e); }
        double[] t = (double[]) e[3];
        for (int i = 0; i < add.length; i++) t[i] += add[i];
    }

    private static void people(Book b, String sheet, Map list, boolean odOn) {
        String[] head = { "#", "Name", "Login", "Role", "Mandals", "Collected (Rs)", "Online (Rs)", "Manual / cash (Rs)", "Online %",
                          "Cash %", "Amount given (Rs)", "Target (Rs)", "Target achieved %", "Loans", "Women who borrowed",
                          "Overdue (Rs)", "Loans in arrears", "Balance at risk (Rs)", "Total outstanding (Rs)" };
        HSSFSheet sh = b.sheet(sheet, head);
        int n = 0;
        for (Iterator it = list.values().iterator(); it.hasNext();) {
            Object[] e = (Object[]) it.next();
            double[] t = (double[]) e[3];
            double cash = Math.max(0, t[0] - t[1]);
            Object[] v = { Double.valueOf(n + 1), e[0], e[1], e[2], Double.valueOf(t[6]), Double.valueOf(t[0]), Double.valueOf(t[1]),
                           Double.valueOf(cash), pct(t[1], t[0]), pct(cash, t[0]), Double.valueOf(t[2]),
                           t[3] > 0 ? Double.valueOf(t[3]) : null, pct(t[2], t[3]), Double.valueOf(t[4]), Double.valueOf(t[5]),
                           odOn ? Double.valueOf(t[7]) : null, odOn ? Double.valueOf(t[8]) : null, odOn ? Double.valueOf(t[9]) : null, odOn ? Double.valueOf(t[10]) : null };
            b.row(sh, ++n, v, n % 2 == 0);
        }
    }

    private static Double pct(double part, double whole) {
        return whole > 0 ? Double.valueOf(Math.round(part / whole * 1000) / 10.0) : null;
    }

    private static double d(Object o) { return o instanceof Number ? ((Number) o).doubleValue() : 0; }
    private static String s(Object o) { return o == null ? "" : o.toString(); }

    // ---------------- workbook helper (QueryTool look: dark blue header, banded rows, filters) ----------------

    static final class Book {
        final HSSFWorkbook wb = new HSSFWorkbook();
        final HSSFCellStyle head, band, plain, bold;
        final List info = new ArrayList();

        Book() {
            head = wb.createCellStyle();
            head.setFillForegroundColor(HSSFColor.DARK_BLUE.index);
            head.setFillPattern(HSSFCellStyle.SOLID_FOREGROUND);
            HSSFFont hf = wb.createFont();
            hf.setColor(HSSFColor.WHITE.index);
            hf.setBoldweight(HSSFFont.BOLDWEIGHT_BOLD);
            head.setFont(hf);
            band = wb.createCellStyle();
            band.setFillForegroundColor(HSSFColor.LEMON_CHIFFON.index);
            band.setFillPattern(HSSFCellStyle.SOLID_FOREGROUND);
            plain = wb.createCellStyle();
            bold = wb.createCellStyle();
            HSSFFont bf = wb.createFont();
            bf.setBoldweight(HSSFFont.BOLDWEIGHT_BOLD);
            bold.setFont(bf);
        }

        HSSFSheet sheet(String name, String[] cols) {
            HSSFSheet sh = wb.createSheet(name);
            HSSFRow r = sh.createRow(0);
            for (int c = 0; c < cols.length; c++) {
                sh.setColumnWidth(c, c < 3 ? 7000 : 4800);
                HSSFCell cell = r.createCell(c);
                cell.setCellValue(cols[c]);
                cell.setCellStyle(head);
            }
            sh.setAutoFilter(new CellRangeAddress(0, 0, 0, cols.length - 1));
            return sh;
        }

        void row(HSSFSheet sh, int at, Object[] v, boolean banded) {
            put(sh.createRow(at), v, banded ? band : plain);
        }

        void totalRow(HSSFSheet sh, int at, Object[] v) { put(sh.createRow(at), v, bold); }

        private void put(HSSFRow r, Object[] v, HSSFCellStyle st) {
            for (int c = 0; c < v.length; c++) {
                HSSFCell cell = r.createCell(c);
                if (v[c] instanceof Number) cell.setCellValue(Math.round(((Number) v[c]).doubleValue() * 100) / 100.0);
                else if (v[c] != null) cell.setCellValue(v[c].toString());
                cell.setCellStyle(st);
            }
        }

        void info(String[][] lines) {
            HSSFSheet sh = wb.createSheet("About");
            sh.setColumnWidth(0, 6000);
            sh.setColumnWidth(1, 22000);
            for (int i = 0; i < lines.length; i++) {
                HSSFRow r = sh.createRow(i);
                HSSFCell k = r.createCell(0);
                k.setCellValue(lines[i][0]);
                k.setCellStyle(bold);
                r.createCell(1).setCellValue(lines[i][1]);
            }
        }

        byte[] bytes() throws Exception {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            return bos.toByteArray();
        }
    }

    // ---------------- minimal JSON reader for the service's own output ----------------

    private static final class Json {
        private final String s;
        private int i;

        Json(String s) { this.s = s; }

        Object value() {
            skip();
            char c = s.charAt(i);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return string();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            int st = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            return Double.valueOf(s.substring(st, i));
        }

        private Map object() {
            Map m = new LinkedHashMap();
            i++;
            skip();
            if (s.charAt(i) == '}') { i++; return m; }
            while (true) {
                skip();
                String k = string();
                skip();
                i++;                      // ':'
                m.put(k, value());
                skip();
                if (s.charAt(i++) == '}') return m;
            }
        }

        private List array() {
            List l = new ArrayList();
            i++;
            skip();
            if (s.charAt(i) == ']') { i++; return l; }
            while (true) {
                l.add(value());
                skip();
                if (s.charAt(i++) == ']') return l;
            }
        }

        private String string() {
            StringBuffer b = new StringBuffer();
            i++;
            while (true) {
                char c = s.charAt(i++);
                if (c == '"') return b.toString();
                if (c == '\\') {
                    char e = s.charAt(i++);
                    if (e == 'u') { b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                    else if (e == 'n') b.append('\n');
                    else if (e == 't') b.append('\t');
                    else if (e == 'r') b.append('\r');
                    else b.append(e);
                } else {
                    b.append(c);
                }
            }
        }

        private void skip() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    }
}
