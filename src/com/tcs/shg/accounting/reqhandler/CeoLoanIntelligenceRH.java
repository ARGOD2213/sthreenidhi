/*
 * CEO Loan Intelligence Dashboard
 * Request handler for the CEO dashboard page on the FrontServlet route.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.accounting.reqhandler;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import com.tcs.sgv.common.requesthandler.BaseHandler;
import com.tcs.shg.ceo.bean.CeoDashboardSnapshot;
import com.tcs.shg.ceo.cache.CeoDashCache;
import com.tcs.shg.ceo.util.CeoLog;
import com.tcs.shg.util.CommonUtility;

public class CeoLoanIntelligenceRH extends BaseHandler {
    public String processRequest(HttpServletRequest request, HttpServletResponse response)
            throws Exception {
        String lstrReturnPage = "";
        String actionVal = "";

        try {
            if (request.getParameter("actionVal") != null
                    && request.getParameter("actionVal").length() > 0) {
                actionVal = request.getParameter("actionVal");
                request.setAttribute("actionVal", actionVal);

                if (actionVal.equals("status")) {
                    return getStatusPage(request, response);
                }
            }

            lstrReturnPage = loadDashboard(request, response);
        } catch (Exception e) {
            CeoLog.error("CEO dashboard page failed", e);
            return "ErrorPage";
        }

        return lstrReturnPage;
    }

    private String loadDashboard(HttpServletRequest request, HttpServletResponse response)
            throws Exception {
        prepareDashboardAttributes(request);
        return "CeoLoanIntelligence";
    }

    public static void prepareDashboardAttributes(HttpServletRequest request) {
        CeoDashboardSnapshot snap = CeoDashCache.get();
        if (snap == null) {
            request.setAttribute("snapshotReady", Boolean.FALSE);
            request.setAttribute("snapshotMessage", "Dashboard data is loading...");
        } else {
            request.setAttribute("snapshotReady", Boolean.TRUE);
            request.setAttribute("bootData", toBootData(snap));
        }
        String chapter = CommonUtility.checkNullObj(request.getParameter("chapter"));
        if (chapter.length() == 0) chapter = "pulse";
        request.setAttribute("initialChapter", chapter);
        request.setAttribute("randId", CommonUtility.checkNullObj(request.getAttribute("randId")));
    }

    private String getStatusPage(HttpServletRequest request, HttpServletResponse response)
            throws Exception {
        response.setContentType("text/plain; charset=UTF-8");
        response.getWriter().println("ready=" + CeoDashCache.isReady());
        response.getWriter().println("loading=" + CeoDashCache.isLoading());
        response.getWriter().println("lastError=" + CeoDashCache.getLastError());
        response.getWriter().flush();
        return null;
    }

    private static Map toBootData(CeoDashboardSnapshot snap) {
        Map boot = new HashMap();
        boot.put("fyLabel", CommonUtility.checkNullObj(snap.getFyLabel()));
        boot.put("fyStart", CommonUtility.checkNullObj(snap.getFyStart()));
        boot.put("fyEnd",   CommonUtility.checkNullObj(snap.getFyEnd()));
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
}
