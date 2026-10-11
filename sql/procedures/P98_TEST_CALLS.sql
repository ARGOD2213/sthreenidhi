/* =====================================================================
   CEO Loan Intelligence Dashboard - test calls for every procedure
   Designed and architected by CHINTALA MAHINDRA

   Run one EXEC at a time. Ids and dates are examples; put real ones in.
   The build procedures (P03 - P12) read large tables and take minutes,
   like the snapshot build itself; run them outside office hours.
   ===================================================================== */

-- P01_USP_CEO_DASH_ACTIVE_MANDALS.sql
EXEC dbo.USP_CEO_DASH_ACTIVE_MANDALS;

-- P02_USP_CEO_DASH_OFFICER_MAPPING.sql
EXEC dbo.USP_CEO_DASH_OFFICER_MAPPING;

-- P03_USP_CEO_DASH_DISTRICT_ROLLUP.sql
EXEC dbo.USP_CEO_DASH_DISTRICT_ROLLUP @FyLabel = '2026-27', @FyStart = '2026-04-01',
     @FyEnd = '2027-04-01', @SnOnly = 1;

-- P04_USP_CEO_DASH_MANDAL_DAILY_LOANS.sql
EXEC dbo.USP_CEO_DASH_MANDAL_DAILY_LOANS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;

-- P05_USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS.sql
EXEC dbo.USP_CEO_DASH_MANDAL_DAILY_REPAYMENTS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1, @PayModes = 1;

-- P06_USP_CEO_DASH_DISTRICT_PROJECTS.sql
EXEC dbo.USP_CEO_DASH_DISTRICT_PROJECTS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;

-- P07_USP_CEO_DASH_MANDAL_LOANS.sql
EXEC dbo.USP_CEO_DASH_MANDAL_LOANS @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;

-- P08_USP_CEO_DASH_MANDAL_TARGETS.sql
EXEC dbo.USP_CEO_DASH_MANDAL_TARGETS @FyLabel = '2026-27';

-- P09_USP_CEO_DASH_LOAN_CUBE.sql
EXEC dbo.USP_CEO_DASH_LOAN_CUBE @From = '2024-11-01', @To = '2026-11-01', @SnOnly = 1;

-- P10_USP_CEO_DASH_MANDAL_PURPOSES.sql
EXEC dbo.USP_CEO_DASH_MANDAL_PURPOSES @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;

-- P11_USP_CEO_DASH_PROJECT_NAMES.sql
EXEC dbo.USP_CEO_DASH_PROJECT_NAMES @SnOnly = 1;

-- P12_USP_CEO_DASH_REPAYMENT_CUBE.sql
EXEC dbo.USP_CEO_DASH_REPAYMENT_CUBE @From = '2024-11-01', @To = '2026-11-01', @SnOnly = 1, @PayModes = 1;

-- P13_USP_CEO_DASH_CASH_KEYED_BY.sql
EXEC dbo.USP_CEO_DASH_CASH_KEYED_BY @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1;

-- P14_USP_CEO_DASH_DRILL_AREA.sql
EXEC dbo.USP_CEO_DASH_DRILL_AREA @Group = 'MANDAL', @DistrictId = '07',
     @From = '2026-09-01', @To = '2026-09-16', @SnOnly = 1, @PayModes = 1;

-- P15_USP_CEO_DASH_DRILL_SCOPE.sql
EXEC dbo.USP_CEO_DASH_DRILL_SCOPE @Group = 'VO', @DistrictId = '07', @MandalId = '25',
     @From = '2026-04-01', @To = '2027-04-01', @SnOnly = 1, @PayModes = 1;

-- P16_USP_CEO_DASH_MEMBER_DETAIL.sql
EXEC dbo.USP_CEO_DASH_MEMBER_DETAIL @MemberId = '<member id>', @SnOnly = 1, @PayModes = 1;

-- P17_USP_CEO_DASH_SHG_INFO.sql
EXEC dbo.USP_CEO_DASH_SHG_INFO @ShgId = '<shg id>';

-- P18_USP_CEO_DASH_SHG_MEMBER_LOANS.sql
EXEC dbo.USP_CEO_DASH_SHG_MEMBER_LOANS @ShgId = '<shg id>', @SnOnly = 1;

-- P19_USP_CEO_DASH_MANDAL_OVERDUE.sql
EXEC dbo.USP_CEO_DASH_MANDAL_OVERDUE @SnOnly = 1;

-- P20_USP_CEO_DASH_OVERDUE_BY_UNIT.sql
EXEC dbo.USP_CEO_DASH_OVERDUE_BY_UNIT @Group = 'VO', @DistrictId = '07', @MandalId = '25', @SnOnly = 1;

-- P21_USP_CEO_DASH_OVERDUE_BY_LOAN.sql
EXEC dbo.USP_CEO_DASH_OVERDUE_BY_LOAN @ShgId = '<shg id>';
