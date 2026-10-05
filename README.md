# Sthreenidhi (CEO Loan Intelligence) - Java 6 / JBoss 5 EAR, Eclipse project

Open link (context root `sthreenidhi`, replaces `AWFPREPORTS`):

    https://<host>/sthreenidhi/CeoLoanIntelligence?action=page

## Layout

    src/in/gov/ap/serp/sthreenidhi/
        platform/            shared: security (signed links), web (cache, gzip), db (data sources), util
        dashboard/ceoloan/   the CEO Loan Intelligence dashboard (web, service, dao, bean, cache, listener, util)
    WebContent/
        dashboards/ceo-loan-intelligence/   page (JSP), app.js, app.css of that dashboard
        WEB-INF/             web.xml (2.4), jboss-web.xml (context root + serpap-host), lib/ (POI, codec)
    lib-provided/            servlet-api / jsp-api: compile only, NOT packaged
    ear/META-INF/            application.xml (context root) + jboss-app.xml
    build.xml                Ant script -> dist/sthreenidhi.ear
    deploy/other-servers-only/   data source / Tomcat samples for machines WITHOUT the live SNBSAP_DS
    docs/                    EXTERNAL_SITE.md (signed links), ADD_A_DASHBOARD.md, PERFORMANCE.md, office notes
    office-reference/        old office pieces (QueryTool, FrontServlet handler) - not built

## Open in Eclipse - see docs/ECLIPSE_SETUP.md (new Dynamic Web Project + Tomcat 5.5 test). Quick alternative:

1. File -> Import -> General -> Existing Projects into Workspace -> pick this folder.
2. Project -> Properties -> Java Build Path -> Libraries: the JRE entry must be your **JDK 6**
   (Window -> Preferences -> Java -> Installed JREs -> add the JDK 6 folder if missing).
   Compiler compliance is already set to 1.6 (`.settings/org.eclipse.jdt.core.prefs`).
3. Project -> Build Automatically (classes go to `build/classes`).

## Build the EAR

Right-click `build.xml` -> Run As -> Ant Build -> default target `ear`.
Result: `dist/sthreenidhi.ear`.

- Target `ear-javac` compiles with javac first (only if Ant is running on a JDK; Eclipse's own
  compile + `ear` is the normal route).
- Another URL path: run the Ant build with `-Dcontext.root=/other` (Run As -> Ant Build... -> Properties).

## Deploy on JBoss 5.0 (the live server)

1. The data source `SNBSAP_DS` already exists on the live JBoss - **do not deploy another one**.
2. Set the link secret (see `docs/EXTERNAL_SITE.md`): `-Dsthreenidhi.token.secret=...` in `run.conf`.
   Without it the dashboard is open and the log says so.
3. Copy `dist/sthreenidhi.ear` into `<JBOSS_HOME>/server/<profile>/deploy/`.
4. Link for the other site: `https://serp.ap.gov.in/sthreenidhi/CeoLoanIntelligence?action=page&exp=..&sig=..`
   (the app joins the same virtual host `serpap-host` as AWFPREPORTS).
5. Tuning: `docs/PERFORMANCE.md`.

Remove the CEO dashboard (listener, servlet, mapping) from AWFPREPORTS once this is live, so only one
copy loads from SNBSAP.

## Local test on Tomcat 5.5

Use `deploy/other-servers-only/tomcat55-context-sample.xml` (data source) and run the WAR/WebContent there.

## Not in the repo yet

- `WebContent/Assets/Images/emblem.png` - the header emblem. `app.js` asks for `/sthreenidhi/Assets/Images/emblem.png`;
  without the file the page falls back to a plain mark (no error). Copy the office `Assets/Images` folder here if you want it.
- The page also loads Google Fonts from the internet (`fonts.googleapis.com`); on a server network without
  internet it simply uses system fonts.
