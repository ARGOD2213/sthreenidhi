# Setting up in Eclipse 2019-12 and testing on Tomcat 5.5

Token security is OFF until you set `-Dsthreenidhi.token.secret`. For this first test the dashboard is open.

## A. Create the project (about 5 minutes)

1. **File -> New -> Dynamic Web Project**
   - Project name: `STHREENIDHI`
   - Target runtime: **Apache Tomcat v5.5** (the one you already use)
   - Dynamic web module version: **2.4**
   - Configuration: Default
   - **Next** -> Source folder `src`, Default output folder `build/classes` -> **Next**
   - Content directory `WebContent`; **untick** "Generate web.xml deployment descriptor" -> **Finish**
2. Unzip `sthreenidhi-project.zip` somewhere. Copy into the new project (drag into Project Explorer, or copy in Windows Explorer then press F5 on the project):
   - the folder `src` (merge) 
   - the contents of `WebContent` (merge; say Yes to replace `WEB-INF/web.xml`)
   - `build.xml`, and the folders `ear`, `docs`, `deploy`
3. Right-click the project -> **Properties**
   - **Java Compiler**: compiler compliance level **1.6**
   - **Java Build Path -> Libraries**: JRE System Library must be your **JavaSE-1.6** (jdk1.6.0_43); the "Web App Libraries" shows `poi-3.10-FINAL.jar` and `commons-codec-1.5.jar`
   - **Targeted Runtimes**: Apache Tomcat v5.5 ticked
4. **Project -> Clean...** (clean all, build). The Problems view should have **no errors**.
   If it complains about `javax.servlet` the Tomcat 5.5 runtime is not ticked (step 3).

## B. Run it on Tomcat 5.5

1. Check the data source: the Tomcat 5.5 server must define `SNBSAP_DS` (the same way it does for AWFPREPORTS:
   `Servers/Tomcat v5.5 Server at localhost-config/context.xml`, or `AWFPREPORTS/WebContent/META-INF/context.xml`).
   If it does not, add the `<Resource name="SNBSAP_DS" .../>` from `deploy/other-servers-only/tomcat55-context-sample.xml`
   to the server's `context.xml`. The jTDS jar must be in Tomcat's `common/lib`.
2. Right-click `STHREENIDHI` -> **Run As -> Run on Server** -> Tomcat v5.5 -> Finish.
   (Do not run AWFPREPORTS on the same server at the same time during this first test.)
3. Console should show lines like `[CEO-DASH] ... CeoDashStartupListener: initializing`, a WARN
   `Access: ... OPEN` (expected for now), then `Loading CEO dashboard snapshot` and `DAO ... rows=... ms=...`.

## C. Test checklist (port may be 8080 or yours)

| # | Open | Expect |
|---|---|---|
| 1 | `http://localhost:8080/sthreenidhi/` | "Sthreenidhi dashboards" text page |
| 2 | `.../sthreenidhi/CeoLoanIntelligence?action=status` | `ready=false loading=true` while it builds (about 20 min) |
| 3 | `.../CeoLoanIntelligence?action=page` | "Dashboard data is being prepared" until ready |
| 4 | after `ready=true`: `.../CeoLoanIntelligence?action=page` | the full dashboard |
| 5 | click Overview, Loans Given, Repayments, Employee, Calendar; open a district, mandal, VO, SHG, a woman | all load, no "Could not load" |
| 6 | Excel download buttons | `.xls` file downloads |
| 7 | compare with AWFPREPORTS (same link on the old app) | same numbers |

## D. Build the EAR for JBoss

Right-click `build.xml` -> **Run As -> Ant Build** (default target `ear`) -> `dist/sthreenidhi.ear`.
Copy it to the JBoss `deploy` folder. Do NOT deploy a second `SNBSAP_DS` (the live JBoss has it).

## If something fails, send me

- the `[CEO-DASH]` lines from the Console (mask nothing sensitive: there are no passwords in them)
- the Problems view text
- what you opened and what you saw
