/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_DISTRICT_ROLLUP
   Java      : CeoLoanIntelligenceDAOImpl.getDistrictRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getDistrictRollup() used to run
   Runs      : snapshot build; the slowest build query
   Returns   : one row per active district: women, loans, repayments and target for the FY

   The repayment block does not return payment modes here (the inline version
   computed them but never used them), so there is no @PayModes parameter.

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_DISTRICT_ROLLUP @FyLabel = '2026-27', @FyStart = '2026-04-01',
          @FyEnd = '2027-04-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_DISTRICT_ROLLUP
    @FyLabel VARCHAR(20),
    @FyStart DATETIME,
    @FyEnd DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DM.DISTRICT_ID, DM.DISTRICT_DESCRIPTION AS DISTRICT_NAME,
           ISNULL(MEM.ACTIVE_MEMBERS, 0) AS ACTIVE_MEMBERS,
           ISNULL(MWL.MEMBERS_WITH_LOANS, 0) AS MEMBERS_WITH_LOANS,
           ISNULL(LN.MEMBERS_ACTIVE_LOAN_SIDE, 0) AS MEMBERS_ACTIVE_LOAN_SIDE,
           ISNULL(RP.MEMBERS_ACTIVE_REPAY_SIDE, 0) AS MEMBERS_ACTIVE_REPAY_SIDE,
           ISNULL(LN.LOAN_COUNT, 0) AS LOAN_COUNT,
           ISNULL(LN.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
           ISNULL(LN.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT,
           ISNULL(LN.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
           ISNULL(RP.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT,
           ISNULL(RP.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
           ISNULL(RP.REPAID_AMOUNT_CLOSED, 0) AS REPAID_AMOUNT_CLOSED,
           ISNULL(RP.REPAID_AMOUNT_UNPROCESSED, 0) AS REPAID_AMOUNT_UNPROCESSED,
           ISNULL(RP.REPAID_AMOUNT_ADJUSTMENT, 0) AS REPAID_AMOUNT_ADJUSTMENT,
           ISNULL(TGT.TARGET_AMOUNT, 0) AS TARGET_AMOUNT
      FROM DISTRICT_MASTER DM WITH (NOLOCK)
      -- active women, SHGs and VOs
      LEFT JOIN (
            SELECT VI.DISTRICT_ID,
                   COUNT(DISTINCT SM.MEMBER_ID) AS ACTIVE_MEMBERS,
                   COUNT(DISTINCT SM.SHG_ID) AS ACTIVE_SHGS,
                   COUNT(DISTINCT SI.VO_ID) AS ACTIVE_VOS
              FROM (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY
                      FROM SHG_MEMBER_INFO WITH (NOLOCK)
                     WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20
                     GROUP BY MEMBER_ID) SM
             INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
             INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
             WHERE EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                            WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
               AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                            WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                              AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
             GROUP BY VI.DISTRICT_ID
           ) MEM ON MEM.DISTRICT_ID = DM.DISTRICT_ID
      -- women who ever took a valid loan
      LEFT JOIN (
            SELECT VI.DISTRICT_ID,
                   COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_WITH_LOANS
              FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
             INNER JOIN (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY
                           FROM SHG_MEMBER_INFO WITH (NOLOCK)
                          WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20
                          GROUP BY MEMBER_ID) SM ON SM.MEMBER_ID = MCP.MEMBER_LONG_CODE
             INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
             INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
             WHERE MCP.MEMBER_LONG_CODE IS NOT NULL
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
             GROUP BY VI.DISTRICT_ID
           ) MWL ON MWL.DISTRICT_ID = DM.DISTRICT_ID
      -- loans issued in the FY
      LEFT JOIN (
            SELECT VI.DISTRICT_ID,
                   COUNT(*) AS LOAN_COUNT,
                   SUM(MCP.LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                   SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                   SUM(CASE WHEN MCP.LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                   SUM(CASE WHEN MCP.LOAN_STATUS = 'OPEN' THEN MCP.LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                   COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_ACTIVE_LOAN_SIDE
              FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
             INNER JOIN (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY
                           FROM SHG_MEMBER_INFO WITH (NOLOCK)
                          WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20
                          GROUP BY MEMBER_ID) SM ON SM.MEMBER_ID = MCP.MEMBER_LONG_CODE
             INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
             INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
             WHERE MCP.ISSUED_DATE >= @FyStart AND MCP.ISSUED_DATE < @FyEnd
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
             GROUP BY VI.DISTRICT_ID
           ) LN ON LN.DISTRICT_ID = DM.DISTRICT_ID
      -- repayments credited in the FY
      LEFT JOIN (
            SELECT VI.DISTRICT_ID,
                   COUNT(*) AS REPAYMENT_TXN_COUNT,
                   SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
                   SUM(CASE WHEN UPPER(SCI.REPAY_STATUS) = 'CLOSED' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_CLOSED,
                   SUM(CASE WHEN SCI.IS_PROCESSED = 'N' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_UNPROCESSED,
                   SUM(CASE WHEN LTRIM(RTRIM(ISNULL(SCI.Adjust_Type, ''))) <> '' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_ADJUSTMENT,
                   COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_ACTIVE_REPAY_SIDE
              FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
             INNER JOIN (SELECT BCI.BANK_REF_NO, MIN(BCI.CREDITED_DATE) AS CREDITED_DATE
                           FROM BANKS_CREDIT_INFO BCI WITH (NOLOCK)
                          WHERE BCI.CREDITED_DATE >= @FyStart AND BCI.CREDITED_DATE < @FyEnd
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
             INNER JOIN (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY
                           FROM SHG_MEMBER_INFO WITH (NOLOCK)
                          WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20
                          GROUP BY MEMBER_ID) SM ON SM.MEMBER_ID = MCP.MEMBER_LONG_CODE
             INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
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
             GROUP BY VI.DISTRICT_ID
           ) RP ON RP.DISTRICT_ID = DM.DISTRICT_ID
      -- targets for the FY
      LEFT JOIN (
            SELECT TM.DISTRICT_ID,
                   SUM(TM.TARGET_SHG) AS TARGET_SHG,
                   SUM(TM.TARGET_MEMBER) AS TARGET_MEMBER,
                   SUM(TM.TARGET_AMOUNT) AS TARGET_AMOUNT,
                   COUNT(*) AS TARGET_MANDALS,
                   SUM(TM.TARGET_AMOUNT_RAW_SUM) AS TARGET_AMOUNT_RAW_SUM,
                   SUM(TM.TARGET_RAW_ROWS) AS TARGET_RAW_ROWS
              FROM (
                    SELECT T.DISTRICT_ID, T.MANDAL_ID,
                           MAX(CASE WHEN LTRIM(RTRIM(T.TARGET_SHG)) LIKE '%[0-9]%' AND LTRIM(RTRIM(T.TARGET_SHG)) NOT LIKE '%[^0-9.]%' AND LTRIM(RTRIM(T.TARGET_SHG)) NOT LIKE '%.%.%'
                                    THEN CAST(LTRIM(RTRIM(T.TARGET_SHG)) AS DECIMAL(18,2)) END) AS TARGET_SHG,
                           MAX(CASE WHEN LTRIM(RTRIM(T.TARGET_MEMBER)) LIKE '%[0-9]%' AND LTRIM(RTRIM(T.TARGET_MEMBER)) NOT LIKE '%[^0-9.]%' AND LTRIM(RTRIM(T.TARGET_MEMBER)) NOT LIKE '%.%.%'
                                    THEN CAST(LTRIM(RTRIM(T.TARGET_MEMBER)) AS DECIMAL(18,2)) END) AS TARGET_MEMBER,
                           MAX(T.TARGET_AMOUNT) AS TARGET_AMOUNT,
                           SUM(T.TARGET_AMOUNT) AS TARGET_AMOUNT_RAW_SUM,
                           COUNT(*) AS TARGET_RAW_ROWS
                      FROM LIVELIHOOD_MANDALWISE_TARGET_FY18 T WITH (NOLOCK)
                     WHERE T.FY_YEAR = @FyLabel
                     GROUP BY T.FY_YEAR, T.DISTRICT_ID, T.MANDAL_ID
                   ) TM
             WHERE EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                            WHERE DM.DISTRICT_ID = TM.DISTRICT_ID AND DM.FLAG = 'Y')
               AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                            WHERE MM.DISTRICT_ID = TM.DISTRICT_ID AND MM.MANDAL_ID = TM.MANDAL_ID
                              AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
             GROUP BY TM.DISTRICT_ID
           ) TGT ON TGT.DISTRICT_ID = DM.DISTRICT_ID
     WHERE DM.FLAG = 'Y'
     ORDER BY DM.DISTRICT_ID
    OPTION (RECOMPILE);
END
