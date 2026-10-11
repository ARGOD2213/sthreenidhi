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
