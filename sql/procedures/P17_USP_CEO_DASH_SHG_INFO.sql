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
