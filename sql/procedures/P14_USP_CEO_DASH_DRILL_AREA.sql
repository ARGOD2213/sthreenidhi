/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_DRILL_AREA
   Java      : CeoLoanIntelligenceDAOImpl.drill()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.drill() used to run
   Runs      : a click at state or district level for a part month the snapshot cannot answer (then cached)
   Returns   : one row per district, mandal or project: UNIT_ID, UNIT_NAME, ACTIVE_MEMBERS, loan and repayment measures

   Groups allowed: state level (no @DistrictId) DISTRICT or PROJECT;
   district level MANDAL or PROJECT. Period at most 31 days (longer periods come
   from the snapshot in memory). A woman is placed through her active SHG with the
   highest SHG_ID, exactly like the inline version.

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_DRILL_AREA @Group = 'MANDAL', @DistrictId = '07',
          @From = '2026-09-01', @To = '2026-09-16', @SnOnly = 1, @PayModes = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_DRILL_AREA
    @Group VARCHAR(10),
    @DistrictId VARCHAR(10) = NULL,
    @From DATETIME,
    @To DATETIME,
    @ProjectType VARCHAR(20) = NULL,
    @SnOnly BIT = 1,
    @PayModes BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Level VARCHAR(10) = CASE WHEN @DistrictId IS NULL THEN 'STATE' ELSE 'DISTRICT' END;
    SET @Group = UPPER(LTRIM(RTRIM(@Group)));

    -- same checks as the Java code: allowed groups per level, at most 31 days
    IF NOT ((@Level = 'STATE' AND @Group IN ('DISTRICT', 'PROJECT'))
         OR (@Level = 'DISTRICT' AND @Group IN ('MANDAL', 'PROJECT')))
    BEGIN
        RAISERROR('group %s is not available at %s level', 16, 1, @Group, @Level);
        RETURN;
    END
    IF @From >= @To OR DATEDIFF(DAY, @From, @To) > 31
    BEGIN
        RAISERROR('period must be 1 to 31 days at state / district level', 16, 1);
        RETURN;
    END

    IF @Group = 'DISTRICT'
    BEGIN
        SELECT U.UNIT_ID, U.UNIT_NAME, CAST(NULL AS INT) AS ACTIVE_MEMBERS,
               ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
               ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
               ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS,
               ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
               ISNULL(R.PAYERS, 0) AS PAYERS,
               ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO,
               ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO
          FROM (
                SELECT DM.DISTRICT_ID AS UNIT_ID, MAX(DM.DISTRICT_DESCRIPTION) AS UNIT_NAME
                  FROM DISTRICT_MASTER DM WITH (NOLOCK)
                 WHERE DM.FLAG = 'Y'
                 GROUP BY DM.DISTRICT_ID
               ) U
          LEFT JOIN (
                SELECT VI.DISTRICT_ID AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(MCP.LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN MCP.LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN MCP.LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS BORROWERS
                  FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
                 CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)
                               WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'
                               ORDER BY SMQ.SHG_ID DESC) SMX
                 INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'
                 INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
                 WHERE MCP.ISSUED_DATE >= @From AND MCP.ISSUED_DATE < @To
                   AND MCP.MEMBER_LONG_CODE IS NOT NULL
                   AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
                   AND LEN(MCP.MEMBER_LONG_CODE) >= 20
                   AND MCP.ISSUED_DATE IS NOT NULL
                   AND MCP.ISSUED_DATE > '2000-01-01'
                   AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
                   AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                            WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
                   AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                                WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
                   AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                                WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                                  AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
                   AND (@DistrictId IS NULL OR VI.DISTRICT_ID = @DistrictId)
                   AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
                 GROUP BY VI.DISTRICT_ID
               ) L ON L.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT VI.DISTRICT_ID AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 3 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 2 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 1 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
                 INNER JOIN (SELECT BCI.BANK_REF_NO, MIN(BCI.CREDITED_DATE) AS CREDITED_DATE
                               FROM BANKS_CREDIT_INFO BCI WITH (NOLOCK)
                              WHERE BCI.CREDITED_DATE >= @From AND BCI.CREDITED_DATE < @To
                                AND BCI.BANK_REF_NO IS NOT NULL
                              GROUP BY BCI.BANK_REF_NO) BC ON BC.BANK_REF_NO = SCI.BANK_REF_NO
                 INNER JOIN (SELECT VC.BANK_REF_NO,
                                    MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE'  THEN 3
                                             WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE'    THEN 2
                                             WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE,
                                    MAX(VC.CREATED_BY) AS CB
                               FROM VO_CREDIT_INFO VC WITH (NOLOCK)
                              WHERE VC.BANK_REF_NO IS NOT NULL AND VC.VO_REPAY_STATUS = 'CLOSED'
                              GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO
                 INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = SCI.SHG_MEMBER_LOAN_ACCNO
                 CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)
                               WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'
                               ORDER BY SMQ.SHG_ID DESC) SMX
                 INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'
                 INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
                 WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> ''
                   AND MCP.MEMBER_LONG_CODE IS NOT NULL
                   AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
                   AND LEN(MCP.MEMBER_LONG_CODE) >= 20
                   AND MCP.ISSUED_DATE IS NOT NULL
                   AND MCP.ISSUED_DATE > '2000-01-01'
                   AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
                   AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                            WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
                   AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                                WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
                   AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                                WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                                  AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
                   AND (@DistrictId IS NULL OR VI.DISTRICT_ID = @DistrictId)
                   AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
                 GROUP BY VI.DISTRICT_ID
               ) R ON R.UNIT_ID = U.UNIT_ID
         ORDER BY U.UNIT_NAME
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'MANDAL'
    BEGIN
        SELECT U.UNIT_ID, U.UNIT_NAME, CAST(NULL AS INT) AS ACTIVE_MEMBERS,
               ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
               ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
               ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS,
               ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
               ISNULL(R.PAYERS, 0) AS PAYERS,
               ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO,
               ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO
          FROM (
                SELECT MM.MANDAL_ID AS UNIT_ID, MAX(MM.MANDAL_DESCRIPTION) AS UNIT_NAME
                  FROM MANDAL_MASTER MM WITH (NOLOCK)
                 WHERE MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N'
                   AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                                WHERE DM.DISTRICT_ID = MM.DISTRICT_ID AND DM.FLAG = 'Y')
                   AND MM.DISTRICT_ID = @DistrictId
                 GROUP BY MM.MANDAL_ID
               ) U
          LEFT JOIN (
                SELECT VI.MANDAL_ID AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(MCP.LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN MCP.LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN MCP.LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS BORROWERS
                  FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
                 CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)
                               WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'
                               ORDER BY SMQ.SHG_ID DESC) SMX
                 INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'
                 INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
                 WHERE MCP.ISSUED_DATE >= @From AND MCP.ISSUED_DATE < @To
                   AND MCP.MEMBER_LONG_CODE IS NOT NULL
                   AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
                   AND LEN(MCP.MEMBER_LONG_CODE) >= 20
                   AND MCP.ISSUED_DATE IS NOT NULL
                   AND MCP.ISSUED_DATE > '2000-01-01'
                   AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
                   AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                            WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
                   AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                                WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
                   AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                                WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                                  AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
                   AND (@DistrictId IS NULL OR VI.DISTRICT_ID = @DistrictId)
                   AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
                 GROUP BY VI.MANDAL_ID
               ) L ON L.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT VI.MANDAL_ID AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 3 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 2 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 1 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
                 INNER JOIN (SELECT BCI.BANK_REF_NO, MIN(BCI.CREDITED_DATE) AS CREDITED_DATE
                               FROM BANKS_CREDIT_INFO BCI WITH (NOLOCK)
                              WHERE BCI.CREDITED_DATE >= @From AND BCI.CREDITED_DATE < @To
                                AND BCI.BANK_REF_NO IS NOT NULL
                              GROUP BY BCI.BANK_REF_NO) BC ON BC.BANK_REF_NO = SCI.BANK_REF_NO
                 INNER JOIN (SELECT VC.BANK_REF_NO,
                                    MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE'  THEN 3
                                             WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE'    THEN 2
                                             WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE,
                                    MAX(VC.CREATED_BY) AS CB
                               FROM VO_CREDIT_INFO VC WITH (NOLOCK)
                              WHERE VC.BANK_REF_NO IS NOT NULL AND VC.VO_REPAY_STATUS = 'CLOSED'
                              GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO
                 INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = SCI.SHG_MEMBER_LOAN_ACCNO
                 CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)
                               WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'
                               ORDER BY SMQ.SHG_ID DESC) SMX
                 INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'
                 INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
                 WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> ''
                   AND MCP.MEMBER_LONG_CODE IS NOT NULL
                   AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
                   AND LEN(MCP.MEMBER_LONG_CODE) >= 20
                   AND MCP.ISSUED_DATE IS NOT NULL
                   AND MCP.ISSUED_DATE > '2000-01-01'
                   AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
                   AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                            WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
                   AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                                WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
                   AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                                WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                                  AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
                   AND (@DistrictId IS NULL OR VI.DISTRICT_ID = @DistrictId)
                   AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
                 GROUP BY VI.MANDAL_ID
               ) R ON R.UNIT_ID = U.UNIT_ID
         ORDER BY U.UNIT_NAME
        OPTION (RECOMPILE);
        RETURN;
    END

    -- PROJECT
    SELECT COALESCE(L.UNIT_ID, R.UNIT_ID) AS UNIT_ID, MAX(PT.PROJECT_NAME) AS UNIT_NAME,
           CAST(NULL AS INT) AS ACTIVE_MEMBERS,
           MAX(ISNULL(L.LOAN_COUNT, 0)) AS LOAN_COUNT, MAX(ISNULL(L.DISBURSED_AMOUNT, 0)) AS DISBURSED_AMOUNT,
           MAX(ISNULL(L.OPEN_LOAN_COUNT, 0)) AS OPEN_LOAN_COUNT, MAX(ISNULL(L.CLOSED_LOAN_COUNT, 0)) AS CLOSED_LOAN_COUNT,
           MAX(ISNULL(L.OPEN_AMOUNT, 0)) AS OPEN_AMOUNT,
           MAX(ISNULL(L.BORROWERS, 0)) AS BORROWERS,
           MAX(ISNULL(R.REPAYMENT_TXN_COUNT, 0)) AS REPAYMENT_TXN_COUNT, MAX(ISNULL(R.REPAID_AMOUNT, 0)) AS REPAID_AMOUNT,
           MAX(ISNULL(R.PAYERS, 0)) AS PAYERS,
           MAX(ISNULL(R.REPAID_POS, 0)) AS REPAID_POS, MAX(ISNULL(R.REPAID_UPI, 0)) AS REPAID_UPI,
           MAX(ISNULL(R.REPAID_AUTO, 0)) AS REPAID_AUTO, MAX(ISNULL(R.TXNS_POS, 0)) AS TXNS_POS,
           MAX(ISNULL(R.TXNS_UPI, 0)) AS TXNS_UPI, MAX(ISNULL(R.TXNS_AUTO, 0)) AS TXNS_AUTO
      FROM (
            SELECT MCP.PROJECT_TYPE AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                   SUM(MCP.LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                   SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                   SUM(CASE WHEN MCP.LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                   SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN MCP.LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                   COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS BORROWERS
              FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
             CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)
                           WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'
                           ORDER BY SMQ.SHG_ID DESC) SMX
             INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'
             INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
             WHERE MCP.ISSUED_DATE >= @From AND MCP.ISSUED_DATE < @To
               AND MCP.MEMBER_LONG_CODE IS NOT NULL
               AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
               AND LEN(MCP.MEMBER_LONG_CODE) >= 20
               AND MCP.ISSUED_DATE IS NOT NULL
               AND MCP.ISSUED_DATE > '2000-01-01'
               AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
               AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                        WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
               AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                            WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
               AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                            WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                              AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
               AND (@DistrictId IS NULL OR VI.DISTRICT_ID = @DistrictId)
               AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
             GROUP BY MCP.PROJECT_TYPE
           ) L
      FULL OUTER JOIN (
            SELECT MCP.PROJECT_TYPE AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                   SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
                   COUNT(DISTINCT MCP.MEMBER_LONG_CODE) AS PAYERS,
                   SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 3 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                   SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 2 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                   SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 1 THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                   SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                   SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                   SUM(CASE WHEN @PayModes = 1 AND PM.MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
              FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
             INNER JOIN (SELECT BCI.BANK_REF_NO, MIN(BCI.CREDITED_DATE) AS CREDITED_DATE
                           FROM BANKS_CREDIT_INFO BCI WITH (NOLOCK)
                          WHERE BCI.CREDITED_DATE >= @From AND BCI.CREDITED_DATE < @To
                            AND BCI.BANK_REF_NO IS NOT NULL
                          GROUP BY BCI.BANK_REF_NO) BC ON BC.BANK_REF_NO = SCI.BANK_REF_NO
             INNER JOIN (SELECT VC.BANK_REF_NO,
                                MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE'  THEN 3
                                         WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE'    THEN 2
                                         WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE,
                                MAX(VC.CREATED_BY) AS CB
                           FROM VO_CREDIT_INFO VC WITH (NOLOCK)
                          WHERE VC.BANK_REF_NO IS NOT NULL AND VC.VO_REPAY_STATUS = 'CLOSED'
                          GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO
             INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = SCI.SHG_MEMBER_LOAN_ACCNO
             CROSS APPLY (SELECT TOP 1 SMQ.SHG_ID FROM SHG_MEMBER_INFO SMQ WITH (NOLOCK)
                           WHERE SMQ.MEMBER_ID = MCP.MEMBER_LONG_CODE AND SMQ.IS_MEM_ACTIVE = 'Y'
                           ORDER BY SMQ.SHG_ID DESC) SMX
             INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SMX.SHG_ID AND SI.IS_ACTIVE = 'Y'
             INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
             WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> ''
               AND MCP.MEMBER_LONG_CODE IS NOT NULL
               AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
               AND LEN(MCP.MEMBER_LONG_CODE) >= 20
               AND MCP.ISSUED_DATE IS NOT NULL
               AND MCP.ISSUED_DATE > '2000-01-01'
               AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
               AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                        WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
               AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                            WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
               AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                            WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                              AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
               AND (@DistrictId IS NULL OR VI.DISTRICT_ID = @DistrictId)
               AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
             GROUP BY MCP.PROJECT_TYPE
           ) R ON R.UNIT_ID = L.UNIT_ID
      LEFT JOIN (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
                   FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                  WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
                  GROUP BY PROJECT_TYPE) PT ON PT.PROJECT_TYPE = COALESCE(L.UNIT_ID, R.UNIT_ID)
     GROUP BY COALESCE(L.UNIT_ID, R.UNIT_ID)
    OPTION (RECOMPILE);
END
