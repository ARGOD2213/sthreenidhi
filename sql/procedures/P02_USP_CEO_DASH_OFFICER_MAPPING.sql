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
