import { FamilyDetail, HealthScoreResult } from '../../types';

export class PdfGenerator {
    public static async generateSummaryHtml(family: FamilyDetail, health: HealthScoreResult): Promise<string> {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
                    h1 { color: #2563eb; margin: 0; }
                    .score-box { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                    .score-value { font-size: 48px; font-weight: bold; color: ${health.score > 70 ? '#16a34a' : '#ca8a04'}; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; }
                    .recommendation { margin-bottom: 10px; padding-left: 15px; border-left: 3px solid #3b82f6; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>WealthBuilder Family Strategy</h1>
                    <p>Prepared for: ${family.name}</p>
                    <p>Date: ${new Date().toLocaleDateString()}</p>
                </div>

                <div class="score-box">
                    <p>Overall Financial Health Score</p>
                    <div class="score-value">${health.score}%</div>
                </div>

                <div class="grid">
                    <div class="card">
                        <h3>Assets</h3>
                        ${family.accounts?.map(a => `<div>${a.type}: $${a.balance.toLocaleString()}</div>`).join('')}
                    </div>
                    <div class="card">
                        <h3>Debts</h3>
                        ${family.debts?.map(d => `<div>${d.type}: $${d.balance.toLocaleString()}</div>`).join('')}
                    </div>
                </div>

                <div style="margin-top: 30px;">
                    <h3>Priority Recommendations</h3>
                    ${health.recommendations.map((r: string) => `<div class="recommendation">${r}</div>`).join('')}
                </div>
            </body>
            </html>
        `;
    }
}
