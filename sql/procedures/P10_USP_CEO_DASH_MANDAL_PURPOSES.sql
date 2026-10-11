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
