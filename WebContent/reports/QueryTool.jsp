<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.util.*"%>
<%@ page import="java.security.SecureRandom"%>
<%
/*
 * QueryTool.jsp
 * SERP-AP Secure SQL Query Tool
 * Added HRMS / SNBSAP target DB dropdown.
 * ADDED BY CHINTALA MAHINDRA
 */
ArrayList qtUser    = (ArrayList) session.getAttribute("QT_USER");
boolean   loggedIn  = (qtUser != null);
String    userName  = loggedIn ? (String) qtUser.get(0) : "";
String    fullName  = loggedIn ? (String) qtUser.get(1) : "";
String    userRole  = loggedIn ? (String) qtUser.get(2) : "";
String    ctxPath   = request.getContextPath();
String    svcUrl    = ctxPath + "/QueryTool";

boolean isAdminRole = loggedIn && "ADMIN".equalsIgnoreCase(userRole);

String auditNavToken = "";
if (isAdminRole) {
    SecureRandom navRnd = new SecureRandom();
    byte[] navBytes = new byte[16];
    navRnd.nextBytes(navBytes);
    StringBuffer navSb = new StringBuffer();
    for (int nb = 0; nb < navBytes.length; nb++) {
        String hex = Integer.toHexString(navBytes[nb] & 0xFF);
        if (hex.length() < 2) { navSb.append('0'); }
        navSb.append(hex);
    }
    auditNavToken = navSb.toString();
    session.setAttribute("QT_AUDIT_NAV_TOKEN", auditNavToken);
}
%>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SQL Query Tool - SERP AP</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
:root {
    --bg:#F5F7FA; --panel:#FFFFFF; --panel2:#FAFBFC; --border:#DDE2E7; --border2:#E7EAEE;
    --text:#1F2937; --text2:#667085; --muted:#9AA5B1;
    --blue:#2563EB; --blue-dark:#1D4ED8; --blue-lt:rgba(37,99,235,0.08); --blue-lt2:rgba(37,99,235,0.14);
    --green:#16A34A; --green-lt:rgba(22,163,74,0.10);
    --amber:#D97706; --amber-lt:rgba(217,119,6,0.10);
    --red:#DC2626; --red-lt:rgba(220,38,38,0.10);
    --violet:#7C3AED; --violet-lt:rgba(124,58,237,0.10);
    --editor-bg:#FAFBFC;
    --r1:5px; --r2:8px; --r3:12px;
    --shadow:0 6px 24px rgba(16,24,40,0.10);
    --shadow-sm:0 1px 2px rgba(16,24,40,0.06);
}
body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); font-size:13px; line-height:1.5; height:100vh; overflow:hidden; }
::-webkit-scrollbar { width:8px; height:8px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:#C7CFD8; border-radius:99px; }
::-webkit-scrollbar-thumb:hover { background:#AEB8C2; }
button { font-family:inherit; }
.app-shell { display:flex; flex-direction:column; height:100vh; }

.topbar { height:46px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; background:var(--panel); border-bottom:1px solid var(--border); flex-shrink:0; }
.tb-left { display:flex; align-items:center; gap:10px; }
.tb-logo { width:26px; height:26px; border-radius:7px; background:linear-gradient(135deg, var(--blue), #4F8CFF); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.tb-logo svg { width:14px; height:14px; stroke:#fff; fill:none; stroke-width:2; stroke-linecap:round; }
.tb-title { font-size:13.5px; font-weight:700; color:var(--text); }
.tb-badge { padding:2px 8px; border-radius:4px; font-size:9px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; background:var(--blue-lt); color:var(--blue-dark); }
.tb-right { display:flex; align-items:center; gap:8px; }
.tb-user-chip { display:flex; align-items:center; gap:6px; padding:4px 10px; border-radius:var(--r2); background:var(--panel2); border:1px solid var(--border); font-size:11.5px; color:var(--text2); }
.tb-user-chip strong { color:var(--text); font-weight:600; }
.tb-role-pill { padding:1px 7px; border-radius:99px; font-size:9px; font-weight:700; letter-spacing:0.4px; background:var(--green-lt); color:var(--green); }
.tb-role-pill.readonly { background:var(--amber-lt); color:var(--amber); }
.tb-btn { padding:6px 12px; border-radius:var(--r2); font-size:11.5px; font-weight:600; border:1px solid var(--border); background:var(--panel); color:var(--text2); cursor:pointer; transition:all .12s; display:flex; align-items:center; gap:5px; }
.tb-btn:hover { border-color:var(--blue); color:var(--blue); background:var(--blue-lt); }
.tb-btn-red:hover { border-color:var(--red); color:var(--red); background:var(--red-lt); }
.tb-btn-primary { background:var(--blue); color:#fff; border-color:var(--blue); }
.tb-btn-primary:hover { background:var(--blue-dark); border-color:var(--blue-dark); color:#fff; }

.toolbar { display:flex; align-items:center; gap:4px; padding:7px 12px; background:var(--panel); border-bottom:1px solid var(--border); flex-wrap:wrap; flex-shrink:0; }
.tgroup { display:flex; align-items:center; gap:4px; padding:0 6px; position:relative; }
.tgroup + .tgroup { border-left:1px solid var(--border2); }
.tgroup:first-child { padding-left:0; }
.tool-btn { display:flex; align-items:center; gap:6px; padding:6px 11px; border-radius:var(--r2); font-size:11.5px; font-weight:600; border:1px solid transparent; background:transparent; color:var(--text2); cursor:pointer; transition:all .12s; white-space:nowrap; }
.tool-btn:hover { background:var(--panel2); border-color:var(--border); color:var(--text); }
.tool-btn svg { width:13px; height:13px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; flex-shrink:0; }
.tool-btn:disabled { opacity:.45; cursor:not-allowed; }
.tool-btn:disabled:hover { background:transparent; border-color:transparent; color:var(--text2); }
.tool-btn-exec { background:var(--blue); color:#fff; border-color:var(--blue); font-weight:700; padding:7px 16px; }
.tool-btn-exec:hover { background:var(--blue-dark); border-color:var(--blue-dark); color:#fff; }
.tool-btn-cancel { background:var(--red); color:#fff; border-color:var(--red); font-weight:700; }
.tool-btn-cancel:hover { background:#B91C1C; border-color:#B91C1C; color:#fff; }
.tool-label { font-size:9px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; color:var(--muted); margin-right:4px; }
.dropdown-wrap { position:relative; }
.dropdown-menu { display:none; position:absolute; top:calc(100% + 4px); left:0; min-width:190px; background:var(--panel); border:1px solid var(--border); border-radius:var(--r2); box-shadow:var(--shadow); z-index:400; padding:4px; flex-direction:column; }
.dropdown-menu.open { display:flex; }
.dropdown-item { padding:7px 10px; border-radius:var(--r1); font-size:12px; color:var(--text); cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.dropdown-item:hover { background:var(--blue-lt); color:var(--blue-dark); }
.dropdown-item .k { font-size:9px; color:var(--muted); font-family:'JetBrains Mono',monospace; }
.dropdown-divider { height:1px; background:var(--border2); margin:4px 2px; }
.timeout-wrap { display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--text2); margin-left:auto; }
.timeout-wrap select { padding:5px 8px; border-radius:var(--r2); border:1px solid var(--border); background:var(--panel2); color:var(--text); font-size:11.5px; font-family:inherit; outline:none; }
.layout-btns { display:flex; gap:2px; background:var(--panel2); border:1px solid var(--border); border-radius:var(--r2); padding:2px; }
.layout-btn { padding:4px 8px; border-radius:5px; border:none; background:transparent; color:var(--text2); font-size:10.5px; font-weight:600; cursor:pointer; }
.layout-btn:hover { background:var(--panel); color:var(--text); }
.layout-btn.active { background:var(--panel); color:var(--blue); box-shadow:var(--shadow-sm); }

/* DB dropdown in toolbar */
.db-select {
    padding:6px 12px;
    border:1px solid var(--border);
    border-radius:var(--r2);
    background:var(--panel2);
    color:var(--text);
    font-size:11.5px;
    font-weight:700;
    outline:none;
    font-family:inherit;
    cursor:pointer;
    letter-spacing:0.3px;
    transition:all .12s;
}
.db-select:focus { border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-lt); }
.db-select.snbsap { background:var(--violet-lt); color:var(--violet); border-color:rgba(124,58,237,0.3); }

.workspace { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
.editor-panel { display:flex; flex-direction:column; min-height:60px; background:var(--panel); overflow:hidden; }
.editor-outer { position:relative; flex:1; overflow:hidden; display:flex; }
.line-gutter { width:46px; flex-shrink:0; background:var(--panel2); border-right:1px solid var(--border2); padding:12px 0; overflow:hidden; text-align:center; }
.line-num { display:block; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); line-height:1.7; }
.code-surface { position:relative; flex:1; overflow:hidden; }
#sqlHighlight, #sqlEditor { position:absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; margin:0; border:none; font-family:'JetBrains Mono',monospace; font-size:13px; line-height:1.7; padding:12px 16px; white-space:pre; overflow:auto; tab-size:2; }
#sqlHighlight { background:var(--editor-bg); color:var(--text); pointer-events:none; z-index:1; overflow:hidden; }
#sqlEditor { background:transparent; color:transparent; caret-color:var(--text); resize:none; outline:none; z-index:2; position:relative; }
#sqlEditor::placeholder { color:var(--muted); }
.tok-kw { color:#2563EB; font-weight:600; }
.tok-fn { color:#7C3AED; font-weight:600; }
.tok-str { color:#16A34A; }
.tok-cmt { color:#9AA5B1; font-style:italic; }
.tok-num { color:#D97706; }
.tok-op { color:#DC2626; }

.splitter { height:8px; flex-shrink:0; background:var(--bg); cursor:row-resize; position:relative; border-top:1px solid var(--border); border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:center; }
.splitter:hover, .splitter.dragging { background:var(--blue-lt); }
.splitter-grip { width:36px; height:3px; border-radius:99px; background:var(--border); }
.splitter:hover .splitter-grip, .splitter.dragging .splitter-grip { background:var(--blue); }

.meta-strip { display:flex; align-items:center; gap:16px; padding:5px 16px; background:var(--panel2); border-top:1px solid var(--border2); font-size:10.5px; color:var(--text2); flex-shrink:0; }
.meta-strip b { color:var(--text); }

.results-panel { display:flex; flex-direction:column; flex:1; min-height:60px; background:var(--panel); overflow:hidden; }
.status-bar { display:flex; align-items:center; background:var(--panel2); border-bottom:1px solid var(--border); flex-shrink:0; flex-wrap:wrap; }
.stat-item { display:flex; align-items:center; gap:5px; padding:7px 14px; border-right:1px solid var(--border2); font-size:11px; color:var(--text2); white-space:nowrap; }
.stat-val { font-weight:700; font-family:'JetBrains Mono',monospace; }
.stat-ok   { color:var(--green); }
.stat-err  { color:var(--red); }
.stat-info { color:var(--blue); }
.stat-warn { color:var(--amber); }
.stat-violet { color:var(--violet); }

.exec-timer { display:none; align-items:center; gap:6px; font-size:11px; color:var(--blue); font-weight:600; padding:7px 14px; }
.exec-timer.show { display:flex; }
.exec-dot { width:6px; height:6px; border-radius:50%; background:var(--blue); animation:qtPulse 1s ease-in-out infinite; }
@keyframes qtPulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }

.result-tabs { display:flex; align-items:center; gap:2px; padding:6px 12px 0; background:var(--panel); border-bottom:1px solid var(--border); overflow-x:auto; flex-shrink:0; }
.result-tab { padding:7px 14px; font-size:11.5px; font-weight:600; color:var(--text2); cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; border-radius:var(--r1) var(--r1) 0 0; }
.result-tab:hover { background:var(--panel2); color:var(--text); }
.result-tab.active { color:var(--blue); border-bottom-color:var(--blue); background:var(--blue-lt); }
.result-tab .rc { margin-left:5px; font-size:9px; color:var(--muted); }
.result-tab.active .rc { color:var(--blue); }

.results-area { flex:1; overflow:auto; padding:12px 16px; position:relative; }
.spinner-overlay { display:none; position:absolute; inset:0; background:rgba(255,255,255,0.75); z-index:100; align-items:center; justify-content:center; }
.spinner-overlay.show { display:flex; }
.spinner { width:34px; height:34px; border:3px solid var(--border); border-top:3px solid var(--blue); border-radius:50%; animation:qtSpin .8s linear infinite; }
@keyframes qtSpin { to { transform:rotate(360deg); } }

.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:200px; color:var(--muted); text-align:center; }
.empty-state svg { width:34px; height:34px; stroke:currentColor; fill:none; stroke-width:1.3; margin-bottom:10px; opacity:.5; }
.empty-title { font-size:13.5px; font-weight:700; color:var(--text); margin-bottom:4px; }
.empty-sub { font-size:11.5px; color:var(--text2); margin-bottom:14px; }
.empty-shortcuts { font-size:10.5px; color:var(--muted); line-height:1.9; }
.sb-key { background:var(--panel2); border:1px solid var(--border); padding:1px 5px; border-radius:3px; font-size:9px; font-family:'JetBrains Mono',monospace; color:var(--text2); }

.error-box { background:var(--red-lt); border:1px solid rgba(220,38,38,0.25); border-radius:var(--r2); padding:14px 16px; margin-bottom:14px; }
.error-box-title { font-size:12px; font-weight:700; color:var(--red); margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; }
.error-box-copy { font-size:10px; font-weight:700; color:var(--red); cursor:pointer; border:1px solid rgba(220,38,38,0.3); padding:2px 8px; border-radius:4px; }
.error-box-copy:hover { background:rgba(220,38,38,0.12); }
.error-box-msg { font-size:11.5px; font-family:'JetBrains Mono',monospace; color:#7F1D1D; line-height:1.6; white-space:pre-wrap; word-break:break-word; }

.dml-result { background:var(--green-lt); border:1px solid rgba(22,163,74,0.25); border-radius:var(--r2); padding:18px 20px; margin-bottom:14px; display:flex; align-items:center; gap:14px; }
.dml-icon { font-size:24px; flex-shrink:0; }
.dml-msg { font-size:13.5px; font-weight:700; color:var(--green); }
.dml-sub { font-size:11px; color:var(--text2); margin-top:3px; }

.rt-controls { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.rt-filter-input { flex:1; max-width:280px; padding:6px 10px; border-radius:var(--r2); border:1px solid var(--border); background:var(--panel); color:var(--text); font-size:12px; outline:none; transition:border .15s; }
.rt-filter-input:focus { border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-lt); }
.rt-filter-count { font-size:11px; color:var(--text2); white-space:nowrap; }
.rt-tools { margin-left:auto; display:flex; gap:6px; }
.rt-mini-btn { padding:5px 10px; border-radius:var(--r1); border:1px solid var(--border); background:var(--panel); color:var(--text2); font-size:10.5px; font-weight:600; cursor:pointer; }
.rt-mini-btn:hover { border-color:var(--blue); color:var(--blue); background:var(--blue-lt); }

.truncated-banner { background:var(--amber-lt); border:1px solid rgba(217,119,6,0.25); color:#92400E; border-radius:var(--r2); padding:9px 14px; font-size:11.5px; margin-bottom:10px; display:flex; align-items:center; gap:8px; }

table.rt { border-collapse:collapse; width:100%; font-size:12px; }
.table-wrap { overflow:auto; border-radius:var(--r2); border:1px solid var(--border); margin-bottom:6px; max-height:calc(100% - 40px); }
table.rt thead { position:sticky; top:0; z-index:5; }
table.rt thead th { padding:8px 12px; font-size:10px; font-weight:700; letter-spacing:.4px; text-transform:uppercase; color:var(--text2); background:var(--panel2); border-bottom:1px solid var(--border); white-space:nowrap; text-align:left; cursor:pointer; user-select:none; transition:color .12s; }
table.rt thead th:hover { color:var(--blue); background:var(--blue-lt); }
table.rt tbody tr { border-bottom:1px solid var(--border2); transition:background .1s; }
table.rt tbody tr:nth-child(even) { background:#FAFBFC; }
table.rt tbody tr:last-child { border-bottom:none; }
table.rt tbody tr:hover { background:var(--blue-lt); }
table.rt tbody td { padding:7px 12px; font-family:'JetBrains Mono',monospace; font-size:11.5px; color:var(--text); white-space:nowrap; max-width:380px; overflow:hidden; text-overflow:ellipsis; cursor:default; }
table.rt tbody td:hover { background:var(--blue-lt2); }
.null-cell { color:var(--muted) !important; font-style:italic; }
.rt-empty { padding:32px 20px; text-align:center; color:var(--muted); font-size:12px; }
@keyframes fadeUp { from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
.fade-in { animation:fadeUp .16s ease both; }

.overlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,0.45); z-index:999; align-items:center; justify-content:center; }
.overlay.open { display:flex; }
.modal-box { background:var(--panel); border-radius:var(--r3); border:1px solid var(--border); box-shadow:var(--shadow); width:420px; max-width:95vw; overflow:hidden; }
.modal-hdr { display:flex; align-items:center; gap:12px; padding:20px 24px 16px; border-bottom:1px solid var(--border); }
.modal-icon { width:38px; height:38px; border-radius:var(--r2); background:var(--blue-lt); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.modal-icon svg { width:17px; height:17px; stroke:var(--blue); fill:none; stroke-width:2; stroke-linecap:round; }
.modal-title { font-size:14.5px; font-weight:800; color:var(--text); }
.modal-subtitle { font-size:11px; color:var(--text2); margin-top:2px; }
.modal-body { padding:20px 24px; }
.form-group { margin-bottom:14px; }
.form-label { display:block; font-size:10.5px; font-weight:700; color:var(--text2); letter-spacing:.4px; text-transform:uppercase; margin-bottom:6px; }
.form-input { width:100%; padding:9px 12px; border-radius:var(--r2); border:1px solid var(--border); background:var(--panel2); color:var(--text); font-size:13px; outline:none; transition:border .15s; }
.form-input:focus { border-color:var(--blue); box-shadow:0 0 0 3px var(--blue-lt); background:var(--panel); }
.form-error { font-size:11px; min-height:16px; margin-top:6px; }
.btn-login { width:100%; padding:10px; border-radius:var(--r2); border:none; background:var(--blue); color:#fff; font-size:13px; font-weight:700; cursor:pointer; transition:background .15s; margin-top:6px; }
.btn-login:hover { background:var(--blue-dark); }
.btn-login:disabled { opacity:.6; cursor:not-allowed; }

.confirm-box { background:var(--panel); border-radius:var(--r3); border:1px solid var(--border); box-shadow:var(--shadow); width:580px; max-width:96vw; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
.confirm-hdr { display:flex; align-items:flex-start; gap:12px; padding:18px 20px 14px; border-bottom:1px solid var(--border); flex-shrink:0; }
.confirm-icon { width:36px; height:36px; border-radius:var(--r2); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.ci-warn { background:var(--amber-lt); }
.ci-danger { background:var(--red-lt); }
.confirm-title { font-size:14px; font-weight:800; color:var(--text); }
.confirm-sub { font-size:11px; color:var(--text2); margin-top:2px; }
.confirm-body { padding:16px 20px; overflow-y:auto; flex:1; }
.confirm-info-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:var(--r2); background:var(--panel2); margin-bottom:8px; font-size:12px; }
.confirm-info-label { font-weight:700; color:var(--text2); min-width:130px; flex-shrink:0; }
.confirm-info-val { font-family:'JetBrains Mono',monospace; color:var(--text); font-weight:600; }
.confirm-warn-box { padding:10px 14px; border-radius:var(--r2); font-size:12px; margin-top:10px; }
.confirm-warn-amber { background:var(--amber-lt); border:1px solid rgba(217,119,6,0.25); color:#92400E; }
.confirm-warn-red { background:var(--red-lt); border:1px solid rgba(220,38,38,0.25); color:#7F1D1D; }
.confirm-preview-label { font-size:10px; font-weight:700; letter-spacing:.6px; text-transform:uppercase; color:var(--text2); margin:12px 0 6px; }
.confirm-input-wrap { margin-top:12px; }
.confirm-input-desc { font-size:11px; color:var(--text2); margin-bottom:7px; }
.confirm-input { width:100%; padding:9px 12px; border-radius:var(--r2); border:1px solid var(--border); background:var(--panel2); color:var(--text); font-family:'JetBrains Mono',monospace; font-size:13px; outline:none; transition:border .15s; }
.confirm-input:focus { border-color:var(--red); }
.confirm-footer { padding:12px 20px; border-top:1px solid var(--border); display:flex; align-items:center; gap:8px; flex-direction:row-reverse; flex-shrink:0; }
.btn-confirm { padding:8px 18px; border-radius:var(--r2); border:none; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; }
.btn-confirm-amber { background:var(--amber); color:#fff; }
.btn-confirm-amber:hover { filter:brightness(0.92); }
.btn-confirm-red { background:var(--red); color:#fff; }
.btn-confirm-red:hover { filter:brightness(0.9); }
.btn-confirm-disabled { opacity:.4; pointer-events:none; }
.btn-cancel { padding:8px 14px; border-radius:var(--r2); border:1px solid var(--border); background:transparent; color:var(--text2); font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
.btn-cancel:hover { border-color:var(--text2); color:var(--text); }

.side-panel { display:none; position:fixed; top:46px; right:0; bottom:0; width:380px; background:var(--panel); border-left:1px solid var(--border); z-index:300; flex-direction:column; overflow:hidden; box-shadow:-8px 0 24px rgba(16,24,40,0.08); }
.side-panel.open { display:flex; }
.sp-header { padding:14px 16px 10px; border-bottom:1px solid var(--border); flex-shrink:0; }
.sp-header-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.sp-title { font-size:13px; font-weight:700; color:var(--text); }
.sp-close { width:24px; height:24px; border-radius:var(--r1); border:1px solid var(--border); background:transparent; color:var(--text2); cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; transition:all .12s; }
.sp-close:hover { background:var(--red-lt); border-color:var(--red); color:var(--red); }
.sp-search { width:100%; padding:7px 10px; border-radius:var(--r2); border:1px solid var(--border); background:var(--panel2); color:var(--text); font-size:12px; outline:none; }
.sp-search:focus { border-color:var(--blue); }
.sp-list { overflow-y:auto; flex:1; }
.sp-item { padding:11px 16px; border-bottom:1px solid var(--border2); cursor:pointer; transition:background .1s; }
.sp-item:hover { background:var(--panel2); }
.sp-item-name { font-weight:700; font-size:11.5px; color:var(--text); margin-bottom:3px; }
.sp-sql { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--text); line-height:1.4; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; margin-bottom:4px; }
.sp-ts { font-size:10px; color:var(--muted); margin-bottom:6px; }
.sp-actions { display:flex; gap:5px; }
.sp-act { padding:3px 9px; border-radius:var(--r1); font-size:9.5px; font-weight:700; border:1px solid var(--border); background:transparent; color:var(--text2); cursor:pointer; transition:all .12s; }
.sp-act:hover { border-color:var(--blue); color:var(--blue); background:var(--blue-lt); }
.sp-act.danger:hover { border-color:var(--red); color:var(--red); background:var(--red-lt); }
.sp-empty { padding:40px 16px; text-align:center; color:var(--muted); font-size:12px; }

#sqlHighlight, #sqlHighlightCode, #sqlEditor {
    font-family:'JetBrains Mono',monospace !important;
    font-size:13px !important;
    line-height:1.7 !important;
    letter-spacing:0 !important;
    white-space:pre-wrap !important;
}
#sqlEditor { background:transparent; color:transparent; -webkit-text-fill-color:transparent; caret-color:#1F2937; }

@media (max-width:900px) {
    .toolbar { gap:2px; }
    .tgroup { padding:0 3px; }
    .tool-btn span.lbl { display:none; }
    .side-panel { width:92vw; }
}
</style>
</head>
<body>

<div class="app-shell">

<!-- HEADER -->
<div class="topbar">
  <div class="tb-left">
    <div class="tb-logo"><svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
    <span class="tb-title">SQL Query Tool</span>
    <span class="tb-badge">SERP AP</span>
  </div>
  <div class="tb-right">
    <% if (loggedIn) { %>
    <div class="tb-user-chip">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      <strong><%=fullName%></strong>
      <span class="tb-role-pill<%= isAdminRole ? "" : " readonly" %>"><%=userRole%></span>
    </div>
    <% if (isAdminRole) { %>
    <button class="tb-btn" onclick="goAudit()">Audit Log</button>
    <% } %>
    <button class="tb-btn tb-btn-red" onclick="doLogout()">Logout</button>
    <% } else { %>
    <button class="tb-btn tb-btn-primary" onclick="openLoginModal()">Login</button>
    <% } %>
  </div>
</div>

<% if (loggedIn) { %>

<!-- TOOLBAR -->
<div class="toolbar">

  <div class="tgroup">
    <button class="tool-btn tool-btn-exec" id="execBtn" onclick="executeQuery()" title="Execute (F5 / Ctrl+Enter)">
      <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span class="lbl">Execute</span>
    </button>
    <button class="tool-btn tool-btn-cancel" id="cancelBtn" onclick="cancelQuery()" style="display:none;" title="Cancel running query">
      <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
      <span class="lbl">Cancel</span>
    </button>
  </div>

  <!-- TARGET DB SELECTOR -->
  <div class="tgroup">
    <span class="tool-label">DB</span>
    <select id="dbSelect" class="db-select" onchange="onDbChange()" title="Target database">
      <option value="HRMS">HRMS</option>
      <option value="SNBSAP">SNBSAP</option>
    </select>
  </div>

  <div class="tgroup">
    <button class="tool-btn" onclick="formatEditor()" title="Format (Ctrl+Shift+F)">
      <svg viewBox="0 0 24 24"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
      <span class="lbl">Format</span>
    </button>
    <button class="tool-btn" onclick="clearEditor()" title="Clear (Ctrl+K)">
      <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      <span class="lbl">Clear</span>
    </button>
    <div class="dropdown-wrap">
      <button class="tool-btn" onclick="toggleTemplatesMenu(event)" title="Insert a query template">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
        <span class="lbl">Templates</span>
        <svg viewBox="0 0 24 24" style="width:9px;height:9px;"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="dropdown-menu" id="templatesMenu">
        <div class="dropdown-item" onclick="loadTemplate('select')">SELECT</div>
        <% if (isAdminRole) { %>
        <div class="dropdown-item" onclick="loadTemplate('update')">UPDATE</div>
        <div class="dropdown-item" onclick="loadTemplate('delete')">DELETE</div>
        <div class="dropdown-item" onclick="loadTemplate('exec')">EXEC / SP</div>
        <% } %>
        <div class="dropdown-item" onclick="loadTemplate('nolock')">WITH (NOLOCK)</div>
      </div>
    </div>
  </div>

  <div class="tgroup">
    <button class="tool-btn" onclick="saveFavorite()" title="Save Favorite (Ctrl+S)">
      <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      <span class="lbl">Save</span>
    </button>
    <button class="tool-btn" onclick="openHistory()" title="Query History (Ctrl+H)">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span class="lbl">History</span>
      <span class="rt-filter-count" id="historyCountInline"></span>
    </button>
    <button class="tool-btn" onclick="openFavorites()" title="Favorite Queries">
      <svg viewBox="0 0 24 24"><polygon points="12 2 15 8.5 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 8.5 12 2"/></svg>
      <span class="lbl">Favorites</span>
      <span class="rt-filter-count" id="favoritesCountInline"></span>
    </button>
  </div>

  <div class="tgroup">
    <div class="dropdown-wrap">
      <button class="tool-btn" onclick="toggleExportMenu(event)" title="Export results">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="lbl">Export</span>
        <svg viewBox="0 0 24 24" style="width:9px;height:9px;"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="dropdown-menu" id="exportMenu">
        <div class="dropdown-item" onclick="exportExcel()">Export to Excel</div>
        <div class="dropdown-item" onclick="exportCsv()">Export to CSV</div>
      </div>
    </div>
  </div>

  <div class="tgroup">
    <span class="tool-label">Layout</span>
    <div class="layout-btns">
      <button class="layout-btn" onclick="setLayout('editor')" title="Editor Focus (70/30)">Editor</button>
      <button class="layout-btn active" id="layoutSplitBtn" onclick="setLayout('split')" title="Balanced 50/50">Split</button>
      <button class="layout-btn" onclick="setLayout('results')" title="Results Focus (30/70)">Results</button>
    </div>
  </div>

  <div class="timeout-wrap">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    Timeout:
    <select id="timeoutSel">
      <option value="60">1 min</option>
      <option value="300" selected>5 min</option>
      <option value="600">10 min</option>
      <option value="1800">30 min</option>
    </select>
  </div>

</div>

<!-- WORKSPACE -->
<div class="workspace" id="workspace">

  <div class="editor-panel" id="editorPanel">
    <div class="editor-outer">
      <div class="line-gutter" id="lineGutter"><span class="line-num">1</span></div>
      <div class="code-surface">
        <pre id="sqlHighlight"><code id="sqlHighlightCode"></code></pre>
        <textarea id="sqlEditor" spellcheck="false"
          placeholder="-- Enter SQL query here&#10;-- SELECT, INSERT, UPDATE, DELETE, EXEC, ALTER, DROP, TRUNCATE&#10;-- Press F5 or Ctrl+Enter to run"
          onkeydown="handleEditorKey(event)" oninput="onEditorInput()" onscroll="syncEditorScroll()"></textarea>
      </div>
    </div>
    <div class="meta-strip">
      <span>Type: <b id="metaType">—</b></span>
      <span>Lines: <b id="metaLines">1</b></span>
      <span>Characters: <b id="metaChars">0</b></span>
      <span id="unsavedFlag" style="display:none;color:var(--amber);">&#9679; Unsaved query</span>
    </div>
  </div>

  <div class="splitter" id="splitter"><div class="splitter-grip"></div></div>

  <div class="results-panel" id="resultsPanel">

    <div class="status-bar">
      <div class="stat-item">Target:&nbsp;<span class="stat-val stat-info" id="statTarget">HRMS</span></div>
      <div class="stat-item">Type:&nbsp;<span class="stat-val stat-info" id="statType">—</span></div>
      <div class="stat-item">Time:&nbsp;<span class="stat-val" id="statTime">—</span></div>
      <div class="stat-item">Rows:&nbsp;<span class="stat-val" id="statRows">—</span></div>
      <div class="stat-item">Affected:&nbsp;<span class="stat-val" id="statAffected">—</span></div>
      <div class="stat-item">Result Sets:&nbsp;<span class="stat-val" id="statSets">—</span></div>
      <div class="stat-item">User:&nbsp;<span class="stat-val"><%=fullName%></span></div>
      <div class="stat-item" style="border-right:none;">Status:&nbsp;<span class="stat-val" id="statStatus">Ready</span></div>
      <div class="exec-timer" id="execTimer"><span class="exec-dot"></span><span id="execTimerText">Executing… 0.0s</span></div>
    </div>

    <div class="result-tabs" id="resultTabs" style="display:none;"></div>

    <div class="results-area" id="resultsArea">
      <div class="spinner-overlay" id="loadingSpinner"><div class="spinner"></div></div>

      <div class="empty-state" id="emptyState">
        <svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <div class="empty-title">Ready to execute</div>
        <div class="empty-sub">Pick a target DB in the toolbar, then write a SQL query above.</div>
        <div class="empty-shortcuts">
          <span class="sb-key">F5</span> / <span class="sb-key">Ctrl+Enter</span> Execute&nbsp;&nbsp;
          <span class="sb-key">Ctrl+H</span> History&nbsp;&nbsp;
          <span class="sb-key">Ctrl+Shift+F</span> Format&nbsp;&nbsp;
          <span class="sb-key">Ctrl+K</span> Clear
        </div>
      </div>

      <div id="resultsContent" style="display:none;"></div>
    </div>
  </div>

</div>

<!-- HISTORY PANEL -->
<div class="side-panel" id="historyPanel">
  <div class="sp-header">
    <div class="sp-header-row">
      <span class="sp-title">Query History</span>
      <button class="sp-close" onclick="closeHistory()">&#10005;</button>
    </div>
    <input type="text" class="sp-search" id="historySearch" placeholder="Search history…" oninput="renderHistoryList()">
  </div>
  <div class="sp-list" id="historyList"><div class="sp-empty">Loading...</div></div>
</div>

<!-- FAVORITES PANEL -->
<div class="side-panel" id="favoritesPanel">
  <div class="sp-header">
    <div class="sp-header-row">
      <span class="sp-title">Favorite Queries</span>
      <button class="sp-close" onclick="closeFavorites()">&#10005;</button>
    </div>
    <input type="text" class="sp-search" id="favoritesSearch" placeholder="Search favorites…" oninput="renderFavoritesList()">
  </div>
  <div class="sp-list" id="favoritesList"><div class="sp-empty">Loading...</div></div>
</div>

<!-- CONFIRM POPUP -->
<div class="overlay" id="confirmOverlay">
  <div class="confirm-box">
    <div class="confirm-hdr">
      <div class="confirm-icon" id="confirmIcon"></div>
      <div><div class="confirm-title" id="confirmTitle"></div><div class="confirm-sub" id="confirmSub"></div></div>
    </div>
    <div class="confirm-body" id="confirmBody"></div>
    <div class="confirm-footer">
      <button class="btn-confirm" id="confirmExecBtn" onclick="doConfirmedExecute()"></button>
      <button class="btn-cancel" onclick="closeConfirm()">Cancel</button>
    </div>
  </div>
</div>

<% } /* end if loggedIn */ %>

<!-- LOGIN OVERLAY -->
<div class="overlay" id="loginOverlay" <% if (loggedIn) { %>style="display:none;"<% } else { %>class="overlay open"<% } %>>
  <div class="modal-box">
    <div class="modal-hdr">
      <div class="modal-icon"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
      <div><div class="modal-title">Query Tool — Authentication</div><div class="modal-subtitle">Access restricted. Enter your Query Tool credentials.</div></div>
    </div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">Username</label><input class="form-input" type="text" id="loginUser" placeholder="Enter username" autocomplete="username"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="password" id="loginPass" placeholder="Enter password" autocomplete="current-password" onkeydown="if(event.key==='Enter') doLogin()"></div>
      <div class="form-error" id="loginError"></div>
      <button class="btn-login" id="loginBtn" onclick="doLogin()">Authenticate</button>
    </div>
  </div>
</div>

<!-- HIDDEN DOWNLOAD FORM -->
<form id="downloadForm" method="post" action="<%=svcUrl%>" style="display:none;">
  <input type="hidden" name="action" id="dlAction">
  <input type="hidden" name="queryId" id="dlQueryId">
  <input type="hidden" name="timeout" id="dlTimeout">
  <input type="hidden" name="target" id="dlTarget">
</form>

</div>

<script type="text/javascript">

/* ═══════════════════════════════════════════════════════
   GLOBALS
   ═══════════════════════════════════════════════════════ */
var SERVLET_URL = '<%=svcUrl%>';
var LOGGED_IN   = <%=loggedIn%>;
var IS_ADMIN    = <%=isAdminRole%>;
var AUDIT_NAV_TOKEN = '<%=auditNavToken%>';
var pendingSql  = '';
var historyData = [];
var favoritesData = [];
var lastExecutedSql = '';
var currentXhr = null;
var queryRunning = false;
var execTimerHandle = null;
var execStartTs = 0;
var activeResultTab = 0;

var CURRENT_TARGET = (function() {
    try { return sessionStorage.getItem('qtTarget') || 'HRMS'; }
    catch (e) { return 'HRMS'; }
})();

/* ═══════════════════════════════════════════════════════
   TARGET DB
   ═══════════════════════════════════════════════════════ */
function onDbChange() {
    var sel = document.getElementById('dbSelect');
    if (!sel) return;
    CURRENT_TARGET = sel.value;
    try { sessionStorage.setItem('qtTarget', CURRENT_TARGET); } catch (e) {}
    applyTargetStyle();
    showEmptyState();
    resetStats();
}

function applyTargetStyle() {
    var sel = document.getElementById('dbSelect');
    if (sel) {
        if (CURRENT_TARGET === 'SNBSAP') sel.className = 'db-select snbsap';
        else sel.className = 'db-select';
    }
    var el = document.getElementById('statTarget');
    if (el) {
        el.innerHTML = CURRENT_TARGET;
        el.className = (CURRENT_TARGET === 'SNBSAP') ? 'stat-val stat-violet' : 'stat-val stat-info';
    }
}

/* ═══════════════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════════════ */
function openLoginModal() {
    var ov = document.getElementById('loginOverlay');
    if (ov) {
        ov.className = 'overlay open';
        setTimeout(function() { var el = document.getElementById('loginUser'); if (el) el.focus(); }, 150);
    }
}

function doLogin() {
    var userEl = document.getElementById('loginUser');
    var passEl = document.getElementById('loginPass');
    var btnEl  = document.getElementById('loginBtn');
    var username = userEl ? userEl.value.trim() : '';
    var password = passEl ? passEl.value : '';

    if (username.length === 0 || password.length === 0) { setLoginError('Please enter username and password.'); return; }
    setLoginError('Authenticating...', 'var(--blue)');
    if (btnEl) btnEl.disabled = true;

    ajaxPost(SERVLET_URL + '?action=login', { username: username, password: password },
        function(responseText) {
            try {
                var result = JSON.parse(responseText);
                if (result.status === 'ok') {
                    setLoginError('Success! Loading...', 'var(--green)');
                    setTimeout(function() { window.location.href = SERVLET_URL + '?action=page'; }, 350);
                } else {
                    setLoginError(result.message || 'Authentication failed.');
                    if (btnEl) btnEl.disabled = false;
                }
            } catch (e) { setLoginError('Unexpected server response.'); if (btnEl) btnEl.disabled = false; }
        },
        function(statusCode) { setLoginError('Network error (' + statusCode + '). Try again.'); if (btnEl) btnEl.disabled = false; }
    );
}
function setLoginError(msg, color) {
    var el = document.getElementById('loginError');
    if (el) { el.innerHTML = escHtml(msg); el.style.color = color || 'var(--red)'; }
}

function doLogout() {
    if (confirm('Are you sure you want to logout?')) { window.location.href = SERVLET_URL + '?action=logout'; }
}
function goAudit() { window.location.href = SERVLET_URL + '?action=audit&navToken=' + encodeURIComponent(AUDIT_NAV_TOKEN); }

/* ═══════════════════════════════════════════════════════
   DROPDOWN MENUS
   ═══════════════════════════════════════════════════════ */
function toggleTemplatesMenu(e) { e.stopPropagation(); closeAllMenus('templatesMenu'); toggleMenu('templatesMenu'); }
function toggleExportMenu(e) { e.stopPropagation(); closeAllMenus('exportMenu'); toggleMenu('exportMenu'); }
function toggleMenu(id) { var m = document.getElementById(id); if (m) m.className = m.className.indexOf('open') >= 0 ? 'dropdown-menu' : 'dropdown-menu open'; }
function closeAllMenus(exceptId) {
    var ids = ['templatesMenu', 'exportMenu'];
    for (var i = 0; i < ids.length; i++) {
        if (ids[i] === exceptId) continue;
        var m = document.getElementById(ids[i]);
        if (m) m.className = 'dropdown-menu';
    }
}
document.addEventListener('click', function() { closeAllMenus(null); });

/* ═══════════════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════════════ */
var LAYOUT_KEY = 'qtEditorHeightPct';

function applySplit(pct) {
    pct = Math.max(15, Math.min(85, pct));
    var editorPanel = document.getElementById('editorPanel');
    var resultsPanel = document.getElementById('resultsPanel');
    if (!editorPanel || !resultsPanel) return;
    editorPanel.style.flex = '0 0 ' + pct + '%';
    resultsPanel.style.flex = '1 1 ' + (100 - pct) + '%';
    try { sessionStorage.setItem(LAYOUT_KEY, pct); } catch (e) { /* ignore */ }
}

function setLayout(mode) {
    var buttons = document.querySelectorAll ? document.querySelectorAll('.layout-btn') : null;
    if (buttons) { for (var i = 0; i < buttons.length; i++) { buttons[i].className = 'layout-btn'; } }
    if (mode === 'editor') { applySplit(70); }
    else if (mode === 'results') { applySplit(30); }
    else { applySplit(50); }
    var target = window.event ? window.event.currentTarget : null;
    if (target) target.className = 'layout-btn active';
}

function initSplitter() {
    var saved = null;
    try { saved = sessionStorage.getItem(LAYOUT_KEY); } catch (e) { /* ignore */ }
    applySplit(saved ? parseFloat(saved) : 50);

    var splitter = document.getElementById('splitter');
    var workspace = document.getElementById('workspace');
    if (!splitter || !workspace) return;

    var dragging = false;
    splitter.addEventListener('mousedown', function(e) {
        dragging = true;
        splitter.className = 'splitter dragging';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        var rect = workspace.getBoundingClientRect();
        applySplit(((e.clientY - rect.top) / rect.height) * 100);
    });
    document.addEventListener('mouseup', function() {
        if (dragging) {
            dragging = false;
            splitter.className = 'splitter';
            document.body.style.userSelect = '';
        }
    });
}

var resultsMaximized = false;
function toggleResultsMaximize() {
    if (resultsMaximized) { applySplit(50); resultsMaximized = false; }
    else { applySplit(15); resultsMaximized = true; }
}

/* ═══════════════════════════════════════════════════════
   EDITOR
   ═══════════════════════════════════════════════════════ */
function handleEditorKey(e) {
    if (e.key === 'F5') { e.preventDefault(); if (LOGGED_IN && !queryRunning) executeQuery(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (LOGGED_IN && !queryRunning) executeQuery(); return; }
    if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); clearEditor(); return; }
    if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); openHistory(); return; }
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); formatEditor(); return; }
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveFavorite(); return; }
    if (e.ctrlKey && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); toggleResultsMaximize(); return; }
    if (e.key === 'Tab') {
        e.preventDefault();
        var el = document.getElementById('sqlEditor');
        var s = el.selectionStart;
        el.value = el.value.substring(0, s) + '  ' + el.value.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = s + 2;
        onEditorInput();
    }
}

function onEditorInput() {
    updateLineNumbers();
    updateHighlight();
    updateMetaStrip();
    var sql = getSql();
    if (sql.length === 0) { resetStats(); markUnsaved(false); return; }
    var qtype = detectQueryType(sql);
    setStatType(qtype);
    markUnsaved(sql !== lastExecutedSql);
}

function markUnsaved(on) {
    var el = document.getElementById('unsavedFlag');
    if (el) el.style.display = on ? 'inline' : 'none';
}

function updateMetaStrip() {
    var sql = getSql();
    var qtype = detectQueryType(sql);
    var el = document.getElementById('sqlEditor');
    var lines = el ? el.value.split('\n').length : 1;
    setText('metaType', sql.length === 0 ? '—' : qtype);
    setText('metaLines', lines);
    setText('metaChars', el ? el.value.length : 0);
}

function updateLineNumbers() {
    var el = document.getElementById('sqlEditor');
    var gutter = document.getElementById('lineGutter');
    if (!el || !gutter) return;
    var lines = el.value.split('\n').length;
    var html = '';
    for (var i = 1; i <= lines; i++) { html += '<span class="line-num">' + i + '</span>'; }
    gutter.innerHTML = html;
    gutter.scrollTop = el.scrollTop;
}

function syncEditorScroll() {
    var el = document.getElementById('sqlEditor');
    var hl = document.getElementById('sqlHighlight');
    var gutter = document.getElementById('lineGutter');
    if (el && hl) { hl.scrollTop = el.scrollTop; hl.scrollLeft = el.scrollLeft; }
    if (el && gutter) { gutter.scrollTop = el.scrollTop; }
}

function getSql() { var el = document.getElementById('sqlEditor'); return el ? el.value.trim() : ''; }
function getSqlRaw() { var el = document.getElementById('sqlEditor'); return el ? el.value : ''; }

function setEditorValue(sql) {
    var el = document.getElementById('sqlEditor');
    if (el) { el.value = sql; }
    updateLineNumbers();
    updateHighlight();
    updateMetaStrip();
    onEditorInput();
}

function clearEditor() { setEditorValue(''); resetStats(); showEmptyState(); }
function focusEditor() { var el = document.getElementById('sqlEditor'); if (el) el.focus(); }

/* ═══════════════════════════════════════════════════════
   SYNTAX HIGHLIGHT
   ═══════════════════════════════════════════════════════ */
var HL_KEYWORDS = {
    'SELECT':1,'FROM':1,'WHERE':1,'INSERT':1,'INTO':1,'VALUES':1,'UPDATE':1,'SET':1,
    'DELETE':1,'EXEC':1,'EXECUTE':1,'ALTER':1,'DROP':1,'TRUNCATE':1,'JOIN':1,'INNER':1,
    'LEFT':1,'RIGHT':1,'FULL':1,'OUTER':1,'CROSS':1,'ON':1,'AND':1,'OR':1,'NOT':1,
    'NULL':1,'IS':1,'IN':1,'LIKE':1,'BETWEEN':1,'EXISTS':1,'CASE':1,'WHEN':1,'THEN':1,
    'ELSE':1,'END':1,'ORDER':1,'BY':1,'GROUP':1,'HAVING':1,'UNION':1,'ALL':1,'DISTINCT':1,
    'TOP':1,'AS':1,'ASC':1,'DESC':1,'WITH':1,'NOLOCK':1,'DECLARE':1,'TABLE':1,'PRIMARY':1,
    'KEY':1,'FOREIGN':1,'REFERENCES':1,'DEFAULT':1,'CONSTRAINT':1,'ADD':1,'COLUMN':1
};
var HL_FUNCTIONS = {
    'COUNT':1,'SUM':1,'AVG':1,'MIN':1,'MAX':1,'ISNULL':1,'COALESCE':1,'CONVERT':1,
    'CAST':1,'GETDATE':1,'DATEADD':1,'DATEDIFF':1,'LEN':1,'SUBSTRING':1,'REPLACE':1,
    'UPPER':1,'LOWER':1,'TRIM':1,'ROUND':1,'SP_HELP':1
};
var HL_TOKEN_RE = /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\[[^\]]*\])|(\b\d+(?:\.\d+)?\b)|(@{1,2}[A-Za-z_][A-Za-z0-9_]*|#{1,2}[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*)|(<=|>=|<>|!=|[=<>+\-*/%])/g;

function updateHighlight() {
    var el = document.getElementById('sqlHighlightCode');
    var raw = getSqlRaw();
    if (!el) return;
    el.innerHTML = colorizeSql(raw) + '\n';
    syncEditorScroll();
}

function colorizeSql(sql) {
    var out = '';
    var m; HL_TOKEN_RE.lastIndex = 0;
    var lastIndex = 0;
    while ((m = HL_TOKEN_RE.exec(sql)) !== null) {
        if (m.index > lastIndex) { out += escHtml(sql.substring(lastIndex, m.index)); }
        if (m[1] !== undefined) { out += '<span class="tok-cmt">' + escHtml(m[1]) + '</span>'; }
        else if (m[2] !== undefined) { out += '<span class="tok-cmt">' + escHtml(m[2]) + '</span>'; }
        else if (m[3] !== undefined) { out += '<span class="tok-str">' + escHtml(m[3]) + '</span>'; }
        else if (m[4] !== undefined) { out += escHtml(m[4]); }
        else if (m[5] !== undefined) { out += '<span class="tok-num">' + escHtml(m[5]) + '</span>'; }
        else if (m[6] !== undefined) {
            var upper = m[6].toUpperCase();
            if (HL_KEYWORDS[upper]) { out += '<span class="tok-kw">' + escHtml(m[6]) + '</span>'; }
            else if (HL_FUNCTIONS[upper]) { out += '<span class="tok-fn">' + escHtml(m[6]) + '</span>'; }
            else { out += escHtml(m[6]); }
        }
        else if (m[7] !== undefined) { out += '<span class="tok-op">' + escHtml(m[7]) + '</span>'; }
        lastIndex = HL_TOKEN_RE.lastIndex;
        if (m.index === HL_TOKEN_RE.lastIndex) { HL_TOKEN_RE.lastIndex++; }
    }
    if (lastIndex < sql.length) { out += escHtml(sql.substring(lastIndex)); }
    return out;
}

/* ═══════════════════════════════════════════════════════
   QUERY TYPE DETECT
   ═══════════════════════════════════════════════════════ */
function detectQueryType(sql) {
    if (!sql || sql.trim().length === 0) return 'UNKNOWN';
    var t = sql.trim().toUpperCase();
    while (t.indexOf('--') === 0) { var nl = t.indexOf('\n'); t = nl >= 0 ? t.substring(nl + 1).trim() : ''; }
    while (t.indexOf('/*') === 0) { var end = t.indexOf('*/'); t = end >= 0 ? t.substring(end + 2).trim() : ''; }

    var forHelpCheck = t;
    if (forHelpCheck.indexOf('EXEC ') === 0) { forHelpCheck = forHelpCheck.substring(5).trim(); }
    else if (forHelpCheck.indexOf('EXECUTE ') === 0) { forHelpCheck = forHelpCheck.substring(8).trim(); }
    if (forHelpCheck.indexOf('SP_HELP') === 0) return 'SELECT';

    if (t.indexOf('SELECT')   === 0) return 'SELECT';
    if (t.indexOf('WITH')     === 0) return 'SELECT';
    if (t.indexOf('INSERT')   === 0) return 'INSERT';
    if (t.indexOf('UPDATE')   === 0) return 'UPDATE';
    if (t.indexOf('DELETE')   === 0) return 'DELETE';
    if (t.indexOf('EXEC')     === 0) return 'EXEC';
    if (t.indexOf('ALTER')    === 0) return 'ALTER';
    if (t.indexOf('DROP')     === 0) return 'DROP';
    if (t.indexOf('TRUNCATE') === 0) return 'TRUNCATE';
    return 'OTHER';
}

function extractTableName(sql) {
    if (!sql) return '';
    var up = sql.trim().toUpperCase();
    var parts, after, idx;
    try {
        if (up.indexOf('UPDATE') === 0) { parts = sql.trim().substring(6).trim().split(/\s+/); return parts.length > 0 ? parts[0] : ''; }
        if (up.indexOf('DELETE') === 0) { idx = up.indexOf('FROM'); if (idx >= 0) { parts = sql.trim().substring(idx + 4).trim().split(/\s+/); return parts.length > 0 ? parts[0] : ''; } }
        if (up.indexOf('INSERT') === 0) { idx = up.indexOf('INTO'); if (idx >= 0) { parts = sql.trim().substring(idx + 4).trim().split(/\s+|\(/); return parts.length > 0 ? parts[0] : ''; } }
        if (up.indexOf('DROP') === 0) { parts = sql.trim().split(/\s+/); return parts.length > 2 ? parts[2] : ''; }
        if (up.indexOf('TRUNCATE') === 0) {
            idx = up.indexOf('TABLE');
            after = idx >= 0 ? sql.trim().substring(idx + 5).trim() : sql.trim().substring(8).trim();
            parts = after.split(/\s+/);
            return parts.length > 0 ? parts[0] : '';
        }
    } catch (e) { /* ignore */ }
    return '';
}

/* ═══════════════════════════════════════════════════════
   STAGING
   ═══════════════════════════════════════════════════════ */
function b64EncodeSql(str) { return btoa(unescape(encodeURIComponent(str))); }

function stageQuery(sql, onStaged) {
    ajaxPost(SERVLET_URL + '?action=stage', { sql: b64EncodeSql(sql) },
        function(responseText) {
            try {
                var r = JSON.parse(responseText);
                if (r.status === 'ok' && r.queryId) { onStaged(r.queryId); }
                else { showLoading(false); stopExecTimer(); renderError(r.message || 'Failed to stage query.'); }
            } catch (e) { showLoading(false); stopExecTimer(); renderError('Failed to stage query: ' + e.message); }
        },
        function(statusCode) {
            showLoading(false); stopExecTimer();
            if (statusCode === 401) { renderError('Session expired. Please login again.'); }
            else { renderError('Network error staging query (HTTP ' + statusCode + ')'); }
        }
    );
}

/* ═══════════════════════════════════════════════════════
   EXECUTE
   ═══════════════════════════════════════════════════════ */
function extractProcName(sql) {
    var trimmed = sql.trim();
    var up = trimmed.toUpperCase();
    var rest = null;
    if (up.indexOf('EXECUTE') === 0) { rest = trimmed.substring(7).trim(); }
    else if (up.indexOf('EXEC') === 0) { rest = trimmed.substring(4).trim(); }
    if (rest === null) return 'this procedure';
    var m = rest.match(/^[A-Za-z0-9_.\[\]]+/);
    return m ? m[0] : 'this procedure';
}

function showExecConfirmPopup(sql) {
    var procName = extractProcName(sql);
    var iconEl = document.getElementById('confirmIcon');
    iconEl.className = 'confirm-icon ci-warn';
    iconEl.innerHTML = '&#9881;';
    setText('confirmTitle', 'STORED PROCEDURE EXECUTION');
    setText('confirmSub', 'This procedure may insert, update, or delete data internally.');

    var html = '';
    html += '<div class="confirm-info-row"><span class="confirm-info-label">Procedure</span><span class="confirm-info-val">' + escHtml(procName) + '</span></div>';
    html += '<div class="confirm-warn-box confirm-warn-amber">&#9888; Stored procedures can perform INSERT / UPDATE / DELETE / schema changes that cannot be previewed in advance. Only proceed if you trust what <strong>' + escHtml(procName) + '</strong> does.</div>';
    setText('confirmBody', html);

    var execBtn = document.getElementById('confirmExecBtn');
    execBtn.innerHTML = 'Execute Procedure';
    execBtn.className = 'btn-confirm btn-confirm-amber';
    openConfirm();
}

function executeQuery() {
    if (!LOGGED_IN) { openLoginModal(); return; }
    if (queryRunning) return;
    var sql = getSql();
    if (sql.length === 0) { alert('Please enter a SQL query.'); return; }

    var qtype = detectQueryType(sql);

    if (!IS_ADMIN && qtype !== 'SELECT') {
        renderError('Your account has read-only access. Only SELECT queries are permitted.');
        return;
    }

    if (IS_ADMIN) {
        pendingSql = sql;
        if (qtype === 'UPDATE' || qtype === 'DELETE') { showDmlConfirmPopup(sql, qtype); return; }
        if (qtype === 'INSERT')                       { showInsertConfirmPopup(sql);     return; }
        if (qtype === 'EXEC')                         { showExecConfirmPopup(sql);       return; }
        if (qtype === 'ALTER')                        { showAlterConfirmPopup();         return; }
        if (qtype === 'DROP' || qtype === 'TRUNCATE') { showDangerConfirmPopup(sql, qtype); return; }
    }

    runQuery(sql);
}

function runQuery(sql) {
    var timeoutEl = document.getElementById('timeoutSel');
    var timeout = timeoutEl ? timeoutEl.value : '300';

    setQueryRunning(true);
    showLoading(true);
    showResultsContent('');
    hideResultTabs();
    startExecTimer();

    stageQuery(sql, function(queryId) {
        ajaxPost(SERVLET_URL + '?action=execute',
            { queryId: queryId, timeout: timeout, target: CURRENT_TARGET },
            function(responseText) {
                setQueryRunning(false);
                showLoading(false);
                stopExecTimer();
                lastExecutedSql = sql;
                markUnsaved(false);
                try { var result = JSON.parse(responseText); renderQueryResult(result); }
                catch (e) { renderError('Failed to parse server response: ' + e.message); }
            },
            function(statusCode) {
                setQueryRunning(false);
                showLoading(false);
                stopExecTimer();
                if (statusCode === 0) { renderError('Query cancelled.'); }
                else if (statusCode === 401) { renderError('Session expired. Please login again.'); }
                else { renderError('Network error (HTTP ' + statusCode + ')'); }
            }
        );
    });
}

function setQueryRunning(on) {
    queryRunning = on;
    var execBtn = document.getElementById('execBtn');
    var cancelBtn = document.getElementById('cancelBtn');
    if (execBtn) execBtn.style.display = on ? 'none' : 'flex';
    if (cancelBtn) cancelBtn.style.display = on ? 'flex' : 'none';
}

function cancelQuery() {
    if (currentXhr) { try { currentXhr.abort(); } catch (e) { /* ignore */ } }
    setQueryRunning(false);
    showLoading(false);
    stopExecTimer();
}

function startExecTimer() {
    execStartTs = new Date().getTime();
    var timerEl = document.getElementById('execTimer');
    if (timerEl) timerEl.className = 'exec-timer show';
    execTimerHandle = setInterval(function() {
        var secs = ((new Date().getTime() - execStartTs) / 1000).toFixed(1);
        setText('execTimerText', 'Executing… ' + secs + 's');
    }, 100);
}
function stopExecTimer() {
    if (execTimerHandle) { clearInterval(execTimerHandle); execTimerHandle = null; }
    var timerEl = document.getElementById('execTimer');
    if (timerEl) timerEl.className = 'exec-timer';
}

function doConfirmedExecute() {
    var dangerInput = document.getElementById('dangerInput');
    if (dangerInput) {
        var expected = dangerInput.getAttribute('data-expected');
        if (dangerInput.value.trim() !== expected) { alert('Object name does not match. Execution cancelled.'); return; }
    }
    closeConfirm();
    runQuery(pendingSql);
}

/* ═══════════════════════════════════════════════════════
   CONFIRM POPUPS
   ═══════════════════════════════════════════════════════ */
function showDmlConfirmPopup(sql, qtype) {
    var isDelete = (qtype === 'DELETE');
    var iconEl = document.getElementById('confirmIcon');
    iconEl.className = 'confirm-icon ' + (isDelete ? 'ci-danger' : 'ci-warn');
    iconEl.innerHTML = isDelete ? '&#128465;' : '&#9998;';
    setText('confirmTitle', qtype + ' DETECTED');
    setText('confirmSub', 'Preview of affected records. Please verify before proceeding.');
    setText('confirmBody', '<div style="color:var(--text2);font-size:12px;padding:8px 0;">Loading preview...</div>');

    var execBtn = document.getElementById('confirmExecBtn');
    execBtn.innerHTML = 'Execute ' + (isDelete ? 'Delete' : 'Update');
    execBtn.className = 'btn-confirm ' + (isDelete ? 'btn-confirm-red' : 'btn-confirm-amber');

    openConfirm();

    var timeoutEl = document.getElementById('timeoutSel');
    var timeout = timeoutEl ? timeoutEl.value : '300';

    stageQuery(sql, function(queryId) {
        ajaxPost(SERVLET_URL + '?action=preview',
            { queryId: queryId, timeout: timeout, target: CURRENT_TARGET },
            function(responseText) {
                try {
                    var r = JSON.parse(responseText);
                    if (r.status === 'ok') { buildDmlConfirmBody(r, qtype, isDelete); }
                    else {
                        var bodyEl = document.getElementById('confirmBody');
                        if (bodyEl) bodyEl.innerHTML = '<div class="error-box"><div class="error-box-title">Preview Error</div><div class="error-box-msg">' + escHtml(r.message) + '</div></div>';
                    }
                } catch (e) { /* ignore */ }
            },
            function(sc) {
                var bodyEl = document.getElementById('confirmBody');
                if (bodyEl) bodyEl.innerHTML = '<div class="error-box"><div class="error-box-msg">Preview failed (HTTP ' + sc + ')</div></div>';
            }
        );
    });
}

function buildDmlConfirmBody(r, qtype, isDelete) {
    var bodyEl = document.getElementById('confirmBody');
    if (!bodyEl) return;
    var html = '';
    html += '<div class="confirm-info-row"><span class="confirm-info-label">Target Table</span><span class="confirm-info-val">' + escHtml(r.table) + '</span></div>';
    html += '<div class="confirm-info-row"><span class="confirm-info-label">Estimated Rows to ' + qtype + '</span><span class="confirm-info-val" style="color:var(--red);">' + r.count + '</span></div>';

    if (r.preview && r.preview.rows && r.preview.rows.length > 0) {
        html += '<div class="confirm-preview-label">Preview (first ' + r.preview.rows.length + ' rows)</div>';
        html += '<div class="table-wrap" style="max-height:180px;"><table class="rt"><thead><tr>';
        for (var c = 0; c < r.preview.columns.length; c++) { html += '<th>' + escHtml(r.preview.columns[c]) + '</th>'; }
        html += '</tr></thead><tbody>';
        for (var ri = 0; ri < r.preview.rows.length; ri++) {
            var row = r.preview.rows[ri];
            html += '<tr>';
            for (var ci = 0; ci < row.length; ci++) {
                var val = row[ci];
                html += (val === '') ? '<td class="null-cell">NULL</td>' : ('<td>' + escHtml(val) + '</td>');
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';
    }

    var warnCls = isDelete ? 'confirm-warn-red' : 'confirm-warn-amber';
    var warnVerb = isDelete ? 'permanently delete' : 'update';
    html += '<div class="confirm-warn-box ' + warnCls + '">&#9888; This operation will ' + warnVerb + ' <strong>' + r.count + '</strong> records.</div>';
    bodyEl.innerHTML = html;
}

function showInsertConfirmPopup(sql) {
    var table = extractTableName(sql);
    var iconEl = document.getElementById('confirmIcon');
    iconEl.className = 'confirm-icon ci-warn';
    iconEl.innerHTML = '&#128229;';
    setText('confirmTitle', 'INSERT DETECTED');
    setText('confirmSub', 'This operation will insert new records into the database.');
    var html = '';
    html += '<div class="confirm-info-row"><span class="confirm-info-label">Target Table</span><span class="confirm-info-val">' + escHtml(table) + '</span></div>';
    html += '<div class="confirm-warn-box confirm-warn-amber">Proceed with insertion into <strong>' + escHtml(table) + '</strong>?</div>';
    setText('confirmBody', html);
    var execBtn = document.getElementById('confirmExecBtn');
    execBtn.innerHTML = 'Execute Insert';
    execBtn.className = 'btn-confirm btn-confirm-amber';
    openConfirm();
}

function showAlterConfirmPopup() {
    var iconEl = document.getElementById('confirmIcon');
    iconEl.className = 'confirm-icon ci-warn';
    iconEl.innerHTML = '&#128295;';
    setText('confirmTitle', 'SCHEMA CHANGE DETECTED');
    setText('confirmSub', 'This operation will modify the database structure.');
    setText('confirmBody', '<div class="confirm-warn-box confirm-warn-amber">&#9888; ALTER operations change the database schema and cannot be easily undone. Proceed?</div>');
    var execBtn = document.getElementById('confirmExecBtn');
    execBtn.innerHTML = 'Execute Alter';
    execBtn.className = 'btn-confirm btn-confirm-amber';
    openConfirm();
}

function showDangerConfirmPopup(sql, qtype) {
    var table = extractTableName(sql);
    var iconEl = document.getElementById('confirmIcon');
    iconEl.className = 'confirm-icon ci-danger';
    iconEl.innerHTML = '&#128680;';
    setText('confirmTitle', qtype + ' DETECTED — DANGEROUS');
    setText('confirmSub', 'This operation cannot be undone. Type the object name to confirm.');
    var html = '';
    html += '<div class="confirm-warn-box confirm-warn-red">&#128680; DANGEROUS OPERATION — this will permanently destroy data or schema!</div>';
    html += '<div class="confirm-info-row"><span class="confirm-info-label">Target</span><span class="confirm-info-val">' + escHtml(table) + '</span></div>';
    html += '<div class="confirm-input-wrap">';
    html += '<div class="confirm-input-desc">Type the object name to confirm: <strong>' + escHtml(table) + '</strong></div>';
    html += '<input class="confirm-input" type="text" id="dangerInput" data-expected="' + escHtml(table) + '" placeholder="' + escHtml(table) + '" oninput="checkDangerInput()">';
    html += '</div>';
    setText('confirmBody', html);
    var execBtn = document.getElementById('confirmExecBtn');
    execBtn.innerHTML = 'Execute ' + qtype;
    execBtn.className = 'btn-confirm btn-confirm-red btn-confirm-disabled';
    openConfirm();
}

function checkDangerInput() {
    var inp = document.getElementById('dangerInput');
    var execBtn = document.getElementById('confirmExecBtn');
    if (!inp || !execBtn) return;
    var expected = inp.getAttribute('data-expected');
    if (inp.value.trim() === expected) { execBtn.className = execBtn.className.replace(' btn-confirm-disabled', ''); }
    else if (execBtn.className.indexOf('btn-confirm-disabled') < 0) { execBtn.className += ' btn-confirm-disabled'; }
}

function openConfirm() { var ov = document.getElementById('confirmOverlay'); if (ov) ov.className = 'overlay open'; }
function closeConfirm() { var ov = document.getElementById('confirmOverlay'); if (ov) ov.className = 'overlay'; }

/* ═══════════════════════════════════════════════════════
   SORT / FILTER
   ═══════════════════════════════════════════════════════ */
var lastResultSets = [];
var tableSortState = {};
var tableFilterState = {};

function compareValues(a, b) {
    if (a === '' && b === '') return 0;
    if (a === '') return -1;
    if (b === '') return 1;
    var numRe = /^-?\d+(\.\d+)?$/;
    if (numRe.test(a) && numRe.test(b)) { var an = parseFloat(a), bn = parseFloat(b); return an < bn ? -1 : (an > bn ? 1 : 0); }
    return a.localeCompare(b);
}

function applySortFilter(rows, sortCol, sortDir, filterText) {
    var result;
    if (filterText && filterText.length > 0) {
        var needle = filterText.toLowerCase();
        result = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i]; var matched = false;
            for (var c = 0; c < row.length; c++) { if (String(row[c]).toLowerCase().indexOf(needle) >= 0) { matched = true; break; } }
            if (matched) result.push(row);
        }
    } else { result = rows.slice(); }

    if (sortCol !== null && sortCol !== undefined && sortCol >= 0) {
        result.sort(function(a, b) {
            var av = a[sortCol] !== undefined ? a[sortCol] : '';
            var bv = b[sortCol] !== undefined ? b[sortCol] : '';
            var cmp = compareValues(av, bv);
            return sortDir === 'desc' ? -cmp : cmp;
        });
    }
    return result;
}

function sortResultTable(rsIndex, colIndex) {
    var state = tableSortState[rsIndex] || { col: -1, dir: 'asc' };
    if (state.col === colIndex) { state.dir = (state.dir === 'asc') ? 'desc' : 'asc'; }
    else { state.col = colIndex; state.dir = 'asc'; }
    tableSortState[rsIndex] = state;
    rerenderResults();
}

function filterResultTable(rsIndex, text) {
    var inputEl = document.getElementById('rtFilter' + rsIndex);
    var caretPos = inputEl ? inputEl.selectionStart : null;
    tableFilterState[rsIndex] = text;
    rerenderResults();
    var newInputEl = document.getElementById('rtFilter' + rsIndex);
    if (newInputEl) { newInputEl.focus(); if (caretPos !== null) { try { newInputEl.setSelectionRange(caretPos, caretPos); } catch (e) { /* ignore */ } } }
}

function rerenderResults() {
    if (!lastResultSets || lastResultSets.length === 0) return;
    renderActiveResultTab();
}

/* ═══════════════════════════════════════════════════════
   RESULT TABS
   ═══════════════════════════════════════════════════════ */
function buildResultTabs() {
    var tabsEl = document.getElementById('resultTabs');
    if (!tabsEl) return;
    if (!lastResultSets || lastResultSets.length <= 1) { tabsEl.style.display = 'none'; tabsEl.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < lastResultSets.length; i++) {
        var cls = 'result-tab' + (i === activeResultTab ? ' active' : '');
        html += '<div class="' + cls + '" onclick="switchResultTab(' + i + ')">Result Set ' + (i + 1) + '<span class="rc">(' + lastResultSets[i].rowCount + ')</span></div>';
    }
    tabsEl.innerHTML = html;
    tabsEl.style.display = 'flex';
}
function switchResultTab(i) { activeResultTab = i; buildResultTabs(); renderActiveResultTab(); }
function hideResultTabs() { var tabsEl = document.getElementById('resultTabs'); if (tabsEl) { tabsEl.style.display = 'none'; tabsEl.innerHTML = ''; } activeResultTab = 0; }

function renderActiveResultTab() {
    if (!lastResultSets || lastResultSets.length === 0) return;
    var idx = Math.min(activeResultTab, lastResultSets.length - 1);
    var html = buildResultSetHtml(lastResultSets[idx], idx, false);
    showResultsContent(html);
}

function buildResultSetHtml(rs, ri, showTitle) {
    var html = '';
    if (showTitle) {
        html += '<div class="rs-header fade-in" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
        html += '<span style="font-size:12px;font-weight:700;color:var(--text);">Result Set ' + rs.index + '</span>';
        html += '<span style="padding:2px 8px;border-radius:9px;font-size:9px;font-weight:700;background:var(--blue-lt);color:var(--blue-dark);">' + rs.rowCount + ' rows</span>';
        html += '</div>';
    }

    if (rs.truncated) {
        html += '<div class="truncated-banner fade-in">&#9888; Showing first ' + rs.rowCount + ' rows. More rows exist — refine your WHERE clause or use Excel/CSV export for the complete result.</div>';
    }

    if (rs.rowCount === 0) {
        html += '<div class="table-wrap fade-in"><div class="rt-empty">Query returned 0 rows</div></div>';
        return html;
    }

    var sortState = tableSortState[ri] || { col: -1, dir: 'asc' };
    var filterText = tableFilterState[ri] || '';
    var displayRows = applySortFilter(rs.rows, sortState.col, sortState.dir, filterText);

    html += '<div class="rt-controls fade-in">';
    html += '<input type="text" class="rt-filter-input" id="rtFilter' + ri + '" placeholder="Filter rows…" value="' + escHtml(filterText) + '" oninput="filterResultTable(' + ri + ', this.value)">';
    if (filterText.length > 0) { html += '<span class="rt-filter-count">' + displayRows.length + ' of ' + rs.rows.length + ' rows</span>'; }
    html += '<div class="rt-tools">';
    html += '<button class="rt-mini-btn" onclick="copyResultSet(' + ri + ')">Copy</button>';
    html += '</div>';
    html += '</div>';

    if (displayRows.length === 0 && filterText.length > 0) {
        html += '<div class="table-wrap fade-in"><div class="rt-empty">No rows match "' + escHtml(filterText) + '"</div></div>';
        return html;
    }

    html += '<div class="table-wrap fade-in"><table class="rt"><thead><tr>';
    for (var ci = 0; ci < rs.columns.length; ci++) {
        var sortIcon = '';
        if (sortState.col === ci) { sortIcon = sortState.dir === 'asc' ? ' &#9650;' : ' &#9660;'; }
        html += '<th onclick="sortResultTable(' + ri + ',' + ci + ')">' + escHtml(rs.columns[ci]) + sortIcon + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var rowi = 0; rowi < displayRows.length; rowi++) {
        var row = displayRows[rowi];
        html += '<tr>';
        for (var coli = 0; coli < row.length; coli++) {
            var cellVal = row[coli];
            html += (cellVal === '') ? '<td class="null-cell">NULL</td>' : ('<td ondblclick="copyCellText(this)" title="Double-click to copy">' + escHtml(cellVal) + '</td>');
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function copyCellText(td) { copyToClipboard(td.textContent || td.innerText || ''); }
function copyResultSet(ri) {
    var rs = lastResultSets[ri];
    if (!rs) return;
    var lines = [rs.columns.join('\t')];
    for (var i = 0; i < rs.rows.length; i++) { lines.push(rs.rows[i].join('\t')); }
    copyToClipboard(lines.join('\n'));
}
function copyToClipboard(text) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text); }
    else {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
}

/* ═══════════════════════════════════════════════════════
   RENDER RESULTS
   ═══════════════════════════════════════════════════════ */
function renderQueryResult(r) {
    var typeEl = document.getElementById('statType');
    if (typeEl) {
        typeEl.innerHTML = r.queryType || '—';
        typeEl.className = 'stat-val';
        typeEl.className += (r.queryType === 'SELECT' || r.queryType === 'EXEC') ? ' stat-ok' : ' stat-info';
    }

    setText('statTime', (r.executionTimeMs || 0) + 'ms');
    setText('statAffected', r.rowsAffected || 0);
    setText('statSets', r.resultSets ? r.resultSets.length : 0);

    var totalRows = 0;
    if (r.resultSets) { for (var i = 0; i < r.resultSets.length; i++) { totalRows += r.resultSets[i].rowCount || 0; } }
    setText('statRows', totalRows);

    var statusEl = document.getElementById('statStatus');
    if (statusEl) {
        if (r.status === 'SUCCESS') { statusEl.innerHTML = 'SUCCESS'; statusEl.className = 'stat-val stat-ok'; }
        else { statusEl.innerHTML = r.status || 'ERROR'; statusEl.className = 'stat-val stat-err'; }
    }

    if (r.status === 'ERROR' || r.status === 'TIMEOUT') {
        lastResultSets = []; tableSortState = {}; tableFilterState = {};
        hideResultTabs();
        renderError(r.errorMessage || 'Execution failed.');
        return;
    }

    lastResultSets = r.resultSets || [];
    tableSortState = {}; tableFilterState = {}; activeResultTab = 0;

    if (!r.resultSets || r.resultSets.length === 0) {
        hideResultTabs();
        var html = '';
        html += '<div class="dml-result fade-in"><div class="dml-icon">&#9989;</div><div>';
        html += '<div class="dml-msg">' + escHtml(r.queryType) + ' executed successfully</div>';
        html += '<div class="dml-sub">' + r.rowsAffected + ' row(s) affected &nbsp;&#183;&nbsp; ' + r.executionTimeMs + 'ms</div>';
        html += '</div></div>';
        showResultsContent(html);
        return;
    }

    buildResultTabs();
    renderActiveResultTab();
}

function renderError(msg) {
    hideResultTabs();
    var html = '';
    html += '<div class="error-box fade-in">';
    html += '<div class="error-box-title"><span>Execution Error</span><span class="error-box-copy" onclick="copyToClipboard(this.parentNode.parentNode.querySelector(\'.error-box-msg\').textContent)">Copy</span></div>';
    html += '<div class="error-box-msg">' + escHtml(msg) + '</div>';
    html += '</div>';
    showResultsContent(html);
}

function showResultsContent(html) {
    var empty = document.getElementById('emptyState');
    var content = document.getElementById('resultsContent');
    if (empty) empty.style.display = 'none';
    if (content) { content.style.display = html.length === 0 ? 'none' : 'block'; content.innerHTML = html; }
}

function showEmptyState() {
    var empty = document.getElementById('emptyState');
    var content = document.getElementById('resultsContent');
    if (empty) empty.style.display = 'flex';
    if (content) { content.style.display = 'none'; content.innerHTML = ''; }
    hideResultTabs();
}

/* ═══════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════ */
function exportExcel() { closeAllMenus(null); var sql = getSql(); if (sql.length === 0) { alert('Please enter a SQL query first.'); return; } submitDownloadForm('exportExcel', sql); }
function exportCsv()   { closeAllMenus(null); var sql = getSql(); if (sql.length === 0) { alert('Please enter a SQL query first.'); return; } submitDownloadForm('exportCsv', sql); }

function submitDownloadForm(action, sql) {
    var timeoutEl = document.getElementById('timeoutSel');
    var timeout = timeoutEl ? timeoutEl.value : '300';
    stageQuery(sql, function(queryId) {
        var form = document.getElementById('downloadForm');
        if (!form) return;
        document.getElementById('dlAction').value  = action;
        document.getElementById('dlQueryId').value = queryId;
        document.getElementById('dlTimeout').value = timeout;
        document.getElementById('dlTarget').value  = CURRENT_TARGET;
        form.submit();
    });
}

/* ═══════════════════════════════════════════════════════
   HISTORY
   ═══════════════════════════════════════════════════════ */
function openHistory() { var panel = document.getElementById('historyPanel'); if (panel) panel.className = 'side-panel open'; loadHistoryList(); }
function closeHistory() { var panel = document.getElementById('historyPanel'); if (panel) panel.className = 'side-panel'; }

function loadHistoryList() {
    ajaxGet(SERVLET_URL + '?action=history',
        function(responseText) {
            try { historyData = JSON.parse(responseText); } catch (e) { historyData = []; }
            renderHistoryList();
            setText('historyCountInline', historyData.length > 0 ? historyData.length : '');
        },
        function() { historyData = []; renderHistoryList(); }
    );
}

function renderHistoryList() {
    var container = document.getElementById('historyList');
    if (!container) return;
    var searchEl = document.getElementById('historySearch');
    var q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    var filtered = historyData;
    if (q.length > 0) {
        filtered = [];
        for (var i = 0; i < historyData.length; i++) {
            if ((historyData[i].sql || '').toLowerCase().indexOf(q) >= 0) filtered.push(historyData[i]);
        }
    }
    if (filtered.length === 0) { container.innerHTML = '<div class="sp-empty">' + (q.length > 0 ? 'No matching queries.' : 'No history yet.') + '</div>'; return; }
    var html = '';
    for (var j = 0; j < filtered.length; j++) {
        var h = filtered[j];
        var origIndex = historyData.indexOf(h);
        var sql = h.sql || '';
        var preview = sql.length > 140 ? sql.substring(0, 140) + '...' : sql;
        html += '<div class="sp-item">';
        html += '<div class="sp-sql">' + escHtml(preview) + '</div>';
        html += '<div class="sp-ts">' + escHtml(h.ts || '') + '</div>';
        html += '<div class="sp-actions">';
        html += '<button class="sp-act" onclick="useHistory(' + origIndex + ')">Use</button>';
        html += '<button class="sp-act" onclick="copyHistory(' + origIndex + ')">Copy</button>';
        html += '<button class="sp-act" onclick="rerunHistory(' + origIndex + ')">Re-run</button>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function useHistory(index) { var h = historyData[index]; if (!h) return; setEditorValue(h.sql || ''); closeHistory(); focusEditor(); }
function copyHistory(index) { var h = historyData[index]; if (!h) return; copyToClipboard(h.sql || ''); }
function rerunHistory(index) {
    var h = historyData[index]; if (!h) return;
    setEditorValue(h.sql || '');
    closeHistory();
    setTimeout(function() { executeQuery(); }, 100);
}

/* ═══════════════════════════════════════════════════════
   SQL FORMATTER
   ═══════════════════════════════════════════════════════ */
var formatSql = (function() {
var SQL_TOKEN_RE = /(--[^\n]*)|(\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|("(?:[^"]|"")*")|(\[[^\]]*\])|(\s+)|(@{1,2}[A-Za-z_][A-Za-z0-9_]*|#{1,2}[A-Za-z_][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_]*)|([0-9]+(?:\.[0-9]+)?)|(<=|>=|<>|!=|\S)/g;
var T_COMMENT_LINE=1,T_COMMENT_BLOCK=2,T_STRING=3,T_DQUOTE=4,T_BRACKET=5,T_SPACE=6,T_WORD=7,T_NUMBER=8,T_OTHER=9;

function tokenize(sql) {
    var tokens = []; var m; SQL_TOKEN_RE.lastIndex = 0;
    while ((m = SQL_TOKEN_RE.exec(sql)) !== null) {
        var type, text;
        if (m[1] !== undefined) { type=T_COMMENT_LINE; text=m[1]; }
        else if (m[2] !== undefined) { type=T_COMMENT_BLOCK; text=m[2]; }
        else if (m[3] !== undefined) { type=T_STRING; text=m[3]; }
        else if (m[4] !== undefined) { type=T_DQUOTE; text=m[4]; }
        else if (m[5] !== undefined) { type=T_BRACKET; text=m[5]; }
        else if (m[6] !== undefined) { type=T_SPACE; text=m[6]; }
        else if (m[7] !== undefined) { type=T_WORD; text=m[7]; }
        else if (m[8] !== undefined) { type=T_NUMBER; text=m[8]; }
        else { type=T_OTHER; text=m[9]; }
        tokens.push({ type: type, text: text });
        if (m.index === SQL_TOKEN_RE.lastIndex) { SQL_TOKEN_RE.lastIndex++; }
    }
    return tokens;
}

var CLAUSE_WORDS = { 'SELECT':1,'FROM':1,'WHERE':1,'HAVING':1,'UNION':1,'SET':1,'VALUES':1,'UPDATE':1,'EXEC':1,'EXECUTE':1 };
var CLAUSE_PAIRS = { 'GROUP':'BY','ORDER':'BY','INSERT':'INTO','DELETE':'FROM' };
var JOIN_STARTS = { 'JOIN':1,'INNER':1,'LEFT':1,'RIGHT':1,'FULL':1,'CROSS':1 };
var NO_SPACE_BEFORE = { ',':1, ')':1, ';':1, '.':1 };
var NO_SPACE_AFTER  = { '(':1, '.':1 };

function isWord(tok) { return tok.type === T_WORD; }
function upperText(tok) { return tok.text.toUpperCase(); }

function formatSqlImpl(sql) {
    var tokens = tokenize(sql);
    var meaningful = [];
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i].type === T_SPACE) continue;
        var precededBySpace = (i > 0 && tokens[i - 1].type === T_SPACE);
        meaningful.push({ type: tokens[i].type, text: tokens[i].text, hadSpaceBefore: precededBySpace || i === 0 });
    }

    var out = []; var indent = 0; var selectDepth = 0; var parenDepth = 0;
    var curLine = { indent: indent, parts: [] };

    function pushLine() { if (curLine.parts.length > 0) out.push(curLine); curLine = { indent: indent, parts: [] }; }
    function addPart(text, forceNoSpaceBefore) { curLine.parts.push({ text: text, forceNoSpaceBefore: !!forceNoSpaceBefore }); }

    for (var idx = 0; idx < meaningful.length; idx++) {
        var tok = meaningful[idx];
        if (tok.type === T_COMMENT_LINE) { addPart(tok.text); pushLine(); continue; }
        if (tok.type === T_COMMENT_BLOCK || tok.type === T_STRING || tok.type === T_DQUOTE || tok.type === T_BRACKET) { addPart(tok.text); continue; }
        if (tok.type === T_NUMBER) { addPart(tok.text); continue; }
        if (tok.type === T_OTHER) {
            if (tok.text === '(') {
                parenDepth++;
                var prevTok = meaningful[idx - 1];
                var isCallParen = !tok.hadSpaceBefore && prevTok &&
                    (prevTok.type === T_WORD || prevTok.type === T_NUMBER || prevTok.type === T_STRING ||
                     prevTok.type === T_DQUOTE || prevTok.type === T_BRACKET ||
                     (prevTok.type === T_OTHER && prevTok.text === ')'));
                addPart('(', isCallParen); continue;
            }
            if (tok.text === ')') { parenDepth = Math.max(0, parenDepth - 1); addPart(')'); continue; }
            if (tok.text === ',') { addPart(','); if (selectDepth > 0 && parenDepth === 0) { pushLine(); } continue; }
            if (tok.text === ';') { addPart(';'); pushLine(); indent = 0; selectDepth = 0; out.push({ indent: 0, parts: [] }); continue; }
            addPart(tok.text); continue;
        }
        var upper = upperText(tok);
        if (CLAUSE_PAIRS[upper] && parenDepth === 0) {
            var next = meaningful[idx + 1];
            if (next && isWord(next) && upperText(next) === CLAUSE_PAIRS[upper]) {
                pushLine(); indent = 0; addPart(upper + ' ' + CLAUSE_PAIRS[upper]); idx++; indent = 1; selectDepth = 0; continue;
            }
        }
        if (JOIN_STARTS[upper] && parenDepth === 0) {
            var phrase = [upper]; var lookahead = idx + 1;
            if (upper !== 'JOIN') {
                var n1 = meaningful[lookahead];
                if (n1 && isWord(n1) && upperText(n1) === 'OUTER') { phrase.push('OUTER'); lookahead++; }
                var n2 = meaningful[lookahead];
                if (n2 && isWord(n2) && upperText(n2) === 'JOIN') { phrase.push('JOIN'); lookahead++; } else { phrase = null; }
            }
            if (phrase) { pushLine(); indent = 0; addPart(phrase.join(' ')); idx = lookahead - 1; indent = 1; selectDepth = 0; continue; }
        }
        if (CLAUSE_WORDS[upper] && parenDepth === 0) {
            pushLine(); indent = 0; addPart(upper);
            if (upper === 'SELECT') { selectDepth = 1; indent = 1; } else { selectDepth = 0; indent = 1; }
            continue;
        }
        if ((upper === 'ON' || upper === 'AND' || upper === 'OR') && parenDepth === 0) { pushLine(); addPart(upper); continue; }
        var KNOWN_KEYWORDS = { 'TOP':1,'AS':1,'DISTINCT':1,'NULL':1,'IS':1,'NOT':1,'IN':1,'LIKE':1,'BETWEEN':1,'EXISTS':1,'CASE':1,'WHEN':1,'THEN':1,'ELSE':1,'END':1,'ASC':1,'DESC':1,'WITH':1,'NOLOCK':1,'ALL':1 };
        addPart(KNOWN_KEYWORDS[upper] ? upper : tok.text);
    }
    pushLine();

    var INDENT_STR = '    '; var resultLines = [];
    for (var li = 0; li < out.length; li++) {
        var line = out[li];
        if (line.parts.length === 0) { resultLines.push(''); continue; }
        var s = '';
        for (var pi = 0; pi < line.parts.length; pi++) {
            var p = line.parts[pi].text;
            if (pi === 0) { s += p; continue; }
            var prev = line.parts[pi - 1].text;
            var needSpace = true;
            if (NO_SPACE_BEFORE[p]) needSpace = false;
            if (NO_SPACE_AFTER[prev]) needSpace = false;
            if (line.parts[pi].forceNoSpaceBefore) needSpace = false;
            s += (needSpace ? ' ' : '') + p;
        }
        resultLines.push(new Array(line.indent + 1).join(INDENT_STR) + s);
    }
    while (resultLines.length && resultLines[resultLines.length - 1] === '') resultLines.pop();
    return resultLines.join('\n');
}
return formatSqlImpl;
})();

function formatEditor() {
    var sql = getSqlRaw();
    if (sql.trim().length === 0) return;
    try { setEditorValue(formatSql(sql)); focusEditor(); }
    catch (e) { alert('Could not format this query: ' + e.message); }
}

/* ═══════════════════════════════════════════════════════
   FAVORITES
   ═══════════════════════════════════════════════════════ */
function saveFavorite() {
    var sql = getSql();
    if (sql.length === 0) { alert('Please enter a SQL query first.'); return; }
    var qtype = detectQueryType(sql);
    if (!IS_ADMIN && qtype !== 'SELECT') { alert('Your account has read-only access. Only SELECT queries can be saved.'); return; }
    var name = prompt('Name this favorite:');
    if (name === null) return;
    name = name.trim();
    if (name.length === 0) { alert('Please enter a name.'); return; }
    ajaxPost(SERVLET_URL + '?action=favoriteSave', { sql: b64EncodeSql(sql), name: name },
        function(responseText) {
            try {
                var r = JSON.parse(responseText);
                if (r.status === 'ok') { alert('Saved to favorites.'); loadFavoritesCount(); }
                else { alert(r.message || 'Failed to save favorite.'); }
            } catch (e) { alert('Failed to save favorite.'); }
        },
        function(sc) { alert('Network error saving favorite (HTTP ' + sc + ')'); }
    );
}

function openFavorites() { var panel = document.getElementById('favoritesPanel'); if (panel) panel.className = 'side-panel open'; loadFavoritesList(); }
function closeFavorites() { var panel = document.getElementById('favoritesPanel'); if (panel) panel.className = 'side-panel'; }

function loadFavoritesCount() {
    ajaxGet(SERVLET_URL + '?action=favoriteList',
        function(responseText) { try { var list = JSON.parse(responseText); setText('favoritesCountInline', list.length > 0 ? list.length : ''); } catch (e) { /* ignore */ } },
        function() { /* ignore */ }
    );
}

function loadFavoritesList() {
    ajaxGet(SERVLET_URL + '?action=favoriteList',
        function(responseText) {
            try { favoritesData = JSON.parse(responseText); } catch (e) { favoritesData = []; }
            renderFavoritesList();
            setText('favoritesCountInline', favoritesData.length > 0 ? favoritesData.length : '');
        },
        function() { favoritesData = []; renderFavoritesList(); }
    );
}

function renderFavoritesList() {
    var container = document.getElementById('favoritesList');
    if (!container) return;
    var searchEl = document.getElementById('favoritesSearch');
    var q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    var filtered = favoritesData;
    if (q.length > 0) {
        filtered = [];
        for (var i = 0; i < favoritesData.length; i++) {
            var f = favoritesData[i];
            if ((f.name || '').toLowerCase().indexOf(q) >= 0 || (f.sql || '').toLowerCase().indexOf(q) >= 0) filtered.push(f);
        }
    }
    if (filtered.length === 0) { container.innerHTML = '<div class="sp-empty">' + (q.length > 0 ? 'No matching favorites.' : 'No favorites yet.') + '</div>'; return; }
    var html = '';
    for (var j = 0; j < filtered.length; j++) {
        var f = filtered[j];
        var origIndex = favoritesData.indexOf(f);
        var sql = f.sql || '';
        var preview = sql.length > 140 ? sql.substring(0, 140) + '...' : sql;
        html += '<div class="sp-item">';
        html += '<div class="sp-item-name">' + escHtml(f.name || '') + '</div>';
        html += '<div class="sp-sql">' + escHtml(preview) + '</div>';
        html += '<div class="sp-ts">' + escHtml(f.ts || '') + '</div>';
        html += '<div class="sp-actions">';
        html += '<button class="sp-act" onclick="useFavorite(' + origIndex + ')">Use</button>';
        html += '<button class="sp-act" onclick="rerunFavorite(' + origIndex + ')">Re-run</button>';
        html += '<button class="sp-act danger" onclick="deleteFavorite(' + origIndex + ')">Delete</button>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function useFavorite(index) { var f = favoritesData[index]; if (!f) return; setEditorValue(f.sql || ''); closeFavorites(); focusEditor(); }
function rerunFavorite(index) {
    var f = favoritesData[index]; if (!f) return;
    setEditorValue(f.sql || '');
    closeFavorites();
    setTimeout(function() { executeQuery(); }, 100);
}
function deleteFavorite(index) {
    var f = favoritesData[index]; if (!f) return;
    if (!confirm('Delete favorite "' + f.name + '"?')) return;
    ajaxPost(SERVLET_URL + '?action=favoriteDelete', { id: f.id },
        function(responseText) {
            try { var r = JSON.parse(responseText); if (r.status === 'ok') { loadFavoritesList(); } else { alert(r.message || 'Failed to delete favorite.'); } }
            catch (e) { alert('Failed to delete favorite.'); }
        },
        function(sc) { alert('Network error (HTTP ' + sc + ')'); }
    );
}

/* ═══════════════════════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════════════════════ */
var TEMPLATES = {
    'select': "SELECT TOP 100 *\nFROM TableName WITH (NOLOCK)\nWHERE 1 = 1\n-- AND Column = 'Value'\nORDER BY 1",
    'update': "-- UPDATE TableName\n-- SET Column = 'NewValue'\n-- WHERE ID = 1",
    'delete': "-- DELETE FROM TableName\n-- WHERE ID = 1",
    'exec': "EXEC ProcedureName\n  @Param1 = 'Value1',\n  @Param2 = 123",
    'nolock': "SELECT t.*, o.ColumnName\nFROM TableOne t WITH (NOLOCK)\nINNER JOIN TableTwo o WITH (NOLOCK)\n  ON t.ID = o.TableOneID\nWHERE t.Status = 'Active'\nORDER BY t.ID"
};

function loadTemplate(name) {
    closeAllMenus(null);
    var tpl = TEMPLATES[name];
    if (!tpl) return;
    if (getSqlRaw().trim().length > 0 && getSql() !== lastExecutedSql) {
        if (!confirm('Replace current unsaved query with the ' + name.toUpperCase() + ' template?')) return;
    }
    setEditorValue(tpl);
    focusEditor();
}

/* ═══════════════════════════════════════════════════════
   STATS
   ═══════════════════════════════════════════════════════ */
function resetStats() {
    setText('statType', '—'); setText('statTime', '—'); setText('statRows', '—');
    setText('statAffected', '—'); setText('statSets', '—'); setText('statStatus', 'Ready');
    var typeEl = document.getElementById('statType');
    var statusEl = document.getElementById('statStatus');
    if (typeEl) typeEl.className = 'stat-val stat-info';
    if (statusEl) statusEl.className = 'stat-val';
}

function setStatType(qtype) {
    var el = document.getElementById('statType');
    if (!el) return;
    el.innerHTML = qtype; el.className = 'stat-val';
    if (qtype === 'SELECT' || qtype === 'EXEC') el.className += ' stat-ok';
    else if (qtype === 'UPDATE' || qtype === 'DELETE' || qtype === 'DROP' || qtype === 'TRUNCATE') el.className += ' stat-err';
    else el.className += ' stat-info';
}

function showLoading(on) { var spinner = document.getElementById('loadingSpinner'); if (spinner) spinner.className = on ? 'spinner-overlay show' : 'spinner-overlay'; }

/* ═══════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════ */
function setText(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = String(val); }
function escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ajaxGet(url, successFn, errorFn) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() { if (xhr.readyState === 4) { if (xhr.status === 200) { if (successFn) successFn(xhr.responseText); } else { if (errorFn) errorFn(xhr.status); } } };
    xhr.send();
}

function ajaxPost(url, params, successFn, errorFn) {
    var xhr = new XMLHttpRequest();
    currentXhr = xhr;
    var body = [];
    for (var key in params) { if (params.hasOwnProperty(key)) { body.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key])); } }
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            currentXhr = null;
            if (xhr.status === 200) { if (successFn) successFn(xhr.responseText); }
            else { if (errorFn) errorFn(xhr.status); }
        }
    };
    xhr.send(body.join('&'));
}

/* ═══════════════════════════════════════════════════════
   KEYBOARD
   ═══════════════════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
    if (e.key === 'F5') { e.preventDefault(); if (LOGGED_IN && !queryRunning) executeQuery(); }
    if (e.key === 'Escape') { closeConfirm(); }
});

/* ═══════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════ */
window.onload = function() {
    updateLineNumbers();
    updateHighlight();
    updateMetaStrip();
    initSplitter();

    var dbSel = document.getElementById('dbSelect');
    if (dbSel) dbSel.value = CURRENT_TARGET;
    applyTargetStyle();

    if (LOGGED_IN) {
        ajaxGet(SERVLET_URL + '?action=history',
            function(responseText) { try { var list = JSON.parse(responseText); setText('historyCountInline', list.length > 0 ? list.length : ''); historyData = list; } catch (e) { /* ignore */ } },
            function() { /* ignore */ }
        );
        loadFavoritesCount();
    }
};

</script>
</body>
</html>