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
