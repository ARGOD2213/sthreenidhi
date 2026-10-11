/* =====================================================================
   CEO Loan Intelligence Dashboard - all stored procedures in one file
   Designed and architected by CHINTALA MAHINDRA

   For SSMS / sqlcmd (GO separates the procedures). In QueryTool run the
   single files P01 ... P21 one by one instead.
   ===================================================================== */

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_ACTIVE_MANDALS
   Java      : CeoLoanIntelligenceDAOImpl.getActiveMandals()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getActiveMandals() used to run
   Runs      : snapshot build (every 12 hours)
   Returns   : one row per active rural mandal: DISTRICT_ID, MANDAL_ID, MANDAL_NAME

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_ACTIVE_MANDALS;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_ACTIVE_MANDALS
AS
BEGIN
    SET NOCOUNT ON;

    SELECT MM.DISTRICT_ID, MM.MANDAL_ID, MM.MANDAL_DESCRIPTION AS MANDAL_NAME
      FROM MANDAL_MASTER MM WITH (NOLOCK)
     WHERE MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N'
       AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                    WHERE DM.DISTRICT_ID = MM.DISTRICT_ID AND DM.FLAG = 'Y')
     ORDER BY MM.DISTRICT_ID, MM.MANDAL_ID;
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_OFFICER_MAPPING
   Java      : CeoLoanIntelligenceDAOImpl.getOfficerMandalMapping()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getOfficerMandalMapping() used to run
   Runs      : snapshot build
   Returns   : owner of each mandal: Manager / AGM / DGM with login, name and employee code

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_OFFICER_MAPPING;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_OFFICER_MAPPING
AS
BEGIN
    SET NOCOUNT ON;

    -- the mapping table has exact duplicate rows, hence DISTINCT
    SELECT DISTINCT MAP.DISTRICT_ID, DM.DISTRICT_DESCRIPTION AS DISTRICT_NAME,
           MAP.MANDAL_ID, MM.MANDAL_NAME,
           CASE WHEN MM.MANDAL_ID IS NULL THEN 'N' ELSE 'Y' END AS MANDAL_IN_ACTIVE_MASTER,
           CASE WHEN MAP.MANG_USER_NAME LIKE 'SN_MANG%' THEN 'MANAGER'
                WHEN MAP.MANG_USER_NAME LIKE 'SN_AM%'   THEN 'AM'
                WHEN MAP.MANG_USER_NAME LIKE 'SN_AGM%'  THEN 'AGM'
                ELSE 'OTHER' END AS OFFICER_ROLE,
           MAP.MANG_USER_NAME AS OFFICER_USER_ID, MAP.MANAGER_NAME AS OFFICER_NAME,
           OFU.EMP_CODE AS OFFICER_EMP_ID,
           MAP.AGM_USER_NAME, MAP.DIST_AGM_NAME AS AGM_NAME, AGU.EMP_CODE AS AGM_EMP_ID,
           MAP.DGM_USER_NAME, MAP.MONITORING_DGM_NAME AS DGM_NAME, DGU.EMP_CODE AS DGM_EMP_ID
      FROM DIST_DGM_AGM_MANG_MAPPING MAP WITH (NOLOCK)
     INNER JOIN DISTRICT_MASTER DM WITH (NOLOCK)
        ON DM.DISTRICT_ID = MAP.DISTRICT_ID AND DM.FLAG = 'Y'
      LEFT JOIN (SELECT DISTRICT_ID, MANDAL_ID, MAX(MANDAL_DESCRIPTION) AS MANDAL_NAME
                   FROM MANDAL_MASTER WITH (NOLOCK)
                  WHERE IS_ACTIVE = 'Y' AND IS_MEPMA = 'N'
                  GROUP BY DISTRICT_ID, MANDAL_ID) MM
        ON MM.DISTRICT_ID = MAP.DISTRICT_ID AND MM.MANDAL_ID = MAP.MANDAL_ID
      LEFT JOIN (SELECT USER_ID, MAX(EMP_CODE) AS EMP_CODE
                   FROM SNBS_USER_INFO WITH (NOLOCK)
                  WHERE IS_ACTIVE = 'Y' GROUP BY USER_ID) OFU ON OFU.USER_ID = MAP.MANG_USER_NAME
      LEFT JOIN (SELECT USER_ID, MAX(EMP_CODE) AS EMP_CODE
                   FROM SNBS_USER_INFO WITH (NOLOCK)
                  WHERE IS_ACTIVE = 'Y' GROUP BY USER_ID) AGU ON AGU.USER_ID = MAP.AGM_USER_NAME
      LEFT JOIN (SELECT USER_ID, MAX(EMP_CODE) AS EMP_CODE
                   FROM SNBS_USER_INFO WITH (NOLOCK)
                  WHERE IS_ACTIVE = 'Y' GROUP BY USER_ID) DGU ON DGU.USER_ID = MAP.DGM_USER_NAME
     WHERE MAP.MANDAL_ID IS NOT NULL AND LTRIM(RTRIM(MAP.MANDAL_ID)) <> ''
     ORDER BY DGM_USER_NAME, AGM_USER_NAME, OFFICER_USER_ID, DISTRICT_ID, MANDAL_ID;
END
GO

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
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MANDAL_DAILY_LOANS
   Java      : CeoLoanIntelligenceDAOImpl.getMandalDailyLoanRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMandalDailyLoanRollup() used to run
   Runs      : snapshot build
   Returns   : loans per district / mandal / issue day (PERIOD_DAY yyyy-MM-dd)

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MANDAL_DAILY_LOANS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MANDAL_DAILY_LOANS
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(10), MCP.ISSUED_DATE, 120) AS PERIOD_DAY,
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(10), MCP.ISSUED_DATE, 120)
     ORDER BY 1, 2, 3
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS
   Java      : CeoLoanIntelligenceDAOImpl.getMandalDailyRepaymentRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMandalDailyRepaymentRollup() used to run
   Runs      : snapshot build
   Returns   : repayments per district / mandal / bank credit day, with payment modes

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1, @PayModes = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1,
    @PayModes BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(10), BC.CREDITED_DATE, 120) AS PERIOD_DAY,
           COUNT(*) AS REPAYMENT_TXN_COUNT,
           SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
           SUM(CASE WHEN UPPER(SCI.REPAY_STATUS) = 'CLOSED' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_CLOSED,
           SUM(CASE WHEN SCI.IS_PROCESSED = 'N' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_UNPROCESSED,
           SUM(CASE WHEN LTRIM(RTRIM(ISNULL(SCI.Adjust_Type, ''))) <> '' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_ADJUSTMENT,
           COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_ACTIVE_REPAY_SIDE,
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(10), BC.CREDITED_DATE, 120)
     ORDER BY 1, 2, 3
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_DISTRICT_PROJECTS
   Java      : CeoLoanIntelligenceDAOImpl.getDistrictProjectComposition()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getDistrictProjectComposition() used to run
   Runs      : snapshot build
   Returns   : loans per district and project, with the project name

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_DISTRICT_PROJECTS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_DISTRICT_PROJECTS
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT A.DISTRICT_ID, A.PROJECT_TYPE, PT.PROJECT_NAME,
           A.LOAN_COUNT, A.DISBURSED_AMOUNT, A.OPEN_LOAN_COUNT, A.CLOSED_LOAN_COUNT,
           A.MEMBERS_ACTIVE_LOAN_SIDE
      FROM (
            SELECT VI.DISTRICT_ID, MCP.PROJECT_TYPE,
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
             GROUP BY VI.DISTRICT_ID, MCP.PROJECT_TYPE
           ) A
      LEFT JOIN (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
                   FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                  WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
                  GROUP BY PROJECT_TYPE) PT ON PT.PROJECT_TYPE = A.PROJECT_TYPE
     ORDER BY A.DISTRICT_ID, A.PROJECT_TYPE
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MANDAL_LOANS
   Java      : CeoLoanIntelligenceDAOImpl.getMandalLoanRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMandalLoanRollup() used to run
   Runs      : snapshot build (twice: current and previous FY)
   Returns   : loans per district / mandal for the period

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MANDAL_LOANS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MANDAL_LOANS
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID,
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID
     ORDER BY VI.DISTRICT_ID, VI.MANDAL_ID
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MANDAL_TARGETS
   Java      : CeoLoanIntelligenceDAOImpl.getMandalTargetRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMandalTargetRollup() used to run
   Runs      : snapshot build (twice: current and previous FY)
   Returns   : target per active rural mandal for the FY (one row per mandal)

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MANDAL_TARGETS @FyLabel = '2026-27';
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MANDAL_TARGETS
    @FyLabel VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TM.DISTRICT_ID, TM.MANDAL_ID, TM.TARGET_SHG, TM.TARGET_MEMBER,
           TM.TARGET_AMOUNT, TM.TARGET_AMOUNT_RAW_SUM, TM.TARGET_RAW_ROWS
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
     ORDER BY TM.DISTRICT_ID, TM.MANDAL_ID;
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_LOAN_CUBE
   Java      : CeoLoanIntelligenceDAOImpl.getLoanCube()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getLoanCube() used to run
   Runs      : snapshot build (24 months)
   Returns   : loans per district / mandal / month / project / social category

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_LOAN_CUBE @From = '2024-11-01', @To = '2026-11-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_LOAN_CUBE
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(7), MCP.ISSUED_DATE, 120) AS PERIOD_MONTH, MCP.PROJECT_TYPE, UPPER(LTRIM(RTRIM(ISNULL(SM.CATEGORY, '')))) AS CATEGORY,
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(7), MCP.ISSUED_DATE, 120), MCP.PROJECT_TYPE, UPPER(LTRIM(RTRIM(ISNULL(SM.CATEGORY, ''))))
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MANDAL_PURPOSES
   Java      : CeoLoanIntelligenceDAOImpl.getMandalPurposeRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMandalPurposeRollup() used to run
   Runs      : snapshot build (twice: current and previous FY)
   Returns   : loans per district / mandal / purpose (purpose trimmed and upper case)

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MANDAL_PURPOSES @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MANDAL_PURPOSES
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID, ISNULL(UPPER(NULLIF(LTRIM(RTRIM(MCP.PURPOSE)), '')), '') AS PURPOSE,
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID, ISNULL(UPPER(NULLIF(LTRIM(RTRIM(MCP.PURPOSE)), '')), '')
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_PROJECT_NAMES
   Java      : CeoLoanIntelligenceDAOImpl.getProjectNames()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getProjectNames() used to run
   Runs      : snapshot build
   Returns   : PROJECT_TYPE, PROJECT_NAME

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_PROJECT_NAMES @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_PROJECT_NAMES
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT PT.PROJECT_TYPE, PT.PROJECT_NAME
      FROM (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
              FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
             WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
             GROUP BY PROJECT_TYPE) PT
     ORDER BY PT.PROJECT_TYPE;
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_REPAYMENT_CUBE
   Java      : CeoLoanIntelligenceDAOImpl.getRepaymentCube()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getRepaymentCube() used to run
   Runs      : snapshot build (24 months); the largest repayment read
   Returns   : repayments per district / mandal / credit month / project, with payment modes

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_REPAYMENT_CUBE @From = '2024-11-01', @To = '2026-11-01', @SnOnly = 1, @PayModes = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_REPAYMENT_CUBE
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1,
    @PayModes BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(7), BC.CREDITED_DATE, 120) AS PERIOD_MONTH, MCP.PROJECT_TYPE,
           COUNT(*) AS REPAYMENT_TXN_COUNT,
           SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
           SUM(CASE WHEN UPPER(SCI.REPAY_STATUS) = 'CLOSED' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_CLOSED,
           SUM(CASE WHEN SCI.IS_PROCESSED = 'N' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_UNPROCESSED,
           SUM(CASE WHEN LTRIM(RTRIM(ISNULL(SCI.Adjust_Type, ''))) <> '' THEN SCI.REPAID_AMOUNT ELSE 0 END) AS REPAID_AMOUNT_ADJUSTMENT,
           COUNT(DISTINCT SM.MEMBER_ID) AS MEMBERS_ACTIVE_REPAY_SIDE,
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID, CONVERT(CHAR(7), BC.CREDITED_DATE, 120), MCP.PROJECT_TYPE
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_CASH_KEYED_BY
   Java      : CeoLoanIntelligenceDAOImpl.getCashKeyedBy()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getCashKeyedBy() used to run
   Runs      : first "Who keys the cash" click after each build (then cached)
   Returns   : cash (non-online) repayments per login: CREATED_BY, TXN_COUNT, AMOUNT, FIRST_DATE, LAST_DATE

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_CASH_KEYED_BY @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_CASH_KEYED_BY
    @From DATETIME,
    @To DATETIME,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT PM.CB AS CREATED_BY, COUNT(*) AS TXN_COUNT, SUM(SCI.REPAID_AMOUNT) AS AMOUNT,
           CONVERT(CHAR(10), MIN(BC.CREDITED_DATE), 120) AS FIRST_DATE,
           CONVERT(CHAR(10), MAX(BC.CREDITED_DATE), 120) AS LAST_DATE
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
     WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> ''
       AND MCP.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
       AND LEN(MCP.MEMBER_LONG_CODE) >= 20
       AND MCP.ISSUED_DATE IS NOT NULL
       AND MCP.ISSUED_DATE > '2000-01-01'
       AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
       AND PM.CB NOT IN ('PAYTM PAYMENT SERVICE', 'Phi PAYMENT SERVICE', 'SHG AUTO DEBIT PROCESS')
     GROUP BY PM.CB
    OPTION (RECOMPILE);
END
GO

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
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_DRILL_SCOPE
   Java      : CeoLoanIntelligenceDAOImpl.drill()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.drill() used to run
   Runs      : a click at mandal, VO or SHG level (then cached until the next build)
   Returns   : one row per VO, SHG, woman, project, social category or purpose of the clicked place

   Level is taken from the most specific id given: @ShgId, else @VoId, else
   @MandalId (needs @DistrictId). Groups allowed: mandal VO / SHG / PROJECT /
   CATEGORY / PURPOSE; VO SHG / PROJECT / CATEGORY / PURPOSE; SHG MEMBER / PROJECT /
   CATEGORY / PURPOSE. SHG at mandal level returns the top 100 by collections with
   the VO as PARENT_ID. The women of the clicked place are read once into #X and
   their loans / repayments once into #L / #R; the result is the same as the
   inline version, which repeated that read inside each part of the query.

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_DRILL_SCOPE @Group = 'VO', @DistrictId = '07', @MandalId = '25',
          @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1, @PayModes = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_DRILL_SCOPE
    @Group VARCHAR(10),
    @DistrictId VARCHAR(10) = NULL,
    @MandalId VARCHAR(10) = NULL,
    @VoId VARCHAR(40) = NULL,
    @ShgId VARCHAR(40) = NULL,
    @From DATETIME,
    @To DATETIME,
    @ProjectType VARCHAR(20) = NULL,
    @SnOnly BIT = 1,
    @PayModes BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Level VARCHAR(10) =
        CASE WHEN @ShgId IS NOT NULL THEN 'SHG' WHEN @VoId IS NOT NULL THEN 'VO'
             WHEN @MandalId IS NOT NULL THEN 'MANDAL' ELSE '' END;
    SET @Group = UPPER(LTRIM(RTRIM(@Group)));

    -- same checks as the Java code: allowed groups per level
    IF @Level = '' OR (@Level = 'MANDAL' AND @DistrictId IS NULL)
    BEGIN
        RAISERROR('give @MandalId with @DistrictId, or @VoId, or @ShgId', 16, 1);
        RETURN;
    END
    IF NOT ((@Level = 'MANDAL' AND @Group IN ('VO', 'SHG', 'PROJECT', 'CATEGORY', 'PURPOSE'))
         OR (@Level = 'VO'     AND @Group IN ('SHG', 'PROJECT', 'CATEGORY', 'PURPOSE'))
         OR (@Level = 'SHG'    AND @Group IN ('MEMBER', 'PROJECT', 'CATEGORY', 'PURPOSE')))
    BEGIN
        RAISERROR('group %s is not available at %s level', 16, 1, @Group, @Level);
        RETURN;
    END
    IF @From >= @To
    BEGIN
        RAISERROR('@From must be before @To', 16, 1);
        RETURN;
    END

    -- 1. active women of the clicked mandal / VO / SHG (column types copied from the source tables)
    SELECT TOP 0 MAX(SM.MEMBER_ID) AS MEMBER_ID, MAX(SM.MEMBER_NAME) AS MEMBER_NAME, MAX(SM.SHG_ID) AS SHG_ID,
           MAX(SI.VO_ID) AS VO_ID, MAX(SM.CATAGORY) AS CATEGORY
      INTO #X
      FROM SHG_MEMBER_INFO SM WITH (NOLOCK)
     CROSS JOIN SHG_INFO SI WITH (NOLOCK)
     WHERE 1 = 0;
    CREATE CLUSTERED INDEX IX_X ON #X (MEMBER_ID);

    IF @Level = 'MANDAL'
    BEGIN
        INSERT INTO #X (MEMBER_ID, MEMBER_NAME, SHG_ID, VO_ID, CATEGORY)
        SELECT SM.MEMBER_ID, MAX(SM.MEMBER_NAME), MAX(SM.SHG_ID), MAX(SI.VO_ID), MAX(SM.CATAGORY)
          FROM SHG_MEMBER_INFO SM WITH (NOLOCK)
         INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
         INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
         WHERE SM.IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(SM.MEMBER_ID))) >= 20
           AND VI.DISTRICT_ID = @DistrictId AND VI.MANDAL_ID = @MandalId
           AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                        WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
           AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                        WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                          AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
         GROUP BY SM.MEMBER_ID
        OPTION (RECOMPILE);
    END
    ELSE IF @Level = 'VO'
    BEGIN
        INSERT INTO #X (MEMBER_ID, MEMBER_NAME, SHG_ID, VO_ID, CATEGORY)
        SELECT SM.MEMBER_ID, MAX(SM.MEMBER_NAME), MAX(SM.SHG_ID), MAX(SI.VO_ID), MAX(SM.CATAGORY)
          FROM SHG_MEMBER_INFO SM WITH (NOLOCK)
         INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
         INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
         WHERE SM.IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(SM.MEMBER_ID))) >= 20
           AND VI.TRANS_VO_ID = @VoId
           AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                        WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
           AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                        WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                          AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
         GROUP BY SM.MEMBER_ID
        OPTION (RECOMPILE);
    END
    ELSE
    BEGIN
        INSERT INTO #X (MEMBER_ID, MEMBER_NAME, SHG_ID, VO_ID, CATEGORY)
        SELECT SM.MEMBER_ID, MAX(SM.MEMBER_NAME), MAX(SM.SHG_ID), MAX(SI.VO_ID), MAX(SM.CATAGORY)
          FROM SHG_MEMBER_INFO SM WITH (NOLOCK)
         INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
         INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
         WHERE SM.IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(SM.MEMBER_ID))) >= 20
           AND SM.SHG_ID = @ShgId
           AND EXISTS (SELECT 1 FROM DISTRICT_MASTER DM WITH (NOLOCK)
                        WHERE DM.DISTRICT_ID = VI.DISTRICT_ID AND DM.FLAG = 'Y')
           AND EXISTS (SELECT 1 FROM MANDAL_MASTER MM WITH (NOLOCK)
                        WHERE MM.DISTRICT_ID = VI.DISTRICT_ID AND MM.MANDAL_ID = VI.MANDAL_ID
                          AND MM.IS_ACTIVE = 'Y' AND MM.IS_MEPMA = 'N')
         GROUP BY SM.MEMBER_ID
        OPTION (RECOMPILE);
    END

    -- 2. their valid loans issued in the period
    SELECT X.MEMBER_ID, X.VO_ID, X.SHG_ID, X.CATEGORY, MCP.PROJECT_TYPE,
           ISNULL(UPPER(NULLIF(LTRIM(RTRIM(MCP.PURPOSE)), '')), '') AS PURPOSE_N,
           MCP.LOAN_STATUS, MCP.LOAN_AMOUNT_ISSUED
      INTO #L
      FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
     INNER JOIN #X X ON X.MEMBER_ID = MCP.MEMBER_LONG_CODE
     WHERE MCP.ISSUED_DATE >= @From AND MCP.ISSUED_DATE < @To
       AND MCP.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
       AND LEN(MCP.MEMBER_LONG_CODE) >= 20
       AND MCP.ISSUED_DATE IS NOT NULL
       AND MCP.ISSUED_DATE > '2000-01-01'
       AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
       AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
    OPTION (RECOMPILE);

    -- 3. their repayments credited in the period (bank credit arrived, VO credit CLOSED)
    SELECT X.MEMBER_ID, X.VO_ID, X.SHG_ID, X.CATEGORY, MCP.PROJECT_TYPE,
           ISNULL(UPPER(NULLIF(LTRIM(RTRIM(MCP.PURPOSE)), '')), '') AS PURPOSE_N,
           SCI.REPAID_AMOUNT, PM.MODE_CODE
      INTO #R
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
     INNER JOIN #X X ON X.MEMBER_ID = MCP.MEMBER_LONG_CODE
     WHERE SCI.SHG_MEMBER_LOAN_ACCNO <> ''
       AND MCP.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
       AND LEN(MCP.MEMBER_LONG_CODE) >= 20
       AND MCP.ISSUED_DATE IS NOT NULL
       AND MCP.ISSUED_DATE > '2000-01-01'
       AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
       AND (@ProjectType IS NULL OR MCP.PROJECT_TYPE = @ProjectType)
    OPTION (RECOMPILE);

    -- 4. one row per unit of the requested group
    IF @Group = 'VO'
    BEGIN
        SELECT U.UNIT_ID, U.UNIT_NAME, ISNULL(M.ACTIVE_MEMBERS, 0) AS ACTIVE_MEMBERS,
               ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
               ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
               ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS,
               ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
               ISNULL(R.PAYERS, 0) AS PAYERS,
               ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO,
               ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO
          FROM (
                SELECT VI.TRANS_VO_ID AS UNIT_ID, MAX(VI.VO_NAME) AS UNIT_NAME
                  FROM VO_INFO VI WITH (NOLOCK)
                 WHERE VI.IS_ACTIVE = 'Y'
                   AND VI.DISTRICT_ID = @DistrictId AND VI.MANDAL_ID = @MandalId
                 GROUP BY VI.TRANS_VO_ID
               ) U
          LEFT JOIN (
                SELECT VO_ID AS UNIT_ID, COUNT(*) AS ACTIVE_MEMBERS FROM #X GROUP BY VO_ID
               ) M ON M.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT VO_ID AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS BORROWERS
                  FROM #L
                 GROUP BY VO_ID
               ) L ON L.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT VO_ID AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM #R
                 GROUP BY VO_ID
               ) R ON R.UNIT_ID = U.UNIT_ID
         ORDER BY U.UNIT_NAME
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'SHG' AND @Level = 'MANDAL'
    BEGIN
        -- SHGs of a whole mandal: only the 100 with the highest collections
        SELECT TOP 100 U.PARENT_ID, U.UNIT_ID, U.UNIT_NAME, ISNULL(M.ACTIVE_MEMBERS, 0) AS ACTIVE_MEMBERS,
               ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
               ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
               ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS,
               ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
               ISNULL(R.PAYERS, 0) AS PAYERS,
               ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO,
               ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO
          FROM (
                SELECT SI.TRANS_SHG_ID AS UNIT_ID, MAX(SI.SHG_NAME) AS UNIT_NAME, MAX(SI.VO_ID) AS PARENT_ID
                  FROM SHG_INFO SI WITH (NOLOCK)
                 INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
                 WHERE SI.IS_ACTIVE = 'Y'
                   AND VI.DISTRICT_ID = @DistrictId AND VI.MANDAL_ID = @MandalId
                 GROUP BY SI.TRANS_SHG_ID
               ) U
          LEFT JOIN (
                SELECT SHG_ID AS UNIT_ID, COUNT(*) AS ACTIVE_MEMBERS FROM #X GROUP BY SHG_ID
               ) M ON M.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT SHG_ID AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS BORROWERS
                  FROM #L
                 GROUP BY SHG_ID
               ) L ON L.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT SHG_ID AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM #R
                 GROUP BY SHG_ID
               ) R ON R.UNIT_ID = U.UNIT_ID
         ORDER BY ISNULL(R.REPAID_AMOUNT, 0) DESC, ISNULL(L.DISBURSED_AMOUNT, 0) DESC
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'SHG'
    BEGIN
        SELECT U.UNIT_ID, U.UNIT_NAME, ISNULL(M.ACTIVE_MEMBERS, 0) AS ACTIVE_MEMBERS,
               ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
               ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
               ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS,
               ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
               ISNULL(R.PAYERS, 0) AS PAYERS,
               ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO,
               ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO
          FROM (
                SELECT SI.TRANS_SHG_ID AS UNIT_ID, MAX(SI.SHG_NAME) AS UNIT_NAME
                  FROM SHG_INFO SI WITH (NOLOCK)
                 WHERE SI.IS_ACTIVE = 'Y'
                   AND SI.VO_ID = @VoId
                 GROUP BY SI.TRANS_SHG_ID
               ) U
          LEFT JOIN (
                SELECT SHG_ID AS UNIT_ID, COUNT(*) AS ACTIVE_MEMBERS FROM #X GROUP BY SHG_ID
               ) M ON M.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT SHG_ID AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS BORROWERS
                  FROM #L
                 GROUP BY SHG_ID
               ) L ON L.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT SHG_ID AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM #R
                 GROUP BY SHG_ID
               ) R ON R.UNIT_ID = U.UNIT_ID
         ORDER BY U.UNIT_NAME
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'MEMBER'
    BEGIN
        SELECT U.UNIT_ID, U.UNIT_NAME, 1 AS ACTIVE_MEMBERS,
               ISNULL(L.LOAN_COUNT, 0) AS LOAN_COUNT, ISNULL(L.DISBURSED_AMOUNT, 0) AS DISBURSED_AMOUNT,
               ISNULL(L.OPEN_LOAN_COUNT, 0) AS OPEN_LOAN_COUNT, ISNULL(L.CLOSED_LOAN_COUNT, 0) AS CLOSED_LOAN_COUNT,
               ISNULL(L.OPEN_AMOUNT, 0) AS OPEN_AMOUNT, ISNULL(L.BORROWERS, 0) AS BORROWERS,
               ISNULL(R.REPAYMENT_TXN_COUNT, 0) AS REPAYMENT_TXN_COUNT, ISNULL(R.REPAID_AMOUNT, 0) AS REPAID_AMOUNT,
               ISNULL(R.PAYERS, 0) AS PAYERS,
               ISNULL(R.REPAID_POS, 0) AS REPAID_POS, ISNULL(R.REPAID_UPI, 0) AS REPAID_UPI, ISNULL(R.REPAID_AUTO, 0) AS REPAID_AUTO,
               ISNULL(R.TXNS_POS, 0) AS TXNS_POS, ISNULL(R.TXNS_UPI, 0) AS TXNS_UPI, ISNULL(R.TXNS_AUTO, 0) AS TXNS_AUTO
          FROM (
                SELECT X.MEMBER_ID AS UNIT_ID, X.MEMBER_NAME AS UNIT_NAME
                  FROM #X X
               ) U
          LEFT JOIN (
                SELECT MEMBER_ID AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS BORROWERS
                  FROM #L
                 GROUP BY MEMBER_ID
               ) L ON L.UNIT_ID = U.UNIT_ID
          LEFT JOIN (
                SELECT MEMBER_ID AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM #R
                 GROUP BY MEMBER_ID
               ) R ON R.UNIT_ID = U.UNIT_ID
         ORDER BY U.UNIT_NAME
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'PROJECT'
    BEGIN
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
                SELECT PROJECT_TYPE AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS BORROWERS
                  FROM #L
                 GROUP BY PROJECT_TYPE
               ) L
          FULL OUTER JOIN (
                SELECT PROJECT_TYPE AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM #R
                 GROUP BY PROJECT_TYPE
               ) R ON R.UNIT_ID = L.UNIT_ID
          LEFT JOIN (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
                       FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                      WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
                      GROUP BY PROJECT_TYPE) PT ON PT.PROJECT_TYPE = COALESCE(L.UNIT_ID, R.UNIT_ID)
         GROUP BY COALESCE(L.UNIT_ID, R.UNIT_ID)
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'CATEGORY'
    BEGIN
        SELECT COALESCE(L.UNIT_ID, R.UNIT_ID) AS UNIT_ID, COALESCE(L.UNIT_ID, R.UNIT_ID) AS UNIT_NAME,
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
                SELECT UPPER(LTRIM(RTRIM(ISNULL(CATEGORY, '')))) AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                       SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                       SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS BORROWERS
                  FROM #L
                 GROUP BY UPPER(LTRIM(RTRIM(ISNULL(CATEGORY, ''))))
               ) L
          FULL OUTER JOIN (
                SELECT UPPER(LTRIM(RTRIM(ISNULL(CATEGORY, '')))) AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                       SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                       COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                       SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
                  FROM #R
                 GROUP BY UPPER(LTRIM(RTRIM(ISNULL(CATEGORY, ''))))
               ) R ON R.UNIT_ID = L.UNIT_ID
         GROUP BY COALESCE(L.UNIT_ID, R.UNIT_ID)
        OPTION (RECOMPILE);
        RETURN;
    END

    -- PURPOSE
    SELECT COALESCE(L.UNIT_ID, R.UNIT_ID) AS UNIT_ID, COALESCE(L.UNIT_ID, R.UNIT_ID) AS UNIT_NAME,
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
            SELECT PURPOSE_N AS UNIT_ID, COUNT(*) AS LOAN_COUNT,
                   SUM(LOAN_AMOUNT_ISSUED) AS DISBURSED_AMOUNT,
                   SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN 1 ELSE 0 END) AS OPEN_LOAN_COUNT,
                   SUM(CASE WHEN LOAN_STATUS = 'CLOSED' THEN 1 ELSE 0 END) AS CLOSED_LOAN_COUNT,
                   SUM(CASE WHEN LOAN_STATUS = 'OPEN' THEN LOAN_AMOUNT_ISSUED ELSE 0 END) AS OPEN_AMOUNT,
                   COUNT(DISTINCT MEMBER_ID) AS BORROWERS
              FROM #L
             GROUP BY PURPOSE_N
           ) L
      FULL OUTER JOIN (
            SELECT PURPOSE_N AS UNIT_ID, COUNT(*) AS REPAYMENT_TXN_COUNT,
                   SUM(REPAID_AMOUNT) AS REPAID_AMOUNT,
                   COUNT(DISTINCT MEMBER_ID) AS PAYERS,
                   SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_POS,
                   SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_UPI,
                   SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN REPAID_AMOUNT ELSE 0 END) AS REPAID_AUTO,
                   SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 3 THEN 1 ELSE 0 END) AS TXNS_POS,
                   SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 2 THEN 1 ELSE 0 END) AS TXNS_UPI,
                   SUM(CASE WHEN @PayModes = 1 AND MODE_CODE = 1 THEN 1 ELSE 0 END) AS TXNS_AUTO
              FROM #R
             GROUP BY PURPOSE_N
           ) R ON R.UNIT_ID = L.UNIT_ID
     GROUP BY COALESCE(L.UNIT_ID, R.UNIT_ID)
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MEMBER_DETAIL
   Java      : CeoLoanIntelligenceDAOImpl.getMemberDetail()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMemberDetail() used to run
   Runs      : woman popup (then cached)
   Returns   : three result sets: MEMBER (profile, mobile last 4 digits only), LOAN rows, REPAYMENT rows (max 3000)

   The woman's own list shows every payment she made (not only credited / closed
   ones), on REPAYMENT_DATE, with the mode from VO_CREDIT_INFO - same as the inline
   version.

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MEMBER_DETAIL @MemberId = '<member id>', @SnOnly = 1, @PayModes = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MEMBER_DETAIL
    @MemberId VARCHAR(40),
    @SnOnly BIT = 1,
    @PayModes BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. profile
    SELECT 'MEMBER' AS ROW_TYPE, SM.MEMBER_ID, MAX(SM.MEMBER_NAME) AS MEMBER_NAME, MAX(SM.SHG_ID) AS SHG_ID,
           MAX(SM.MEMBER_SURNAME) AS MEMBER_SURNAME, MAX(SM.FATHER_HUSBAND_NAME) AS FH_NAME,
           MAX(SM.FATHER_HUSBAND_SUR_NAME) AS FH_SURNAME, MAX(YEAR(SM.DOB)) AS BIRTH_YEAR,
           MAX(SM.MARITIAL_STATUS) AS MARITAL_STATUS, MAX(SM.CATAGORY) AS CATEGORY, MAX(SM.EDUCATION) AS EDUCATION,
           MAX(SM.WELLBEING_STATUS) AS WELLBEING, MAX(SM.HABITATION_NAME) AS VILLAGE,
           CONVERT(CHAR(10), MAX(SM.REGISTRATION_DATE), 120) AS REGISTERED, MAX(SM.IS_DISABLED) AS IS_DISABLED,
           MAX(CASE WHEN LEN(LTRIM(RTRIM(SM.MOBILE_NUM))) >= 4 THEN RIGHT(LTRIM(RTRIM(SM.MOBILE_NUM)), 4) END) AS MOBILE_LAST4
      FROM SHG_MEMBER_INFO SM WITH (NOLOCK)
     WHERE SM.MEMBER_ID = @MemberId AND SM.IS_MEM_ACTIVE = 'Y'
     GROUP BY SM.MEMBER_ID;

    -- 2. her valid loans
    SELECT 'LOAN' AS ROW_TYPE, L.SHG_MEMBER_LOAN_ACCNO, L.SHG_LOAN_ACCNO, L.PROJECT_TYPE, PT.PROJECT_NAME,
           L.PURPOSE, L.LOAN_AMOUNT_ISSUED, L.LOAN_STATUS, CONVERT(CHAR(10), L.ISSUED_DATE, 120) AS ISSUED_DATE
      FROM SHG_MEMBER_MCP_INFO L WITH (NOLOCK)
      LEFT JOIN (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
                   FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                  WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
                  GROUP BY PROJECT_TYPE) PT ON PT.PROJECT_TYPE = L.PROJECT_TYPE
     WHERE L.MEMBER_LONG_CODE = @MemberId
       AND L.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(L.MEMBER_LONG_CODE)) <> ''
       AND LEN(L.MEMBER_LONG_CODE) >= 20
       AND L.ISSUED_DATE IS NOT NULL
       AND L.ISSUED_DATE > '2000-01-01'
       AND L.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR L.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
     ORDER BY L.ISSUED_DATE
    OPTION (RECOMPILE);

    -- 3. every repayment on those loans, with its payment mode
    SELECT TOP 3000 'REPAYMENT' AS ROW_TYPE, SCI.SHG_CREDIT_ID, SCI.SHG_MEMBER_LOAN_ACCNO,
           CONVERT(CHAR(10), SCI.REPAYMENT_DATE, 120) AS REPAYMENT_DATE, SCI.REPAID_AMOUNT, SCI.REPAY_STATUS,
           SCI.IS_PROCESSED, SCI.Adjust_Type AS ADJUST_TYPE, CONVERT(CHAR(10), SCI.CREDITED_DATE, 120) AS CREDITED_DATE,
           CASE WHEN @PayModes = 1 THEN
                CASE PM.MODE_CODE WHEN 3 THEN 'POS' WHEN 2 THEN 'UPI' WHEN 1 THEN 'AUTO' ELSE 'MANUAL' END
           END AS PAY_MODE
      FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
      LEFT JOIN (SELECT VC.BANK_REF_NO,
                        MAX(CASE WHEN VC.CREATED_BY = 'PAYTM PAYMENT SERVICE'  THEN 3
                                 WHEN VC.CREATED_BY = 'Phi PAYMENT SERVICE'    THEN 2
                                 WHEN VC.CREATED_BY = 'SHG AUTO DEBIT PROCESS' THEN 1 ELSE 0 END) AS MODE_CODE
                   FROM VO_CREDIT_INFO VC WITH (NOLOCK)
                  WHERE VC.BANK_REF_NO IS NOT NULL
                  GROUP BY VC.BANK_REF_NO) PM ON PM.BANK_REF_NO = SCI.BANK_REF_NO
     WHERE SCI.SHG_MEMBER_LOAN_ACCNO IN (SELECT L.SHG_MEMBER_LOAN_ACCNO
                                           FROM SHG_MEMBER_MCP_INFO L WITH (NOLOCK)
                                          WHERE L.MEMBER_LONG_CODE = @MemberId
                                                AND L.MEMBER_LONG_CODE IS NOT NULL
                                                AND LTRIM(RTRIM(L.MEMBER_LONG_CODE)) <> ''
                                                AND LEN(L.MEMBER_LONG_CODE) >= 20
                                                AND L.ISSUED_DATE IS NOT NULL
                                                AND L.ISSUED_DATE > '2000-01-01'
                                                AND L.LOAN_STATUS IN ('OPEN', 'CLOSED')
                                                AND (@SnOnly = 0 OR L.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                                                         WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN')))
     ORDER BY SCI.REPAYMENT_DATE
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_SHG_INFO
   Java      : CeoLoanIntelligenceDAOImpl.getShgInfo()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getShgInfo() used to run
   Runs      : SHG popup (then cached)
   Returns   : one row with the SHG's details (mobile last 4 digits only)

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_SHG_INFO @ShgId = '<shg id>';
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_SHG_INFO
    @ShgId VARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT SI.TRANS_SHG_ID AS SHG_ID, MAX(SI.SHG_NAME) AS SHG_NAME, MAX(VI.VO_NAME) AS VO_NAME,
           CONVERT(CHAR(10), MAX(COALESCE(CAST(SI.SHG_REGISTRATION_DATE AS DATETIME), SI.SHG_REG_DATE)), 120) AS REGISTERED,
           MAX(SI.NUMBER_OF_MEMBERS) AS NUMBER_OF_MEMBERS, MAX(SI.SOCIAL_CATEGORY) AS SOCIAL_CATEGORY,
           MAX(SI.HQVILLAGE) AS VILLAGE, MAX(SI.WELLBEING_STATUS) AS WELLBEING, MAX(SI.GRADE) AS GRADE,
           MAX(SI.BANK_NAME) AS BANK_NAME, MAX(SI.BRANCH_NAME) AS BRANCH_NAME,
           MAX(SI.DISABLED) AS DISABLED, MAX(SI.MINORITY) AS MINORITY,
           MAX(CASE WHEN LEN(LTRIM(RTRIM(SI.MOBILE_NUM))) >= 4 THEN RIGHT(LTRIM(RTRIM(SI.MOBILE_NUM)), 4) END) AS MOBILE_LAST4
      FROM SHG_INFO SI WITH (NOLOCK)
      LEFT JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
     WHERE SI.TRANS_SHG_ID = @ShgId AND SI.IS_ACTIVE = 'Y'
     GROUP BY SI.TRANS_SHG_ID;
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_SHG_MEMBER_LOANS
   Java      : CeoLoanIntelligenceDAOImpl.getShgMemberLoans()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getShgMemberLoans() used to run
   Runs      : borrowers list of one SHG
   Returns   : one row per woman and loan, with repayment count, amount and last date

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_SHG_MEMBER_LOANS @ShgId = '<shg id>', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_SHG_MEMBER_LOANS
    @ShgId VARCHAR(40),
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT SM.MEMBER_ID, SM.MEMBER_NAME,
           L.SHG_MEMBER_LOAN_ACCNO, L.SHG_LOAN_ACCNO, L.PROJECT_TYPE, PT.PROJECT_NAME,
           L.PURPOSE, L.LOAN_AMOUNT_ISSUED, L.LOAN_STATUS,
           CONVERT(CHAR(10), L.ISSUED_DATE, 120) AS ISSUED_DATE,
           R.REPAYMENT_TXN_COUNT, R.REPAID_AMOUNT,
           CONVERT(CHAR(10), R.LAST_REPAYMENT_DATE, 120) AS LAST_REPAYMENT_DATE
      FROM (SELECT MEMBER_ID, MAX(MEMBER_NAME) AS MEMBER_NAME
              FROM SHG_MEMBER_INFO WITH (NOLOCK)
             WHERE SHG_ID = @ShgId AND IS_MEM_ACTIVE = 'Y'
             GROUP BY MEMBER_ID) SM
      LEFT JOIN SHG_MEMBER_MCP_INFO L WITH (NOLOCK)
        ON L.MEMBER_LONG_CODE = SM.MEMBER_ID
       AND L.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(L.MEMBER_LONG_CODE)) <> ''
       AND LEN(L.MEMBER_LONG_CODE) >= 20
       AND L.ISSUED_DATE IS NOT NULL
       AND L.ISSUED_DATE > '2000-01-01'
       AND L.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR L.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
      LEFT JOIN (SELECT PROJECT_TYPE, MAX(PROJECT_NAME) AS PROJECT_NAME
                   FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                  WHERE (@SnOnly = 0 OR LTRIM(RTRIM(LOAN_TYPE)) = 'SN')
                  GROUP BY PROJECT_TYPE) PT ON PT.PROJECT_TYPE = L.PROJECT_TYPE
      LEFT JOIN (SELECT SCI.SHG_MEMBER_LOAN_ACCNO,
                        COUNT(*) AS REPAYMENT_TXN_COUNT,
                        SUM(SCI.REPAID_AMOUNT) AS REPAID_AMOUNT,
                        MAX(SCI.REPAYMENT_DATE) AS LAST_REPAYMENT_DATE
                   FROM SHG_CREDIT_INFO SCI WITH (NOLOCK)
                  WHERE SCI.SHG_MEMBER_LOAN_ACCNO IN (SELECT L2.SHG_MEMBER_LOAN_ACCNO
                                                        FROM SHG_MEMBER_MCP_INFO L2 WITH (NOLOCK)
                                                       INNER JOIN SHG_MEMBER_INFO SM2 WITH (NOLOCK)
                                                          ON SM2.MEMBER_ID = L2.MEMBER_LONG_CODE
                                                       WHERE SM2.SHG_ID = @ShgId)
                  GROUP BY SCI.SHG_MEMBER_LOAN_ACCNO) R
        ON R.SHG_MEMBER_LOAN_ACCNO = L.SHG_MEMBER_LOAN_ACCNO
     ORDER BY SM.MEMBER_ID, L.ISSUED_DATE
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_MANDAL_OVERDUE
   Java      : CeoLoanIntelligenceDAOImpl.getMandalOverdueRollup()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getMandalOverdueRollup() used to run
   Runs      : snapshot build
   Returns   : arrears per district / mandal of open loans: overdue loans and amount, outstanding, and three arrears bands

   Arrears come from SN.SHG_MEMBER_LOAN_STATUS_NEW (one row per loan, refreshed daily):
   LOAN_DUE = amount behind, LOAN_EMI = instalment, OUTSTANDING = balance.
   Bands: B1 arrears up to 1 instalment, B2 1 to 3, B3 over 3 (or no instalment left).
   The inline version could point at another table with -Dceo.dash.statusTable;
   the procedure always reads SN.SHG_MEMBER_LOAN_STATUS_NEW.

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_MANDAL_OVERDUE @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_MANDAL_OVERDUE
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SELECT VI.DISTRICT_ID, VI.MANDAL_ID,
           COUNT(*) AS STATUS_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS OVERDUE_AMOUNT,
           SUM(CASE WHEN ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OUTSTANDING_AMOUNT,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OVERDUE_OUTSTANDING,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.LOAN_EMI, 0) > 0 AND ISNULL(S.LOAN_DUE, 0) <= ISNULL(S.LOAN_EMI, 0) THEN 1 ELSE 0 END) AS B1_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.LOAN_EMI, 0) > 0 AND ISNULL(S.LOAN_DUE, 0) <= ISNULL(S.LOAN_EMI, 0) THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS B1_AMOUNT,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.LOAN_EMI, 0) > 0 AND ISNULL(S.LOAN_DUE, 0) > ISNULL(S.LOAN_EMI, 0) AND ISNULL(S.LOAN_DUE, 0) <= 3 * ISNULL(S.LOAN_EMI, 0) THEN 1 ELSE 0 END) AS B2_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.LOAN_EMI, 0) > 0 AND ISNULL(S.LOAN_DUE, 0) > ISNULL(S.LOAN_EMI, 0) AND ISNULL(S.LOAN_DUE, 0) <= 3 * ISNULL(S.LOAN_EMI, 0) THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS B2_AMOUNT,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND (ISNULL(S.LOAN_EMI, 0) <= 0 OR ISNULL(S.LOAN_DUE, 0) > 3 * ISNULL(S.LOAN_EMI, 0)) THEN 1 ELSE 0 END) AS B3_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND (ISNULL(S.LOAN_EMI, 0) <= 0 OR ISNULL(S.LOAN_DUE, 0) > 3 * ISNULL(S.LOAN_EMI, 0)) THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS B3_AMOUNT
      FROM SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK)
     INNER JOIN SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK) ON S.SHG_MEMBER_LOAN_ACCNO = MCP.SHG_MEMBER_LOAN_ACCNO
     INNER JOIN (SELECT MEMBER_ID, MAX(SHG_ID) AS SHG_ID, MAX(CATAGORY) AS CATEGORY
                   FROM SHG_MEMBER_INFO WITH (NOLOCK)
                  WHERE IS_MEM_ACTIVE = 'Y' AND LEN(LTRIM(RTRIM(MEMBER_ID))) >= 20
                  GROUP BY MEMBER_ID) SM ON SM.MEMBER_ID = MCP.MEMBER_LONG_CODE
     INNER JOIN SHG_INFO SI WITH (NOLOCK) ON SI.TRANS_SHG_ID = SM.SHG_ID AND SI.IS_ACTIVE = 'Y'
     INNER JOIN VO_INFO VI WITH (NOLOCK) ON VI.TRANS_VO_ID = SI.VO_ID AND VI.IS_ACTIVE = 'Y'
     WHERE MCP.LOAN_STATUS = 'OPEN' AND S.IS_CLOSED = 0
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
     GROUP BY VI.DISTRICT_ID, VI.MANDAL_ID
     ORDER BY VI.DISTRICT_ID, VI.MANDAL_ID
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_OVERDUE_BY_UNIT
   Java      : CeoLoanIntelligenceDAOImpl.getOverdueByUnit()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getOverdueByUnit() used to run
   Runs      : a mandal / VO / SHG page that shows arrears
   Returns   : arrears per VO, SHG or woman (UNIT_ID) of the clicked place

   VO: VOs of a mandal (@DistrictId + @MandalId). SHG: SHGs of a VO (@VoId), or of a
   whole mandal when @VoId is not given. MEMBER: women of an SHG (@ShgId).

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_OVERDUE_BY_UNIT @Group = 'VO', @DistrictId = '07', @MandalId = '25', @SnOnly = 1;
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_OVERDUE_BY_UNIT
    @Group VARCHAR(10),
    @DistrictId VARCHAR(10) = NULL,
    @MandalId VARCHAR(10) = NULL,
    @VoId VARCHAR(40) = NULL,
    @ShgId VARCHAR(40) = NULL,
    @SnOnly BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SET @Group = UPPER(LTRIM(RTRIM(@Group)));

    -- same checks as the Java code
    IF @Group NOT IN ('VO', 'SHG', 'MEMBER')
    BEGIN
        RAISERROR('overdue is not available for group %s', 16, 1, @Group);
        RETURN;
    END
    IF @Group = 'MEMBER' AND @ShgId IS NULL
    BEGIN
        RAISERROR('@ShgId is needed', 16, 1);
        RETURN;
    END
    IF (@Group = 'VO' OR (@Group = 'SHG' AND @VoId IS NULL)) AND (@DistrictId IS NULL OR @MandalId IS NULL)
    BEGIN
        RAISERROR('@DistrictId and @MandalId are needed', 16, 1);
        RETURN;
    END

    -- the status table is indexed by VO_ID and SHG_ID, so each branch reads one small slice
    IF @Group = 'VO'
    BEGIN
        SELECT S.VO_ID AS UNIT_ID,
               COUNT(*) AS STATUS_LOANS,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS OVERDUE_AMOUNT,
               SUM(CASE WHEN ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OUTSTANDING_AMOUNT,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OVERDUE_OUTSTANDING
          FROM SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK)
         INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = S.SHG_MEMBER_LOAN_ACCNO
         WHERE S.VO_ID IN (SELECT VX.TRANS_VO_ID FROM VO_INFO VX WITH (NOLOCK)
                             WHERE VX.DISTRICT_ID = @DistrictId AND VX.MANDAL_ID = @MandalId AND VX.IS_ACTIVE = 'Y')
           AND S.IS_CLOSED = 0 AND MCP.LOAN_STATUS = 'OPEN'
           AND MCP.MEMBER_LONG_CODE IS NOT NULL
           AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
           AND LEN(MCP.MEMBER_LONG_CODE) >= 20
           AND MCP.ISSUED_DATE IS NOT NULL
           AND MCP.ISSUED_DATE > '2000-01-01'
           AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
           AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                    WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
         GROUP BY S.VO_ID
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'SHG' AND @VoId IS NOT NULL
    BEGIN
        SELECT S.SHG_ID AS UNIT_ID,
               COUNT(*) AS STATUS_LOANS,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS OVERDUE_AMOUNT,
               SUM(CASE WHEN ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OUTSTANDING_AMOUNT,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OVERDUE_OUTSTANDING
          FROM SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK)
         INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = S.SHG_MEMBER_LOAN_ACCNO
         WHERE S.VO_ID = @VoId
           AND S.IS_CLOSED = 0 AND MCP.LOAN_STATUS = 'OPEN'
           AND MCP.MEMBER_LONG_CODE IS NOT NULL
           AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
           AND LEN(MCP.MEMBER_LONG_CODE) >= 20
           AND MCP.ISSUED_DATE IS NOT NULL
           AND MCP.ISSUED_DATE > '2000-01-01'
           AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
           AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                    WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
         GROUP BY S.SHG_ID
        OPTION (RECOMPILE);
        RETURN;
    END

    IF @Group = 'SHG'
    BEGIN
        SELECT S.SHG_ID AS UNIT_ID,
               COUNT(*) AS STATUS_LOANS,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS OVERDUE_AMOUNT,
               SUM(CASE WHEN ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OUTSTANDING_AMOUNT,
               SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OVERDUE_OUTSTANDING
          FROM SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK)
         INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = S.SHG_MEMBER_LOAN_ACCNO
         WHERE S.VO_ID IN (SELECT VX.TRANS_VO_ID FROM VO_INFO VX WITH (NOLOCK)
                             WHERE VX.DISTRICT_ID = @DistrictId AND VX.MANDAL_ID = @MandalId AND VX.IS_ACTIVE = 'Y')
           AND S.IS_CLOSED = 0 AND MCP.LOAN_STATUS = 'OPEN'
           AND MCP.MEMBER_LONG_CODE IS NOT NULL
           AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
           AND LEN(MCP.MEMBER_LONG_CODE) >= 20
           AND MCP.ISSUED_DATE IS NOT NULL
           AND MCP.ISSUED_DATE > '2000-01-01'
           AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
           AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                    WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
         GROUP BY S.SHG_ID
        OPTION (RECOMPILE);
        RETURN;
    END

    -- MEMBER: the women of one SHG
    SELECT MCP.MEMBER_LONG_CODE AS UNIT_ID,
           COUNT(*) AS STATUS_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN 1 ELSE 0 END) AS OVERDUE_LOANS,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 THEN ISNULL(S.LOAN_DUE, 0) ELSE 0 END) AS OVERDUE_AMOUNT,
           SUM(CASE WHEN ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OUTSTANDING_AMOUNT,
           SUM(CASE WHEN ISNULL(S.LOAN_DUE, 0) > 0 AND ISNULL(S.OUTSTANDING, 0) > 0 THEN ISNULL(S.OUTSTANDING, 0) ELSE 0 END) AS OVERDUE_OUTSTANDING
      FROM SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK)
     INNER JOIN SHG_MEMBER_MCP_INFO MCP WITH (NOLOCK) ON MCP.SHG_MEMBER_LOAN_ACCNO = S.SHG_MEMBER_LOAN_ACCNO
     WHERE S.SHG_ID = @ShgId
       AND S.IS_CLOSED = 0 AND MCP.LOAN_STATUS = 'OPEN'
       AND MCP.MEMBER_LONG_CODE IS NOT NULL
       AND LTRIM(RTRIM(MCP.MEMBER_LONG_CODE)) <> ''
       AND LEN(MCP.MEMBER_LONG_CODE) >= 20
       AND MCP.ISSUED_DATE IS NOT NULL
       AND MCP.ISSUED_DATE > '2000-01-01'
       AND MCP.LOAN_STATUS IN ('OPEN', 'CLOSED')
       AND (@SnOnly = 0 OR MCP.PROJECT_TYPE IN (SELECT PROJECT_TYPE FROM PROJECT_TYPE_LOAN_MAPPING WITH (NOLOCK)
                                                WHERE LTRIM(RTRIM(LOAN_TYPE)) = 'SN'))
     GROUP BY MCP.MEMBER_LONG_CODE
    OPTION (RECOMPILE);
END
GO

/* =====================================================================
   CEO Loan Intelligence Dashboard - stored procedure
   Designed and architected by CHINTALA MAHINDRA

   Procedure : dbo.USP_CEO_DASH_OVERDUE_BY_LOAN
   Java      : CeoLoanIntelligenceDAOImpl.getOverdueByLoan()
   Replaces  : the inline SQL that CeoLoanIntelligenceDAOImpl.getOverdueByLoan() used to run
   Runs      : an SHG page that shows arrears per loan
   Returns   : one row per open loan of the SHG: LOAN_ACCNO, ARREARS, EMI, OUTSTANDING, DUE_DATE

   Test in QueryTool / SSMS:
     EXEC dbo.USP_CEO_DASH_OVERDUE_BY_LOAN @ShgId = '<shg id>';
   ===================================================================== */

CREATE OR ALTER PROCEDURE dbo.USP_CEO_DASH_OVERDUE_BY_LOAN
    @ShgId VARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT S.SHG_MEMBER_LOAN_ACCNO AS LOAN_ACCNO, ISNULL(S.LOAN_DUE, 0) AS ARREARS, ISNULL(S.LOAN_EMI, 0) AS EMI,
           ISNULL(S.OUTSTANDING, 0) AS OUTSTANDING, CONVERT(CHAR(10), S.DUE_DATE, 120) AS DUE_DATE
      FROM SN.SHG_MEMBER_LOAN_STATUS_NEW S WITH (NOLOCK)
     WHERE S.SHG_ID = @ShgId AND S.IS_CLOSED = 0;
END
GO
