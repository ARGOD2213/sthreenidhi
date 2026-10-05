/*
 * CEO Loan Intelligence Dashboard
 * Holds the snapshot currently served. A failed refresh never replaces a good one.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.ceo.cache;

import com.tcs.shg.ceo.bean.CeoDashboardSnapshot;
import com.tcs.shg.ceo.util.CeoLog;
import com.tcs.shg.ceo.util.CeoResponseCache;

public final class CeoDashCache {
    private CeoDashCache() { }

    private static volatile CeoDashboardSnapshot CURRENT = null;
    private static volatile long   lastAttemptMillis = 0L;
    private static volatile long   lastSuccessMillis = 0L;
    private static volatile String lastError         = "";
    private static volatile boolean loading          = false;

    public static CeoDashboardSnapshot get()         { return CURRENT; }
    public static boolean isReady()                  { return CURRENT != null; }
    public static boolean isLoading()                { return loading; }
    public static long getLastAttemptMillis()        { return lastAttemptMillis; }
    public static long getLastSuccessMillis()        { return lastSuccessMillis; }
    public static String getLastError()              { return lastError; }

    public static synchronized boolean beginLoad() {
        if (loading) return false;
        loading = true;
        lastAttemptMillis = System.currentTimeMillis();
        return true;
    }
    public static synchronized void endLoad() { loading = false; }

    public static synchronized void publish(CeoDashboardSnapshot snap) {
        if (snap == null || !snap.isValidated()) {
            CeoLog.warn("Refusing to publish unvalidated snapshot");
            return;
        }
        CURRENT = snap;
        CeoResponseCache.clear();
        lastSuccessMillis = System.currentTimeMillis();
        lastError = "";
        CeoLog.info("Snapshot PUBLISHED  fy=" + snap.getFyLabel()
                + " builtAt=" + snap.getBuiltAtMillis()
                + " districts=" + snap.getDistricts().size());
    }
    public static void recordError(String msg) {
        lastError = msg == null ? "" : msg;
        CeoLog.error("Snapshot refresh failed: " + lastError);
    }
}
