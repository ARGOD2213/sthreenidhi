/*
 * CEO Loan Intelligence Dashboard
 * Read-only queries used by the CEO Loan Intelligence dashboard.
 *
 * Designed and architected by CHINTALA MAHINDRA
 */
package in.gov.ap.serp.sthreenidhi.dashboard.ceoloan.dao;

import java.util.ArrayList;

public interface CeoLoanIntelligenceDAO {
    ArrayList getActiveMandals() throws Exception;

    ArrayList getOfficerMandalMapping() throws Exception;

    ArrayList getDistrictRollup(String fyLabel, String fyStart, String fyEnd) throws Exception;

    ArrayList getMandalDailyLoanRollup(String periodStart, String periodEnd) throws Exception;

    ArrayList getMandalDailyRepaymentRollup(String periodStart, String periodEnd) throws Exception;

    ArrayList getDistrictProjectComposition(String periodStart, String periodEnd) throws Exception;

    ArrayList getMandalLoanRollup(String periodStart, String periodEnd) throws Exception;

    ArrayList getMandalTargetRollup(String fyLabel) throws Exception;

    ArrayList getLoanCube(String periodStart, String periodEnd) throws Exception;

    ArrayList getMandalPurposeRollup(String periodStart, String periodEnd) throws Exception;

    ArrayList getShgInfo(String shgId) throws Exception;

    ArrayList getProjectNames() throws Exception;

    // repayments entered by a person's login (not an online channel), per login: CREATED_BY, TXN_COUNT, AMOUNT, FIRST_DATE, LAST_DATE
    ArrayList getCashKeyedBy(String periodStart, String periodEnd) throws Exception;

    ArrayList getRepaymentCube(String periodStart, String periodEnd) throws Exception;

    // overdue (arrears) of today's open loans per mandal: from the daily-refreshed loan status table
    ArrayList getMandalOverdueRollup() throws Exception;

    ArrayList drill(String group, String districtId, String mandalId, String voId, String shgId,
                    String periodStart, String periodEnd, String projectType) throws Exception;

    ArrayList getMemberDetail(String memberId) throws Exception;

    ArrayList getShgMemberLoans(String shgId) throws Exception;
}
