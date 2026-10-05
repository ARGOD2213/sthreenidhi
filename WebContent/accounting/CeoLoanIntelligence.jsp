<%@ page language="java" contentType="text/html; charset=UTF-8" import="java.util.Map" %>
<%--
  PLACEHOLDER. Replace this file with the office CeoLoanIntelligence.jsp
  (keep the same path: /accounting/CeoLoanIntelligence.jsp). It only shows that the
  application, the data source and the snapshot are working.
--%>
<%
    Boolean ready = (Boolean) request.getAttribute("snapshotReady");
    Map boot = (Map) request.getAttribute("bootData");
%>
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Sthreenidhi</title></head>
<body>
<h2>Sthreenidhi - CEO Loan Intelligence</h2>
<% if (ready == null || !ready.booleanValue()) { %>
  <p>Dashboard data is being prepared. Check
     <a href="<%= request.getContextPath() %>/CeoLoanIntelligence?action=status">status</a>.</p>
<% } else { %>
  <p>Data is ready for FY <%= String.valueOf(boot.get("fyLabel")).replaceAll("[^0-9A-Za-z-]", "") %>.
     Replace this placeholder page with the real dashboard JSP.</p>
<% } %>
</body>
</html>
