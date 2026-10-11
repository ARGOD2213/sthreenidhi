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
