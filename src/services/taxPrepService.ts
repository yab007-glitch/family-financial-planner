import { FamilyDetail } from '../types';

export interface TaxDocument {
    name: string;
    description: string;
    status: 'Required' | 'Ready' | 'Missing';
}

export class TaxPrepService {
    public static generateChecklist(family: FamilyDetail): TaxDocument[] {
        const checklist: TaxDocument[] = [];
        const accounts = family.accounts || [];
        const members = family.members || [];

        // 1. Employment
        members.forEach(m => {
            if ((m as any).annual_income > 0) {
                checklist.push({
                    name: `T4 - ${m.name}`,
                    description: 'Statement of Remuneration Paid from your employer.',
                    status: 'Required'
                });
            }
        });

        // 2. Investment Income
        const taxableInstitutions = new Set(accounts.filter(a => a.type === 'Non-registered').map(a => a.institution));
        taxableInstitutions.forEach(inst => {
            checklist.push({
                name: `T5 - ${inst}`,
                description: 'Investment income statement for taxable dividends and interest.',
                status: 'Required'
            });
        });

        // 3. RRSP Receipts
        const rrspInstitutions = new Set(accounts.filter(a => a.type === 'RRSP').map(a => a.institution));
        rrspInstitutions.forEach(inst => {
            checklist.push({
                name: `RRSP Receipt - ${inst}`,
                description: 'Contribution receipt for the March-Dec and Jan-Feb periods.',
                status: 'Required'
            });
        });

        // 4. Medical / Kids (Quebec specific mostly)
        if (members.some(m => m.role === 'Child')) {
            checklist.push({
                name: 'RL-24 / Childcare Receipts',
                description: 'Relevant for the Childcare Expense Deduction.',
                status: 'Required'
            });
        }

        return checklist;
    }
}
