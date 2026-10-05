# Sthreenidhi (CEO Loan Intelligence) - Java 6 / JBoss 5 EAR, Eclipse project

Open link (context root `sthreenidhi`, replaces `AWFPREPORTS`):

    https://<host>/sthreenidhi/CeoLoanIntelligence?action=page

## Layout

    src/                 Java sources (Java 6 only)
    WebContent/          JSP, app.js, app.css, WEB-INF (web.xml, jboss-web.xml, lib/ = POI + codec)
    lib-provided/        servlet-api / jsp-api: for compiling only, NOT packaged (JBoss supplies them)
    ear/META-INF/        application.xml (context root) + jboss-app.xml
    build.xml            Ant script that makes dist/sthreenidhi.ear
    deploy/              sthreenidhi-ds.xml  (database URL / user / password, goes next to the EAR)
    docs/                office README (counting rules, log lines, -D options) and PERFORMANCE.md
    office-reference/    old office pieces (QueryTool, FrontServlet handler) - not built

## Open in Eclipse (no Maven, no server plug-in needed)

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

## Deploy on JBoss 5.0

1. Copy `deploy/sthreenidhi-ds.xml` to `<JBOSS_HOME>/server/<profile>/deploy/`, edit host, user and
   password (the three `CHANGE_ME` values). The password lives only there.
2. Put `jtds-1.3.1.jar` (same as the office AWFPREPORTS uses) in `<JBOSS_HOME>/server/<profile>/lib/`. Not `mssql-jdbc ...jre8.jar` - that needs Java 8.
3. Copy `dist/sthreenidhi.ear` into the same `deploy/` folder.
4. Settings and JVM tuning: `docs/PERFORMANCE.md`, `docs/CEO_Dashboard_Office_README.md` section 10.
5. Open `.../sthreenidhi/CeoLoanIntelligence?action=status` - `ready=true` once the first snapshot is built.

The data source is bound as `java:/SNBSAP_DS`; the web app maps it through `resource-ref SNBSAP_DS`.

## Not in the repo yet

- `WebContent/Assets/Images/emblem.png` - the header emblem. `app.js` asks for `/sthreenidhi/Assets/Images/emblem.png`;
  without the file the page falls back to a plain mark (no error). Copy the office `Assets/Images` folder here if you want it.
- The page also loads Google Fonts from the internet (`fonts.googleapis.com`); on a server network without
  internet it simply uses system fonts.
