/** Generate stable lore IDs for entities and milestones.
 *  IDs must match those produced by the Python parser in fixes/.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

export function entityLoreId(stageId: number, nameEn: string): string {
  const stage = String(stageId).padStart(2, '0');
  return `stage${stage}-entity-${slugify(nameEn)}`;
}

export function milestoneLoreId(stageId: number, progress: number, titleEn: string): string {
  const stage = String(stageId).padStart(2, '0');
  const prog = String(progress).padStart(3, '0');
  return `stage${stage}-milestone-${prog}-${slugify(titleEn)}`;
}
