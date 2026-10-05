# Sthreenidhi (CEO Loan Intelligence) - Java 6 / JBoss 5 EAR

Public URL (context root `sthreenidhi`, replaces `AWFPREPORTS`):

    https://<host>/sthreenidhi/CeoLoanIntelligence?action=page

## Layout

    pom.xml                      parent build (Java 6 source/target)
    sthreenidhi-web/             WAR: servlet, listener, DAO, cache, JSP, WEB-INF
    sthreenidhi-ear/             EAR wrapper: sets context root, jboss-app.xml
    deploy/sthreenidhi-ds.xml    JBoss data source (DB URL + user + PASSWORD) - NOT inside the EAR
    docs/                        office README (counting rules, log lines, -D options)
    office-reference/            old office pieces (QueryTool, FrontServlet handler) - not built

## Build (JDK 6, Maven 3.0 - 3.2.x; Maven 3.3+ needs JDK 7+)

    mvn clean package

Result: `sthreenidhi-ear/target/sthreenidhi.ear`

To change the URL path, edit `app.context.root` in the parent `pom.xml`.

## Deploy on JBoss 5.0

1. Copy `deploy/sthreenidhi-ds.xml` to `<JBOSS_HOME>/server/<profile>/deploy/` and edit
   host, user and password (the three `CHANGE_ME` values).
2. Put the SQL Server JDBC driver (`sqljdbc4.jar` or jtds) in `<JBOSS_HOME>/server/<profile>/lib/`.
3. Copy `sthreenidhi.ear` to the same `deploy/` folder.
4. Optional JBoss options (`bin/run.conf`): `-Dceo.dash.refresh.hour=8` and the others in
   `docs/CEO_Dashboard_Office_README.md` section 10.
5. Open `.../sthreenidhi/CeoLoanIntelligence?action=status`: `ready=true` once the first
   snapshot is built (about 20 minutes on first start).

The data source is bound as `java:/SNBSAP_DS`; the web app maps it through `resource-ref SNBSAP_DS`.

## Still to copy in from the office

The dashboard page itself is not in this repo yet. Replace these placeholders with the office files:

- `sthreenidhi-web/src/main/webapp/accounting/CeoLoanIntelligence.jsp`
- `sthreenidhi-web/src/main/webapp/scripts/app.js`
- `sthreenidhi-web/src/main/webapp/css/app.css`

If the JSP or `app.js` contain `/AWFPREPORTS/` anywhere, change it to use `request.getContextPath()`.
