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
