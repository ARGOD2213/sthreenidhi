/*
 * Sthreenidhi platform
 * Looks up a JBoss / Tomcat data source by JNDI name (and keeps it), so every dashboard gets its
 * database connections the same way and no password ever lives in the application.
 * Java 6 compatible.
 */
package in.gov.ap.serp.sthreenidhi.platform.db;

import java.sql.Connection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.sql.DataSource;

public final class DataSources {
    private static final ConcurrentMap CACHE = new ConcurrentHashMap();

    private DataSources() { }

    /*
     * The JNDI name can be changed without a rebuild: -Dsthreenidhi.ds.<alias>=NAME.
     * Example: alias "snbsap" reads -Dsthreenidhi.ds.snbsap and defaults to SNBSAP_DS.
     */
    public static String jndiName(String alias, String defaultName) {
        String v = System.getProperty("sthreenidhi.ds." + alias);
        return v == null || v.trim().length() == 0 ? defaultName : v.trim();
    }

    public static Connection connection(String alias, String defaultName) throws Exception {
        return lookup(jndiName(alias, defaultName)).getConnection();
    }

    public static DataSource lookup(String name) throws Exception {
        DataSource ds = (DataSource) CACHE.get(name);
        if (ds != null) return ds;

        InitialContext ic = new InitialContext();
        // 1. web-app scoped (Tomcat context.xml Resource, or a resource-ref)
        try {
            Context env = (Context) ic.lookup("java:comp/env");
            ds = (DataSource) env.lookup(name);
        } catch (Exception e) { ds = null; }
        // 2. JBoss global name  java:/NAME
        if (ds == null) {
            try { ds = (DataSource) ic.lookup("java:/" + name); } catch (Exception e) { ds = null; }
        }
        // 3. bare name
        if (ds == null) {
            try { ds = (DataSource) ic.lookup(name); } catch (Exception e) { ds = null; }
        }
        if (ds == null) {
            throw new Exception("DataSource " + name + " not found in JNDI. "
                    + "Check that it is declared in the JBoss *-ds.xml (or the Tomcat context.xml).");
        }
        CACHE.put(name, ds);
        return ds;
    }
}
