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
