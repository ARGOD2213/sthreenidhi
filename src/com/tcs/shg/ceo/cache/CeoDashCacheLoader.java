/*
 * CEO Loan Intelligence Dashboard
 * Builds the snapshot at start-up and on a timer, and keeps a saved copy on disk
 * (ceo-dash-snapshot.ser.gz) so a restart does not wait for a full rebuild.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.ceo.cache;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.Calendar;
import java.util.Timer;
import java.util.TimerTask;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import com.tcs.shg.accounting.DAO.CeoLoanIntelligenceDAOImpl;
import com.tcs.shg.ceo.bean.CeoDashboardSnapshot;
import com.tcs.shg.ceo.bean.CeoDashboardSnapshotValidator;
import com.tcs.shg.ceo.util.CeoFiscalYear;
import com.tcs.shg.ceo.util.CeoLog;

public final class CeoDashCacheLoader {
    public static final long DEFAULT_REFRESH_SECONDS = 12L * 60L * 60L;
    private static final String FILE_NAME = "sthreenidhi-ceo-snapshot.ser.gz";

    private static Timer TIMER = null;
    private static volatile boolean STOPPED = false;

    private CeoDashCacheLoader() { }

    public static long resolveRefreshSeconds() {
        String p = System.getProperty("ceo.dash.refresh.seconds");
        if (p == null || p.trim().length() == 0) return DEFAULT_REFRESH_SECONDS;
        try { return Long.parseLong(p.trim()); }
        catch (Exception e) { return DEFAULT_REFRESH_SECONDS; }
    }

    public static void start() {
        STOPPED = false;
        long refreshMs = resolveRefreshSeconds() * 1000L;
        long ageMs = restoreFromDisk();
        if (ageMs >= 0 && ageMs < refreshMs) {
            scheduleRefresh(refreshMs - ageMs);
            return;
        }
        loadNow();
        scheduleRefresh(refreshMs);
    }

    public static void loadNow() {
        if (!CeoDashCache.beginLoad()) {
            CeoLog.warn("Load already in progress; skipping");
            return;
        }
        try {
            String fyLabel = resolveFyLabel();
            CeoLog.info("Loading CEO dashboard snapshot  fy=" + fyLabel);

            CeoDashboardSnapshot snap =
                    CeoDashboardSnapshotBuilder.build(new CeoLoanIntelligenceDAOImpl(), fyLabel);
            String reason = CeoDashboardSnapshotValidator.validate(snap);
            if (reason != null) {
                CeoDashCache.recordError("validation failed: " + reason);
                return;
            }
            if (STOPPED) {
                CeoLog.warn("Application was undeployed during the build; result discarded");
                return;
            }
            CeoDashboardSnapshot ok = snap.markValidated();
            CeoDashCache.publish(ok);
            saveToDisk(ok);
        } catch (Throwable t) {
            CeoDashCache.recordError(t.getMessage());
            CeoLog.error("Snapshot load failed", t);
        } finally {
            CeoDashCache.endLoad();
        }
    }

    public static synchronized void scheduleRefresh(long firstDelayMs) {
        if (TIMER != null) return;
        long periodMs = resolveRefreshSeconds() * 1000L;
        long first = Math.max(60000L, firstDelayMs);
        long atHour = untilRefreshHour();
        if (atHour >= 0) first = Math.max(60000L, atHour);
        CeoLog.info("Scheduling CEO dashboard refresh every " + (periodMs / 1000L)
                + " seconds, next in " + (first / 60000L) + " min");
        TIMER = new Timer("CeoDash-Refresher", true);
        TIMER.scheduleAtFixedRate(new TimerTask() {
            public void run() { loadNow(); }
        }, first, periodMs);
    }

    // -Dceo.dash.refresh.hour=0..23 runs the scheduled build at that hour
    private static long untilRefreshHour() {
        String v = System.getProperty("ceo.dash.refresh.hour");
        int h;
        try { h = Integer.parseInt(v == null ? "" : v.trim()); } catch (Exception e) { return -1; }
        if (h < 0 || h > 23) return -1;
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, h);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DATE, 1);
        return next.getTimeInMillis() - System.currentTimeMillis();
    }

    public static synchronized void shutdown() {
        STOPPED = true;
        if (TIMER != null) {
            TIMER.cancel();
            TIMER = null;
            CeoLog.info("CEO dashboard refresh timer stopped");
        }
    }

    // -Dceo.dash.snapshot.file, else the JBoss data folder, else the temp folder
    static File snapshotFile() {
        String f = System.getProperty("ceo.dash.snapshot.file");
        if (f != null && f.trim().length() > 0) return new File(f.trim());
        String dir = System.getProperty("jboss.server.data.dir");
        if (dir == null || dir.trim().length() == 0) dir = System.getProperty("java.io.tmpdir");
        return new File(dir, FILE_NAME);
    }

    private static void saveToDisk(CeoDashboardSnapshot snap) {
        long t0 = System.currentTimeMillis();
        File target = snapshotFile();
        File tmp = new File(target.getPath() + ".tmp");
        FileOutputStream raw = null;
        ObjectOutputStream out = null;
        try {
            raw = new FileOutputStream(tmp);
            out = new ObjectOutputStream(new GZIPOutputStream(new BufferedOutputStream(raw)));
            out.writeObject(snap);
            out.close();
            out = null;
            raw = null;
            if (target.exists() && !target.delete()) {
                CeoLog.warn("Could not replace " + target + "; saved copy not updated");
                return;
            }
            if (!tmp.renameTo(target)) {
                CeoLog.warn("Could not rename " + tmp + " to " + target);
                return;
            }
            CeoLog.info("Snapshot saved to " + target + " (" + (target.length() / 1024L) + " KB, "
                    + (System.currentTimeMillis() - t0) + " ms)");
        } catch (Throwable t) {
            CeoLog.warn("Snapshot not saved to " + target + ": " + t);
        } finally {
            if (out != null) { try { out.close(); } catch (Exception ignore) { } }
            if (raw != null) { try { raw.close(); } catch (Exception ignore) { } }
            if (tmp.exists()) tmp.delete();
        }
    }

    private static long restoreFromDisk() {
        File f = snapshotFile();
        if (!f.isFile()) {
            CeoLog.info("No saved snapshot at " + f + "; building from SNBSAP");
            return -1;
        }
        long t0 = System.currentTimeMillis();
        FileInputStream raw = null;
        ObjectInputStream in = null;
        try {
            raw = new FileInputStream(f);
            in = new ObjectInputStream(new GZIPInputStream(new BufferedInputStream(raw)));
            Object o = in.readObject();
            if (!(o instanceof CeoDashboardSnapshot)) {
                CeoLog.warn("Saved snapshot " + f + " has an unknown format; ignored");
                return -1;
            }
            CeoDashboardSnapshot snap = (CeoDashboardSnapshot) o;
            String fy = resolveFyLabel();
            if (!fy.equals(snap.getFyLabel())) {
                CeoLog.info("Saved snapshot is for FY " + snap.getFyLabel() + ", current FY is " + fy + "; ignored");
                return -1;
            }
            String reason = CeoDashboardSnapshotValidator.validate(snap);
            if (reason != null || !snap.isValidated()) {
                CeoLog.warn("Saved snapshot failed validation (" + reason + "); ignored");
                return -1;
            }
            CeoDashCache.publish(snap);
            long age = Math.max(0L, System.currentTimeMillis() - snap.getBuiltAtMillis());
            CeoLog.info("Snapshot RESTORED from " + f + " in " + (System.currentTimeMillis() - t0)
                    + " ms, built " + (age / 60000L) + " min ago");
            return age;
        } catch (Throwable t) {
            CeoLog.warn("Saved snapshot " + f + " could not be read (" + t + "); building from SNBSAP");
            return -1;
        } finally {
            if (in != null) { try { in.close(); } catch (Exception ignore) { } }
            if (raw != null) { try { raw.close(); } catch (Exception ignore) { } }
        }
    }

    private static String resolveFyLabel() {
        String override = System.getProperty("ceo.dash.fy");
        if (override != null && override.trim().length() > 0) return override.trim();
        return CeoFiscalYear.currentFyLabel(new java.util.Date());
    }
}
