function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return '\t' + str.replace(/"/g, '""');
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export class ReportGenerator {
  static generateTaxReport(data: any, format = 'json') {
    if (!data) throw new Error('No data provided for report');
    if (format === 'csv') {
      return this.toCSV(data);
    }
    return data;
  }

  private static toCSV(data: any): string {
    const rows: any[] = [];
    rows.push(['Category', 'Amount', 'Notes']);
    if (data.taxBreakdown) {
      rows.push(['Gross Income', data.taxBreakdown.grossIncome ?? '', '']);
      rows.push(['Federal Tax', data.taxBreakdown.federalTax ?? '', '']);
      rows.push(['Quebec Tax', data.taxBreakdown.quebecTax ?? '', '']);
      rows.push(['Payroll Deductions', data.taxBreakdown.payrollDeductions?.total ?? '', 'QPP+EI+QPIP']);
      rows.push(['Total Tax', data.taxBreakdown.totalTax ?? '', '']);
      rows.push(['After-Tax Income', data.taxBreakdown.afterTaxIncome ?? '', '']);
      rows.push(['Average Tax Rate', (data.taxBreakdown.averageTaxRate ?? '') + '%', '']);
      rows.push(['Marginal Tax Rate', ((data.taxBreakdown.marginalTaxRate ?? 0) * 100).toFixed(1) + '%', '']);
    }
    if (data.strategy) {
      rows.push(['', '', '']);
      rows.push(['Wealth Strategy', '', '']);
      rows.push(['Priority', 'Account', 'Reason']);
      data.strategy.forEach((s: any) => {
        rows.push([s.priority ?? '', s.account ?? '', s.reason ?? '']);
      });
    }
    if (data.yearOnePlan) {
      rows.push(['', '', '']);
      rows.push(['Year One Plan', '', '']);
      rows.push(['Priority', 'Account', 'Allocation', 'Benefit', 'Remaining']);
      data.yearOnePlan.forEach((p: any) => {
        rows.push([
          p.priority ?? '',
          p.account ?? '',
          p.allocation ?? '',
          p.benefit ?? '',
          p.remainingAfter !== undefined ? p.remainingAfter : '',
        ]);
      });
    }
    return rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  }

  static generateWealthReport(
    familyData: any,
    taxData: any,
    strategyData: any,
  ) {
    if (!familyData) throw new Error('Family data is required');
    return {
      generatedAt: new Date().toISOString(),
      family: {
        name: familyData.name,
        location: familyData.location,
        members: familyData.members?.map((m: any) => ({
          name: m.name,
          role: m.role,
          age: m.age,
        })),
      },
      netWorth: {
        assets: familyData.accounts?.reduce((a: number, b: any) => a + (b.balance || 0), 0),
        liabilities: familyData.debts?.reduce((a: number, b: any) => a + (b.balance || 0), 0),
        accounts: familyData.accounts?.map((a: any) => ({
          type: a.type,
          balance: a.balance,
          institution: a.institution,
          room: a.contribution_room,
        })),
        debts: familyData.debts?.map((d: any) => ({
          type: d.type,
          balance: d.balance,
          rate: d.interest_rate,
          monthly: d.monthly_payment,
        })),
      },
      insurance: familyData.insurance?.map((i: any) => ({
        type: i.type,
        provider: i.provider,
        coverage: i.coverage,
        premium: i.premium,
        status: i.status,
      })),
      taxAnalysis: taxData,
      wealthStrategy: strategyData,
      goals: familyData.goals?.map((g: any) => ({
        timeframe: g.timeframe,
        description: g.description,
        target: g.target_amount,
        current: g.current_amount,
        status: g.status,
      })),
      actionItems: familyData.actions?.map((a: any) => ({
        phase: a.phase,
        description: a.description,
        status: a.status,
        due: a.due_date,
      })),
      milestones: familyData.milestones?.map((m: any) => ({
        name: m.name,
        targetDate: m.target_date,
        status: m.status,
      })),
    };
  }
}

export default ReportGenerator;
