/*
 * CEO Loan Intelligence Dashboard
 * Starts the snapshot loader when the application starts and stops it on undeploy.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.listener;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.cache.CeoDashCacheLoader;
import in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.util.CeoLog;
import in.gov.ap.serp.sthreenidhi.platform.security.LinkToken;

public class CeoDashStartupListener implements ServletContextListener {
    public void contextInitialized(ServletContextEvent sce) {
        CeoLog.info("CeoDashStartupListener: initializing");
        if (LinkToken.enabled()) {
            CeoLog.info("Access: signed links required (sthreenidhi.token.secret is set)");
        } else {
            CeoLog.warn("Access: sthreenidhi.token.secret is NOT set - the dashboard is OPEN to anyone with the URL");
        }
        Thread t = new Thread(new Runnable() {
            public void run() {
                try {
                    CeoDashCacheLoader.start();
                    CeoLog.info("CeoDashStartupListener: initial load + schedule complete");
                } catch (Throwable x) {
                    CeoLog.error("CeoDashStartupListener failure", x);
                }
            }
        }, "CeoDash-Initial-Load");
        t.setDaemon(true);
        t.start();
    }

    public void contextDestroyed(ServletContextEvent sce) {
        CeoDashCacheLoader.shutdown();
        CeoLog.info("CeoDashStartupListener: context destroyed");
    }
}
