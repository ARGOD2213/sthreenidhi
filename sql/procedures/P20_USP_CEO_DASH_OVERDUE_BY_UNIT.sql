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
