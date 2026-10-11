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
