/*
 * CEO Loan Intelligence Dashboard
 * Starts the snapshot loader when the application starts and stops it on undeploy.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package com.tcs.shg.ceo.listener;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import com.tcs.shg.ceo.cache.CeoDashCacheLoader;
import com.tcs.shg.ceo.util.CeoLog;

public class CeoDashStartupListener implements ServletContextListener {
    public void contextInitialized(ServletContextEvent sce) {
        CeoLog.info("CeoDashStartupListener: initializing");
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
