/*
 * CEO Loan Intelligence Dashboard
 * The read model the dashboard is served from. Built once per refresh, never changed after.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.bean;

import java.io.Serializable;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class CeoDashboardSnapshot implements Serializable {
    private static final long serialVersionUID = 5L;

    private final long    builtAtMillis;
    private final String  fyLabel;
    private final String  fyStart;
    private final String  fyEnd;

    private final List    districts;
    private final List    months;
    private final List    monthly;
    private final List    daily;
    private final List    projects;
    private final List    purposes;
    private final List    mandals;
    private final List    employees;
    private final Map     totals;
    private final CeoDashCube cube;
    private final CeoDashCube dayCube;
    private final CeoDashCube purposeCube;
    private final Map     fyMandal;

    private final boolean validated;

    public CeoDashboardSnapshot(long builtAtMillis, String fyLabel, String fyStart, String fyEnd,
                                List districts, List months, List monthly, List daily, List projects, List purposes,
                                List mandals, List employees, Map totals, CeoDashCube cube, CeoDashCube dayCube,
                                CeoDashCube purposeCube, Map fyMandal, boolean validated) {
        this.builtAtMillis = builtAtMillis;
        this.fyLabel   = fyLabel;
        this.fyStart   = fyStart;
        this.fyEnd     = fyEnd;
        this.districts = Collections.unmodifiableList(districts);
        this.months    = Collections.unmodifiableList(months);
        this.monthly   = Collections.unmodifiableList(monthly);
        this.daily     = Collections.unmodifiableList(daily);
        this.projects  = Collections.unmodifiableList(projects);
        this.purposes  = Collections.unmodifiableList(purposes);
        this.mandals   = Collections.unmodifiableList(mandals);
        this.employees = Collections.unmodifiableList(employees);
        this.totals    = Collections.unmodifiableMap(totals);
        this.cube      = cube;
        this.dayCube   = dayCube;
        this.purposeCube = purposeCube;
        this.fyMandal  = Collections.unmodifiableMap(fyMandal);
        this.validated = validated;
    }

    public long    getBuiltAtMillis() { return builtAtMillis; }
    public String  getFyLabel()       { return fyLabel; }
    public String  getFyStart()       { return fyStart; }
    public String  getFyEnd()         { return fyEnd; }
    public List    getDistricts()     { return districts; }
    public List    getMonths()        { return months; }
    public List    getMonthly()       { return monthly; }
    public List    getDaily()         { return daily; }
    public List    getProjects()      { return projects; }
    public List    getPurposes()      { return purposes; }
    public List    getMandals()       { return mandals; }
    public List    getEmployees()     { return employees; }
    public Map     getTotals()        { return totals; }
    public CeoDashCube getCube()      { return cube; }
    public CeoDashCube getDayCube()   { return dayCube; }
    public CeoDashCube getPurposeCube() { return purposeCube; }
    public Map     getFyMandal()      { return fyMandal; }
    public boolean isValidated()      { return validated; }

    public CeoDashboardSnapshot markValidated() {
        return new CeoDashboardSnapshot(builtAtMillis, fyLabel, fyStart, fyEnd,
                districts, months, monthly, daily, projects, purposes, mandals, employees, totals, cube, dayCube,
                purposeCube, fyMandal, true);
    }
}
