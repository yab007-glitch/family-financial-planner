import queries from '../db/queries';

export class CategorizationService {
    /**
     * Auto-categorize a transaction based on description patterns.
     */
    public static async categorize(familyId: number, description: string): Promise<{ category: string, subcategory: string }> {
        const desc = description.toUpperCase();
        
        // Find matching pattern in DB (family-specific or global defaults)
        const match = await queries.get<{ category: string, subcategory: string }>(
            `SELECT category, subcategory 
             FROM categorization_patterns 
             WHERE (family_id = ? OR family_id IS NULL) 
             AND ? LIKE pattern 
             ORDER BY family_id DESC, priority DESC 
             LIMIT 1`,
            [familyId, desc]
        );

        if (match) {
            return {
                category: match.category,
                subcategory: match.subcategory || ''
            };
        }

        // Generic falling back to "Other"
        return {
            category: 'Other',
            subcategory: 'Uncategorized'
        };
    }
}
